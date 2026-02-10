import { createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount, toAccount, type Address, type Hex } from 'viem/accounts';
import { base, arbitrum } from 'viem/chains';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toPermissionValidator, serializePermissionAccount } from '@zerodev/permissions';
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

type Env = {
  ATTESTER_PRIVKEY?: string;
  VERIFIER_PRIVKEY?: string; // legacy
  API_KEY: string;
  ALLOWED_ORIGIN?: string;
  CHAIN?: string;
  BASE_RPC_URL?: string;
  ARBITRUM_RPC_URL?: string;
  BASE_EAS_ADDRESS?: string;
  ARBITRUM_EAS_ADDRESS?: string;
  BASE_PERMISSION_SCHEMA_UID?: string;
  ARBITRUM_PERMISSION_SCHEMA_UID?: string;
};

const ATTEST_SELECTOR = '0xf17325e7';

type ChainKey = 'base' | 'arbitrum';

function envOrThrow(env: Env, key: keyof Env): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Server misconfigured: ${String(key)} missing`);
  }
  return value;
}

function getChainConfig(env: Env) {
  const key = (env.CHAIN || 'base') as ChainKey;
  if (key === 'base') {
    return {
      name: 'base' as const,
      chain: base,
      rpcUrl: env.BASE_RPC_URL || 'https://mainnet.base.org',
      easAddress: envOrThrow(env, 'BASE_EAS_ADDRESS'),
      permissionSchemaUid: envOrThrow(env, 'BASE_PERMISSION_SCHEMA_UID')
    };
  }
  if (key === 'arbitrum') {
    return {
      name: 'arbitrum' as const,
      chain: arbitrum,
      rpcUrl: env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      easAddress: envOrThrow(env, 'ARBITRUM_EAS_ADDRESS'),
      permissionSchemaUid: envOrThrow(env, 'ARBITRUM_PERMISSION_SCHEMA_UID')
    };
  }
  throw new Error(`Server misconfigured: Unknown CHAIN ${key}`);
}

function json(body: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'content-type, x-api-key',
      'access-control-allow-methods': 'POST, OPTIONS'
    }
  });
}

function toHexUtf8(str: string): Hex {
  const bytes = new TextEncoder().encode(str);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex as Hex;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function getKernelForUser(publicClient: ReturnType<typeof createPublicClient>, userEOA: Address) {
  const entryPoint = getEntryPoint('0.7');

  const dummySigner = toAccount({
    address: userEOA,
    async signMessage() { throw new Error('signMessage not supported in worker'); },
    async signTypedData() { throw new Error('signTypedData not supported in worker'); },
    async signTransaction() { throw new Error('signTransaction not supported in worker'); }
  });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: dummySigner,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  return { kernelAccount, ecdsaValidator, entryPoint };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-headers': 'content-type, x-api-key',
          'access-control-allow-methods': 'POST, OPTIONS'
        }
      });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return json({ error: 'Unauthorized' }, 401, origin);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const attesterPrivKey = (env.ATTESTER_PRIVKEY || env.VERIFIER_PRIVKEY || '').trim();
      assert(attesterPrivKey.startsWith('0x'), 'Server misconfigured: ATTESTER_PRIVKEY missing');
      const chainConfig = getChainConfig(env);

      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpcUrl)
      });

      const userEOA = (body.userEOA || '').trim() as Address;
      const kernelAddressInput = (body.kernelAddress || '').trim().toLowerCase();

      assert(userEOA?.startsWith('0x'), 'userEOA required (0x-prefixed address)');

      const { kernelAccount, ecdsaValidator, entryPoint } = await getKernelForUser(publicClient, userEOA);
      const computedKernel = kernelAccount.address.toLowerCase();

      if (kernelAddressInput && kernelAddressInput !== computedKernel) {
        return json(
          { error: 'kernelAddress mismatch', computedKernel: kernelAccount.address },
          400,
          origin
        );
      }

      const attesterAccount = privateKeyToAccount(attesterPrivKey as Hex);

      const callPolicy = toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: chainConfig.easAddress as Address,
            selector: ATTEST_SELECTOR,
            valueLimit: BigInt(0)
          }
        ]
      });

      const attesterSigner = await toECDSASigner({ signer: attesterAccount });

      const permissionValidator = await toPermissionValidator(publicClient, {
        signer: attesterSigner,
        policies: [callPolicy],
        entryPoint,
        kernelVersion: KERNEL_V3_1
      });

      if (path.endsWith('/prepare')) {
        const typedData = await kernelAccount.kernelPluginManager.getPluginsEnableTypedData(
          kernelAccount.address,
          permissionValidator
        );

        return json(
          {
            typedData,
            kernelAddress: kernelAccount.address,
            attester: attesterAccount.address,
            verifier: attesterAccount.address,
            target: chainConfig.easAddress,
            selector: ATTEST_SELECTOR,
            permissionSchemaUid: chainConfig.permissionSchemaUid
          },
          200,
          origin
        );
      }

      if (path.endsWith('/complete')) {
        const enableSignature = (body.enableSignature || '').trim() as Hex;
        assert(enableSignature?.startsWith('0x'), 'enableSignature required (0x-prefixed)');

        const kernelWithPermission = await createKernelAccount(publicClient, {
          plugins: {
            sudo: ecdsaValidator,
            regular: permissionValidator
          },
          entryPoint,
          kernelVersion: KERNEL_V3_1
        });

        const serialized = await serializePermissionAccount(
          kernelWithPermission,
          attesterPrivKey as Hex,
          enableSignature
        );

        const serializedHex = toHexUtf8(serialized);

        const permissionData = encodeAbiParameters(
          parseAbiParameters('address, address, address, bytes4, bytes'),
          [
            kernelWithPermission.address,
            attesterAccount.address,
            chainConfig.easAddress,
            ATTEST_SELECTOR,
            serializedHex
          ]
        );

        return json(
          {
            permissionData,
            kernelAddress: kernelWithPermission.address,
            attester: attesterAccount.address,
            verifier: attesterAccount.address,
            target: chainConfig.easAddress,
            selector: ATTEST_SELECTOR,
            permissionSchemaUid: chainConfig.permissionSchemaUid
          },
          200,
          origin
        );
      }

      return json({ error: 'Unknown route' }, 404, origin);
    } catch (err: any) {
      return json({ error: err.message || String(err) }, 400, origin);
    }
  }
};
