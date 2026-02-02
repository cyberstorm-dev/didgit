/**
 * Test creating UserOps for user's Kernel account using explicit address parameter
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
const USER_PRIVKEY = '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7' as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex;

async function test() {
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
  const userAccount = privateKeyToAccount(USER_PRIVKEY);

  console.log('=== Setup ===');
  console.log('Verifier:', verifierAccount.address);
  console.log('User EOA:', userAccount.address);
  console.log('');

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

  // === STEP 1: User creates their Kernel account (frontend) ===
  console.log('=== Step 1: User creates Kernel account ===');

  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion
  });

  const userKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator
    }
  });

  const userKernelAddress = await userKernelAccount.getAddress();
  console.log('User Kernel address:', userKernelAddress);
  
  // Check if deployed
  const code = await publicClient.getBytecode({ address: userKernelAddress });
  if (!code) {
    console.log('⚠️  Kernel not deployed yet, deploying...');
    
    // Create a client to deploy it
    const { createKernelAccountClient } = await import('@zerodev/sdk');
    const deployClient = await createKernelAccountClient({
      account: userKernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(BUNDLER_RPC)
    });
    
    // Send a dummy tx to deploy the account
    console.log('Sending deployment tx...');
    const deployHash = await deployClient.sendTransaction({
      to: userKernelAddress, // Send to self
      value: 0n,
      data: '0x'
    });
    
    console.log('Deploy TX:', deployHash);
    await publicClient.waitForTransactionReceipt({ hash: deployHash });
    console.log('✅ Kernel deployed');
  } else {
    console.log('✅ Kernel already deployed');
  }
  
  console.log('');

  // === STEP 2: Backend references user's Kernel with explicit address ===
  console.log('=== Step 2: Backend references user Kernel ===');

  // Create permission validator for signing
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

  // Create Kernel account with EXPLICIT ADDRESS
  const backendKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    address: userKernelAddress, // 🔑 THIS IS THE KEY - explicit address!
    plugins: {
      sudo: permissionValidator // Use permission validator for signing
    }
  });

  const backendKernelAddress = await backendKernelAccount.getAddress();
  console.log('Backend Kernel address:', backendKernelAddress);
  console.log('Matches user address?', backendKernelAddress === userKernelAddress);
  console.log('');

  if (backendKernelAddress !== userKernelAddress) {
    console.log('❌ Addresses don\'t match - explicit address param not working as expected');
    return;
  }

  console.log('✅ SUCCESS - backend can reference user\'s Kernel account!');
  console.log('');

  // === STEP 3: Create Kernel client and send UserOp ===
  console.log('=== Step 3: Send attestation UserOp ===');

  const kernelClient = await createKernelAccountClient({
    account: backendKernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  // Encode attestation data
  const contributionData = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      'cyberstorm-dev/didgit',
      'test-' + Date.now(), // unique commit hash
      'cyberstorm-nisto',
      'Test: backend references user Kernel with explicit address',
      BigInt(Math.floor(Date.now() / 1000)),
      IDENTITY_UID
    ]
  );

  console.log('Sending UserOp...');

  try {
    const txHash = await kernelClient.writeContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: 'attest',
      args: [{
        schema: CONTRIBUTION_SCHEMA,
        data: {
          recipient: userKernelAddress,
          expirationTime: 0n,
          revocable: true,
          refUID: IDENTITY_UID,
          data: contributionData,
          value: 0n
        }
      }]
    });

    console.log('TX hash:', txHash);
    console.log('✅ UserOp submitted successfully!');
    console.log('');
    console.log('🎉 This proves the backend can:');
    console.log('   1. Reference user\'s existing Kernel account');
    console.log('   2. Create UserOps for that account');
    console.log('   3. Sign with permission validator (verifier\'s key)');
    console.log('   4. User pays gas (from their Kernel balance)');
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    if (e.message.includes('insufficient funds')) {
      console.log('');
      console.log('💡 User Kernel needs ETH for gas. Fund it first:');
      console.log(`   ${userKernelAddress}`);
    }
  }
}

test().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
