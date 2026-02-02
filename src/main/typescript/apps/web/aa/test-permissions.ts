/**
 * Test script to understand ZeroDev permissions flow
 * Run with: npx ts-node test-permissions.ts
 */

import { createPublicClient, http, parseAbi, type Address, type Hex } from 'viem';
import { baseSepolia } from '../utils/eas';
import { privateKeyToAccount } from 'viem/accounts';

// Load from secrets
const VERIFIER_PRIVKEY = '0xfcb525413bd7c69608771c60e923c7dcb283caa07559f5bbfcffb86ed2bbd637' as Hex;
const USER_PRIVKEY = '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7' as Hex; // cyberstorm-nisto

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;

async function test() {
  if (!VERIFIER_PRIVKEY || !USER_PRIVKEY) {
    console.error('Need VERIFIER_PRIVKEY and USER_PRIVKEY env vars');
    process.exit(1);
  }

  const { toPermissionValidator } = await import('@zerodev/permissions');
  const { toECDSASigner } = await import('@zerodev/permissions');
  const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
  const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0])
  });

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  // Create accounts
  const userAccount = privateKeyToAccount(USER_PRIVKEY);
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);

  console.log('User:', userAccount.address);
  console.log('Verifier:', verifierAccount.address);

  // Create user's sudo validator
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion
  });

  // Create verifier's modular signer
  const verifierSigner = await toECDSASigner({
    signer: verifierAccount
  });

  // Create call policy
  const easAbi = parseAbi([
    'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
  ]);

  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_5,
    permissions: [
      {
        target: EAS_ADDRESS,
        abi: easAbi,
        functionName: 'attest',
        valueLimit: 0n
      }
    ]
  });

  // Create permission validator
  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion
  });

  console.log('Permission ID:', permissionValidator.getIdentifier());

  // Create user's kernel account with both validators
  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator // This enables the permission
    }
  });

  console.log('Kernel account:', await kernelAccount.getAddress());

  // TODO: Now verifier needs to use this same permission to sign UserOps
  // That would happen in the backend service
}

test().catch(console.error);
