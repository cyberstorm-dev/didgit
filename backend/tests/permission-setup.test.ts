import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { runPermissionSetup } from '../src/permission-setup';

test('runPermissionSetup signs typed data, fetches permission, and attests', async () => {
  const privateKey = '0x59c6995e998f97a5a0044976f0945382db6b0c6f1f48d6b6f5d7d0b8c4b6b9c1';
  const account = privateKeyToAccount(privateKey);
  const kernelAddress = '0x3C9b6d91676E2a937f82c58B3038C666d0B94d98';

  const typedData = {
    domain: {
      name: 'Kernel',
      version: '0.3.1',
      chainId: 84532,
      verifyingContract: kernelAddress
    },
    types: {
      Enable: [
        { name: 'validationId', type: 'bytes21' },
        { name: 'nonce', type: 'uint32' },
        { name: 'hook', type: 'address' },
        { name: 'validatorData', type: 'bytes' },
        { name: 'hookData', type: 'bytes' },
        { name: 'selectorData', type: 'bytes' }
      ]
    },
    primaryType: 'Enable',
    message: {
      validationId: '0x02e4148e6200000000000000000000000000000000',
      nonce: 1,
      hook: '0x0000000000000000000000000000000000000000',
      validatorData: '0x1234',
      hookData: '0x',
      selectorData: '0x'
    }
  } as const;

  const expectedSig = await account.signTypedData(typedData);

  const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body, headers });
    if (url.endsWith('/prepare')) {
      return {
        ok: true,
        json: async () => ({ typedData, kernelAddress })
      } as Response;
    }
    if (url.endsWith('/complete')) {
      return {
        ok: true,
        json: async () => ({ permissionData: '0xdeadbeef', kernelAddress })
      } as Response;
    }
    throw new Error('unexpected url');
  };

  const attestCalls: any[] = [];
  const attestFn = async (args: any) => {
    attestCalls.push(args);
  };

  const result = await runPermissionSetup({
    privateKey,
    apiKey: 'ab95ab7e1850',
    fetchFn,
    attestFn
  });

  assert.equal(result.permissionData, '0xdeadbeef');
  assert.equal(result.kernelAddress, kernelAddress);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://didgit-permission-blob.ops7622.workers.dev/prepare');
  assert.equal(calls[1].url, 'https://didgit-permission-blob.ops7622.workers.dev/complete');
  assert.equal(calls[1].body.enableSignature, expectedSig);
  assert.equal(attestCalls.length, 1);
  assert.equal(attestCalls[0].permissionData, '0xdeadbeef');
  assert.equal(attestCalls[0].kernelAddress, kernelAddress);
  assert.equal(attestCalls[0].privateKey, privateKey);
});

test('runPermissionSetup uses default API key when none provided', async () => {
  const privateKey = '0x59c6995e998f97a5a0044976f0945382db6b0c6f1f48d6b6f5d7d0b8c4b6b9c1';
  const kernelAddress = '0x3C9b6d91676E2a937f82c58B3038C666d0B94d98';

  const typedData = {
    domain: { name: 'Kernel', version: '0.3.1', chainId: 84532, verifyingContract: kernelAddress },
    types: { Enable: [{ name: 'validationId', type: 'bytes21' }] },
    primaryType: 'Enable',
    message: { validationId: '0x02e4148e6200000000000000000000000000000000' }
  } as const;

  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    calls.push({ url, headers });
    if (url.endsWith('/prepare')) {
      return { ok: true, json: async () => ({ typedData, kernelAddress }) } as Response;
    }
    if (url.endsWith('/complete')) {
      return { ok: true, json: async () => ({ permissionData: '0xdeadbeef', kernelAddress }) } as Response;
    }
    throw new Error('unexpected url');
  };

  await runPermissionSetup({
    privateKey,
    fetchFn,
    attestFn: async () => {}
  });

  assert.equal(calls[0].headers['x-api-key'], 'ab95ab7e1850');
});
