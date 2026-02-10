#!/usr/bin/env npx tsx
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { attestPermission } from './attest-permission';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type RunOptions = {
  privateKey?: string;
  apiUrl?: string;
  apiKey?: string;
  kernelAddress?: string;
  fetchFn?: FetchFn;
  attestFn?: (args: { privateKey: string; kernelAddress: string; permissionData: string }) => Promise<void>;
};

function requireEnv(val: string | undefined, name: string) {
  if (!val) throw new Error(`${name} required`);
  return val;
}

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function resolvePermissionApiUrl(explicitUrl?: string) {
  const url = (explicitUrl || '').trim();
  if (!url) {
    return 'https://didgit-permission-blob.ops7622.workers.dev';
  }
  if (url.includes('didgit.dev')) {
    return 'https://didgit-permission-blob.ops7622.workers.dev';
  }
  return url;
}

export async function runPermissionSetup(opts: RunOptions = {}) {
  const privateKey = (opts.privateKey || process.env.PRIVATE_KEY || '').trim();
  const apiUrl = normalizeBaseUrl(
    resolvePermissionApiUrl(opts.apiUrl || process.env.PERMISSION_API_URL)
  );
  const apiKey = (opts.apiKey || process.env.PERMISSION_API_KEY || process.env.DIDGIT_API_KEY || 'ab95ab7e1850').trim();
  const kernelAddress = (opts.kernelAddress || process.env.KERNEL_ADDRESS || '').trim();
  const fetchFn: FetchFn = opts.fetchFn || fetch;
  const attestFn = opts.attestFn || attestPermission;

  requireEnv(privateKey, 'PRIVATE_KEY');
  requireEnv(apiKey, 'PERMISSION_API_KEY');

  const account = privateKeyToAccount(privateKey as Hex);
  const userEOA = account.address;

  const prepareRes = await fetchFn(`${apiUrl}/prepare`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userEOA, kernelAddress: kernelAddress || undefined })
  });
  if (!prepareRes.ok) {
    throw new Error(`prepare failed: ${await prepareRes.text()}`);
  }
  const prepareJson = await prepareRes.json() as { typedData: any; kernelAddress: string };
  const typedData = prepareJson.typedData;
  const resolvedKernel = prepareJson.kernelAddress;

  const enableSignature = await account.signTypedData(typedData);

  const completeRes = await fetchFn(`${apiUrl}/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userEOA, kernelAddress: resolvedKernel, enableSignature })
  });
  if (!completeRes.ok) {
    throw new Error(`complete failed: ${await completeRes.text()}`);
  }
  const completeJson = await completeRes.json() as { permissionData: string; kernelAddress: string };

  await attestFn({
    privateKey,
    kernelAddress: completeJson.kernelAddress,
    permissionData: completeJson.permissionData
  });

  return {
    permissionData: completeJson.permissionData,
    kernelAddress: completeJson.kernelAddress
  };
}

async function main() {
  const result = await runPermissionSetup();
  console.log('Kernel:', result.kernelAddress);
  console.log('PERMISSION_DATA:', result.permissionData);
}

const isMain = process.argv[1] && /permission-setup\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
