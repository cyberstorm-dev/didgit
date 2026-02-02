/**
 * Test pure ZeroDev permission approach
 * 
 * User creates Kernel with BOTH:
 * - Sudo validator (their own key)
 * - Permission validator (verifier's key for EAS.attest only)
 * 
 * Both installed at creation time, no custom contract needed.
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

  console.log('=== Pure ZeroDev Permission Test ===\n');
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

  // Step 1: User creates validators
  console.log('Step 1: Creating validators...');

  // User's sudo validator (for user to control their account)
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion
  });

  // Verifier's permission validator (for automated attestations)
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

  console.log('Permission validator ID:', permissionValidator.getIdentifier());
  console.log('');

  // Step 2: Create Kernel with BOTH validators
  console.log('Step 2: Creating Kernel with both validators...');

  const userKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator // Enable permission validator at creation
    }
  });

  const kernelAddress = await userKernelAccount.getAddress();
  console.log('Kernel address:', kernelAddress);

  const balance = await publicClient.getBalance({ address: kernelAddress });
  console.log('Balance:', balance.toString(), 'wei');
  console.log('');

  if (balance === 0n) {
    console.log('❌ Kernel needs funding');
    console.log(`   Send ETH to: ${kernelAddress}`);
    process.exit(1);
  }

  // Step 3: Deploy Kernel (if not deployed)
  const code = await publicClient.getBytecode({ address: kernelAddress });
  if (!code || code === '0x') {
    console.log('Step 3: Deploying Kernel...');
    const userClient = await createKernelAccountClient({
      account: userKernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(BUNDLER_RPC)
    });

    const deployHash = await userClient.sendTransaction({
      to: kernelAddress,
      value: 0n,
      data: '0x'
    });

    console.log('Deploy TX:', deployHash);
    await publicClient.waitForTransactionReceipt({ hash: deployHash });
    console.log('✅ Deployed');
    console.log('');
  } else {
    console.log('Step 3: Kernel already deployed');
    console.log('');
  }

  // Step 4: Backend creates attestation using permission validator
  console.log('Step 4: Backend creates attestation...');

  // Backend recreates the SAME permission validator
  const backendVerifierSigner = await toECDSASigner({
    signer: verifierAccount
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

  // Create Kernel account reference WITH permission validator
  const backendKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    address: kernelAddress, // Reference existing account
    plugins: {
      sudo: backendPermissionValidator // Use permission validator for signing
    }
  });

  const derivedAddress = await backendKernelAccount.getAddress();
  console.log('Backend derived address:', derivedAddress);
  console.log('Matches?', derivedAddress === kernelAddress);
  console.log('');

  if (derivedAddress !== kernelAddress) {
    console.log('❌ Address mismatch - this approach may not work');
    process.exit(1);
  }

  // Create client
  const backendClient = await createKernelAccountClient({
    account: backendKernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  // Encode attestation data
  const contributionData = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      'cyberstorm-dev/didgit',
      'test-pure-zerodev-' + Date.now(),
      'cyberstorm-nisto',
      'Test: pure ZeroDev permission without custom contract',
      BigInt(Math.floor(Date.now() / 1000)),
      IDENTITY_UID
    ]
  );

  console.log('Sending attestation UserOp...');

  try {
    const txHash = await backendClient.writeContract({
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
    console.log('');
    console.log('✅ SUCCESS!');
    console.log('   Pure ZeroDev permission approach works!');
    console.log('   No custom contract needed');
    console.log('   View: https://sepolia.basescan.org/tx/' + txHash);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    if (e.message?.includes('simulation')) {
      console.log('');
      console.log('Permission validator not recognized by Kernel');
      console.log('May need to use custom module approach instead');
    }
  }
}

test().catch((e) => {
  console.error('\n❌ Fatal error:', e);
  process.exit(1);
});
