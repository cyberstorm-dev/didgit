import { createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount, toAccount, type Address, type Hex } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toPermissionValidator, serializePermissionAccount } from '@zerodev/permissions';
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

type Env = {
  VERIFIER_PRIVKEY: string;
  API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const ATTEST_SELECTOR = '0xf17325e7';
const PERMISSION_SCHEMA_UID = '0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6';

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
      assert(env.VERIFIER_PRIVKEY?.startsWith('0x'), 'Server misconfigured: VERIFIER_PRIVKEY missing');

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
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

      const verifierAccount = privateKeyToAccount(env.VERIFIER_PRIVKEY as Hex);

      const callPolicy = toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: EAS_ADDRESS,
            selector: ATTEST_SELECTOR,
            valueLimit: BigInt(0)
          }
        ]
      });

      const verifierSigner = await toECDSASigner({ signer: verifierAccount });

      const permissionValidator = await toPermissionValidator(publicClient, {
        signer: verifierSigner,
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
            verifier: verifierAccount.address,
            target: EAS_ADDRESS,
            selector: ATTEST_SELECTOR,
            permissionSchemaUid: PERMISSION_SCHEMA_UID
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
          env.VERIFIER_PRIVKEY as Hex,
          enableSignature
        );

        const serializedHex = toHexUtf8(serialized);

        const permissionData = encodeAbiParameters(
          parseAbiParameters('address, address, address, bytes4, bytes'),
          [
            kernelWithPermission.address,
            verifierAccount.address,
            EAS_ADDRESS,
            ATTEST_SELECTOR,
            serializedHex
          ]
        );

        return json(
          {
            permissionData,
            kernelAddress: kernelWithPermission.address,
            verifier: verifierAccount.address,
            target: EAS_ADDRESS,
            selector: ATTEST_SELECTOR,
            permissionSchemaUid: PERMISSION_SCHEMA_UID
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
