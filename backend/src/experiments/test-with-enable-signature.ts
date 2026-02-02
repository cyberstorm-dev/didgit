/**
 * Test with proper plugin enable signature
 * The sudo validator must sign to enable the regular (permission) validator
 */

import { 
  createPublicClient, 
  http, 
  type Address, 
  type Hex, 
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  parseEther
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex;

async function test() {
  // Generate fresh test user
  const freshUserPrivkey = generatePrivateKey();
  const freshUser = privateKeyToAccount(freshUserPrivkey);
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);

  console.log('=== Test with Plugin Enable Signature ===\n');
  console.log('Fresh user EOA:', freshUser.address);
  console.log('Verifier:', verifierAccount.address);
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

  console.log('Step 1: Creating validators...');

  // User's sudo validator
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: freshUser,
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

  console.log('Permission validator ID:', permissionValidator.getIdentifier());
  console.log('');

  // Create Kernel with both validators - SDK will handle enable signature
  console.log('Step 2: Creating Kernel with both validators...');

  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator
    }
  });

  const kernelAddress = await kernelAccount.getAddress();
  console.log('Kernel address:', kernelAddress);
  console.log('');

  // Fund it
  console.log('Step 3: Funding Kernel...');
  const { createWalletClient } = await import('viem');
  const verifierWallet = createWalletClient({
    account: verifierAccount,
    chain: baseSepolia,
    transport: http()
  });

  const fundHash = await verifierWallet.sendTransaction({
    to: kernelAddress,
    value: parseEther('0.002')
  });

  console.log('Fund TX:', fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  
  const balance = await publicClient.getBalance({ address: kernelAddress });
  console.log('Balance:', balance.toString(), 'wei');
  console.log('');

  // Deploy Kernel
  console.log('Step 4: Deploying Kernel...');
  const userClient = await createKernelAccountClient({
    account: kernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  try {
    const deployHash = await userClient.sendTransaction({
      to: kernelAddress,
      value: 0n,
      data: '0x'
    });

    console.log('Deploy TX:', deployHash);
    await publicClient.waitForTransactionReceipt({ hash: deployHash });
    console.log('✅ Deployed');
    console.log('');
  } catch (e: any) {
    console.error('❌ Deploy failed:', e.message);
    throw e;
  }

  // Backend creates attestation
  console.log('Step 5: Backend creates attestation...');
  
  // Backend recreates permission validator
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

  // Reference existing Kernel
  const backendKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    address: kernelAddress,
    plugins: {
      sudo: backendPermissionValidator
    }
  });

  const backendClient = await createKernelAccountClient({
    account: backendKernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  // Encode attestation
  const contributionData = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      'cyberstorm-dev/didgit',
      'test-enable-sig-' + Date.now(),
      'test-user',
      'Test: Kernel with proper plugin enable signature',
      BigInt(Math.floor(Date.now() / 1000)),
      IDENTITY_UID
    ]
  );

  console.log('Sending attestation UserOp...');

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
  console.log('   User-pays-gas delegated attestation works!');
  console.log('   SDK handled plugin enable signature automatically');
  console.log('   Kernel deployed with both validators');
  console.log('   Backend used permission to create attestation');
  console.log('   User paid gas from their balance');
  console.log('   View: https://sepolia.basescan.org/tx/' + txHash);
}

test().catch((e) => {
  console.error('\n❌ Fatal error:', e.message || e);
  console.error(e.stack);
  process.exit(1);
});
