/**
 * Deploy Kernel with sudo validator, THEN add permission validator
 * This avoids the deployment signature issue
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

  console.log('=== Deploy Then Add Permission Test ===\n');
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

  // Step 1: Create Kernel with ONLY sudo validator
  console.log('Step 1: Creating Kernel with sudo validator only...');

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
  console.log('');

  // Step 2: Fund Kernel
  console.log('Step 2: Funding Kernel...');
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

  // Step 3: Deploy Kernel (with sudo validator only)
  console.log('Step 3: Deploying Kernel...');
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

  console.log('Deploy TX:', deployHash);
  await publicClient.waitForTransactionReceipt({ hash: deployHash });
  console.log('✅ Kernel deployed with sudo validator');
  console.log('');

  // Step 4: Add permission validator
  console.log('Step 4: Adding permission validator...');

  // Create permission validator
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

  // Get enable data
  const enableData = await permissionValidator.getEnableData(kernelAddress);
  console.log('Enable data length:', enableData.length);

  // Install the permission validator on the Kernel
  // This requires calling installValidations on the Kernel contract
  const kernelAbi = parseAbi([
    'function installValidations(bytes21[] vIds, tuple(uint32 nonce, address hook)[] configs, bytes[] validationData, bytes[] hookData) payable'
  ]);

  // TODO: Construct the proper installValidations call
  // For now, let's see if ZeroDev SDK has a helper for this
  
  console.log('⚠️  Need to call installValidations on Kernel to add permission validator');
  console.log('   This requires understanding the ValidationId format (bytes21)');
  console.log('   And constructing the proper ValidationConfig');
  console.log('');
  console.log('This approach needs more research into Kernel v3 validation installation.');
}

test().catch((e) => {
  console.error('\n❌ Fatal error:', e.message || e);
  process.exit(1);
});
