/**
 * Test the full permission-based attestation flow
 * 
 * Simulates:
 * 1. User creates Kernel account with permission (frontend)
 * 2. Backend uses permission to create UserOp
 */

import { 
  createPublicClient, 
  http, 
  type Address, 
  type Hex, 
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const USER_PRIVKEY = '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7' as Hex; // cyberstorm-nisto testnet key
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex; // cyberstorm-nisto identity

async function testFullFlow() {
  if (!VERIFIER_PRIVKEY || !USER_PRIVKEY || !BUNDLER_RPC) {
    throw new Error('Need VERIFIER_PRIVKEY, USER_PRIVKEY, and BUNDLER_RPC');
  }

  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
  const userAccount = privateKeyToAccount(USER_PRIVKEY);

  console.log('=== Setup ===');
  console.log('Verifier:', verifierAccount.address);
  console.log('User EOA:', userAccount.address);
  console.log('Bundler:', BUNDLER_RPC);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  // Import ZeroDev
  const { toPermissionValidator } = await import('@zerodev/permissions');
  const { toECDSASigner } = await import('@zerodev/permissions/signers');
  const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions/policies');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
  const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  // === STEP 1: User creates Kernel account (simulating frontend) ===
  console.log('\n=== Step 1: User creates Kernel account ===');

  // User's sudo validator
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion
  });

  // Verifier's permission validator
  const verifierSigner = await toECDSASigner({
    signer: verifierAccount
  });

  const easAbi = parseAbi([
    'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
  ]);

  const callPolicy = await toCallPolicy({
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

  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion
  });

  console.log('Permission ID:', permissionValidator.getIdentifier());

  // Create Kernel account with both validators
  const userKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator
    }
  });

  const kernelAddress = await userKernelAccount.getAddress();
  console.log('User Kernel address:', kernelAddress);

  // Check if account is deployed
  const code = await publicClient.getBytecode({ address: kernelAddress });
  if (!code) {
    console.log('⚠️  Kernel account not yet deployed');
    console.log('   First UserOp will deploy it');
  } else {
    console.log('✅ Kernel account already deployed');
  }

  // === STEP 2: Backend creates UserOp using permission (simulating backend) ===
  console.log('\n=== Step 2: Backend creates UserOp ===');

  // Backend creates the SAME permission validator
  const backendVerifierSigner = await toECDSASigner({
    signer: verifierAccount // Same verifier key
  });

  const backendCallPolicy = await toCallPolicy({
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

  const backendPermissionValidator = await toPermissionValidator(publicClient, {
    signer: backendVerifierSigner,
    policies: [backendCallPolicy],
    entryPoint,
    kernelVersion
  });

  console.log('Backend permission ID:', backendPermissionValidator.getIdentifier());

  // CRITICAL: Backend needs to create an account object that references the user's Kernel
  // But uses the permission validator for signing
  
  // The issue: createKernelAccount derives a NEW address based on the validators
  // We want to reference the EXISTING address that the user created
  
  // Solution: Use the user's sudo validator + permission validator
  // But backend doesn't have user's private key for sudo validator
  
  // Alternative: Create account with ONLY permission validator?
  // That would derive a different address
  
  // Let me try using the permission validator as the main validator
  const backendKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: backendPermissionValidator
    }
  });

  const backendKernelAddress = await backendKernelAccount.getAddress();
  console.log('Backend derived address:', backendKernelAddress);
  console.log('Matches user address?', backendKernelAddress === kernelAddress);

  if (backendKernelAddress !== kernelAddress) {
    console.log('\n❌ Problem: Backend derives different address!');
    console.log('   This is the core issue - backend needs to reference user\'s account');
    console.log('   without having user\'s private key');
    
    console.log('\n💡 Possible solutions:');
    console.log('   A) Frontend shares Kernel address, backend creates "stub" account');
    console.log('   B) Use session keys / delegated validators');
    console.log('   C) Deploy custom AllowlistValidator contract');
    
    return;
  }

  // If we reach here, addresses match - create client and send UserOp
  const backendKernelClient = await createKernelAccountClient({
    account: backendKernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  // Encode attestation data
  const contributionData = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      'cyberstorm-dev/didgit',
      'abc123def456', // test commit
      'cyberstorm-nisto',
      'Test attestation via permissions',
      BigInt(Math.floor(Date.now() / 1000)),
      IDENTITY_UID
    ]
  );

  console.log('\nSending attestation UserOp...');

  const txHash = await backendKernelClient.writeContract({
    address: EAS_ADDRESS,
    abi: easAbi,
    functionName: 'attest',
    args: [{
      schema: CONTRIBUTION_SCHEMA,
      data: {
        recipient: kernelAddress,
        expirationTime: 0n,
        revocable: true,
        refUID: IDENTITY_UID,
        data: contributionData,
        value: 0n
      }
    }]
  });

  console.log('TX hash:', txHash);
  console.log('✅ Success!');
}

testFullFlow().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
