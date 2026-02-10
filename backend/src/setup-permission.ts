#!/usr/bin/env npx tsx
/**
 * Setup Session Key Permission - Stores in EAS
 * 
 * Creates the ZeroDev permission and attests it to EAS for on-chain storage.
 * The attestor service queries EAS for these permissions - no JSON files.
 * 
 * Usage:
 *   USER_PRIVKEY=0x... npx tsx src/setup-permission.ts
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Address, type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  createKernelAccount,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { 
  toPermissionValidator,
  serializePermissionAccount,
} from '@zerodev/permissions';
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { getConfig } from './config';

const ACTIVE = getConfig();
const EAS_ADDRESS = ACTIVE.easAddress as Address;
const ATTEST_SELECTOR = '0xf17325e7' as Hex;

// Session Key Permission schema
const PERMISSION_SCHEMA_UID = ACTIVE.permissionSchemaUid as Hex;

const easAbi = [
  {
    name: 'attest',
    type: 'function',
    inputs: [{
      name: 'request',
      type: 'tuple',
      components: [
        { name: 'schema', type: 'bytes32' },
        { name: 'data', type: 'tuple', components: [
          { name: 'recipient', type: 'address' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'revocable', type: 'bool' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'data', type: 'bytes' },
          { name: 'value', type: 'uint256' }
        ]}
      ]
    }],
    outputs: [{ name: '', type: 'bytes32' }]
  }
] as const;

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const USER_PRIVKEY = process.env.USER_PRIVKEY as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC;

if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY required in .env');
if (!USER_PRIVKEY) throw new Error('USER_PRIVKEY required');
if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC required in .env');

const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
const userAccount = privateKeyToAccount(USER_PRIVKEY);

const publicClient = createPublicClient({
  chain: ACTIVE.chain,
  transport: http(ACTIVE.rpcUrl)
});

const entryPoint = getEntryPoint('0.7');

async function main() {
  console.log('\n🔑 Setting up session key permission (stored in EAS)...\n');
  console.log('User EOA:', userAccount.address);
  console.log('Verifier:', verifierAccount.address);

  // Create ECDSA validator for the user
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  // Get the user's Kernel account
  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  console.log('Kernel:', kernelAccount.address);

  const balance = await publicClient.getBalance({ address: kernelAccount.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(6), 'ETH');

  if (balance < BigInt(1e15)) {
    console.log('\n⚠️  Kernel balance too low. Please fund:', kernelAccount.address);
    process.exit(1);
  }

  // Create permission
  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: [{
      target: EAS_ADDRESS,
      selector: ATTEST_SELECTOR,
      valueLimit: BigInt(0)
    }]
  });

  const verifierSigner = await toECDSASigner({ signer: verifierAccount });

  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  // Create Kernel with permission
  const kernelWithPermission = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionValidator
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  // Serialize the permission
  const serialized = await serializePermissionAccount(kernelWithPermission, VERIFIER_PRIVKEY);
  console.log('\nPermission serialized, length:', serialized.length);

  // Encode permission data for EAS
  // Schema: address userKernel, address verifier, address target, bytes4 selector, bytes serializedPermission
  // Convert base64 serialized permission to hex bytes
  const serializedHex = ('0x' + Buffer.from(serialized, 'utf-8').toString('hex')) as Hex;
  
  const permissionData = encodeAbiParameters(
    parseAbiParameters('address, address, address, bytes4, bytes'),
    [
      kernelWithPermission.address,  // userKernel
      verifierAccount.address,        // verifier
      EAS_ADDRESS,                    // target
      ATTEST_SELECTOR,                // selector
      serializedHex                   // serializedPermission (utf8->hex)
    ]
  );

  // Create EAS attestation (user attests their own permission)
  const walletClient = createWalletClient({
    account: userAccount,
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  console.log('\nAttesting permission to EAS...');

  const attestRequest = {
    schema: PERMISSION_SCHEMA_UID,
    data: {
      recipient: kernelWithPermission.address,
      expirationTime: 0n,
      revocable: true,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      data: permissionData,
      value: 0n
    }
  };

  const hash = await walletClient.writeContract({
    address: EAS_ADDRESS,
    abi: easAbi,
    functionName: 'attest',
    args: [attestRequest]
  });

  console.log('TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  // Get attestation UID from logs
  const attestedEvent = receipt.logs.find(l => l.topics.length > 1);
  const attestationUid = attestedEvent?.topics[1];

  console.log('\n✅ Permission stored in EAS!');
  console.log('Attestation UID:', attestationUid);
  console.log('\nKernel:', kernelWithPermission.address);
  console.log('Verifier:', verifierAccount.address);
  console.log('Scope: EAS.attest() only');
  console.log('\nThe attestor service will find this permission by querying EAS.');
  console.log('No JSON files needed.');
}

main().catch(console.error);
