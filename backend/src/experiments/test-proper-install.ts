/**
 * Proper permission validator installation using ZeroDev helpers
 * 1. Deploy Kernel with sudo
 * 2. Install permission validator using installValidations
 * 3. Backend uses permission to create attestations
 */

import { 
  createPublicClient, 
  http, 
  type Address, 
  type Hex, 
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  parseEther,
  concatHex,
  concat,
  pad,
  encodeFunctionData,
  zeroAddress,
  toFunctionSelector,
  getAbiItem
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
  const freshUserPrivkey = generatePrivateKey();
  const freshUser = privateKeyToAccount(freshUserPrivkey);
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);

  console.log('=== Proper Permission Validator Installation ===\n');
  console.log('User EOA:', freshUser.address);
  console.log('Verifier:', verifierAccount.address);
  console.log('');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const { toPermissionValidator } = await import('@zerodev/permissions');
  const { toECDSASigner } = await import('@zerodev/permissions/signers');
  const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions/policies');
  const { getEntryPoint, KERNEL_V3_1, VALIDATOR_TYPE } = await import('@zerodev/sdk/constants');
  const { createKernelAccount, createKernelAccountClient, KernelV3AccountAbi } = await import('@zerodev/sdk');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  // Step 1: Deploy Kernel with sudo only
  console.log('Step 1: Deploying Kernel with sudo validator...');

  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: freshUser,
    entryPoint,
    kernelVersion
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: sudoValidator
    }
  });

  const kernelAddress = await kernelAccount.getAddress();
  console.log('Kernel address:', kernelAddress);

  // Fund
  const { createWalletClient } = await import('viem');
  const verifierWallet = createWalletClient({
    account: verifierAccount,
    chain: baseSepolia,
    transport: http()
  });

  const fundHash = await verifierWallet.sendTransaction({
    to: kernelAddress,
    value: parseEther('0.001')
  });

  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log('Funded');

  // Deploy
  const userClient = await createKernelAccountClient({
    account: kernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  const deployHash = await userClient.sendTransaction({
    to: kernelAddress,
    value: 0n,
    data: '0x'
  });

  await publicClient.waitForTransactionReceipt({ hash: deployHash });
  console.log('✅ Deployed');
  console.log('');

  // Step 2: Create permission validator
  console.log('Step 2: Creating permission validator...');

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

  const permissionId = permissionValidator.getIdentifier();
  console.log('Permission ID:', permissionId);

  // Get enable data
  const enableData = await permissionValidator.getEnableData(kernelAddress);
  console.log('Enable data:', enableData.slice(0, 20) + '...');
  console.log('');

  // Step 3: Install permission validator
  console.log('Step 3: Installing permission validator...');

  // Create ValidationId for permission validator (bytes21)
  // Format: VALIDATOR_TYPE.PERMISSION (1 byte) + permissionId (4 bytes) padded to 21 bytes
  const vId = pad(
    concat([VALIDATOR_TYPE.PERMISSION, permissionId]),
    { size: 21, dir: 'right' }
  );
  console.log('ValidationId:', vId);

  // Install validation
  const installData = encodeFunctionData({
    abi: KernelV3AccountAbi,
    functionName: 'installValidations',
    args: [
      [vId], // vIds
      [{ nonce: 1, hook: zeroAddress }], // configs (nonce 1 for permission)
      [enableData], // validationData
      ['0x'] // hookData
    ]
  });

  console.log('Calling installValidations...');

  const installHash = await userClient.sendTransaction({
    to: kernelAddress,
    data: installData,
    value: 0n
  });

  await publicClient.waitForTransactionReceipt({ hash: installHash });
  console.log('✅ Permission validator installed');
  console.log('Note: grantAccess only available in Kernel v3.3+, skipping for v3.1');
  console.log('');

  // Step 4: Backend uses permission validator
  console.log('Step 4: Backend creates attestation with permission...');

  // Backend creates the same permission validator
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

  // Create Kernel account reference using permission validator
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

  // Create attestation
  const contributionData = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      'cyberstorm-dev/didgit',
      'test-proper-install-' + Date.now(),
      'test-user',
      'Test: Permission validator properly installed post-deployment',
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
  console.log('🎉 SUCCESS!');
  console.log('   1. Deployed Kernel with sudo validator');
  console.log('   2. Installed permission validator via installValidations');
  console.log('   3. Backend used permission to create attestation');
  console.log('   4. User paid gas from Kernel balance');
  console.log('   View: https://sepolia.basescan.org/tx/' + txHash);
}

test().catch((e) => {
  console.error('\n❌ Fatal error:', e.message || e);
  console.error(e.stack);
  process.exit(1);
});
