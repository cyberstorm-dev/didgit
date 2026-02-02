/**
 * Test delegated attestation end-to-end
 * 
 * Simulates:
 * 1. User creates Kernel account
 * 2. User funds it with ETH
 * 3. User installs SimpleAllowlistValidator module
 * 4. Backend creates attestation UserOp
 * 5. User's Kernel validates & executes (pays gas)
 */

import { 
  createPublicClient, 
  http, 
  type Address, 
  type Hex, 
  parseAbi,
  encodeFunctionData
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { createDelegatedAttestation } from './attest-delegated';

dotenv.config();

const USER_PRIVKEY = '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7' as Hex; // cyberstorm-nisto testnet key
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;
const VALIDATOR_ADDRESS = '0x42c340f4bb328df1a62d5cea46be973698ae1e37' as Address;
const IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex;

const kernelAbi = parseAbi([
  'function installModule(uint256 moduleType, address module, bytes initData) payable'
]);

async function test() {
  const userAccount = privateKeyToAccount(USER_PRIVKEY);
  console.log('=== Delegated Attestation Test ===\n');
  console.log('User EOA:', userAccount.address);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  // Import ZeroDev
  const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  // Step 1: Create user's Kernel account
  console.log('Step 1: Creating user Kernel account...');
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
  const balance = await publicClient.getBalance({ address: userKernelAddress });
  
  console.log('Deployed:', !!code && code !== '0x');
  console.log('Balance:', balance.toString(), 'wei\n');

  if (!code || code === '0x') {
    console.log('⚠️  Kernel not deployed yet');
    console.log('   Deploying via dummy transaction...\n');

    const userClient = await createKernelAccountClient({
      account: userKernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(BUNDLER_RPC)
    });

    try {
      const deployHash = await userClient.sendTransaction({
        to: userKernelAddress,
        value: 0n,
        data: '0x'
      });
      console.log('Deploy TX:', deployHash);
      await publicClient.waitForTransactionReceipt({ hash: deployHash });
      console.log('✅ Deployed\n');
    } catch (e: any) {
      if (e.message?.includes('insufficient funds')) {
        console.log('❌ User Kernel needs ETH to deploy');
        console.log(`   Send ETH to: ${userKernelAddress}`);
        console.log(`   Faucet: https://www.coinbase.com/faucets/base-sepolia-faucet?address=${userKernelAddress}`);
        process.exit(1);
      }
      throw e;
    }
  }

  if (balance === 0n) {
    console.log('❌ User Kernel needs ETH for gas');
    console.log(`   Send ETH to: ${userKernelAddress}`);
    console.log(`   Faucet: https://www.coinbase.com/faucets/base-sepolia-faucet?address=${userKernelAddress}`);
    process.exit(1);
  }

  // Step 2: Install SimpleAllowlistValidator module
  console.log('Step 2: Installing SimpleAllowlistValidator...');
  console.log('Validator address:', VALIDATOR_ADDRESS);

  const installCallData = encodeFunctionData({
    abi: kernelAbi,
    functionName: 'installModule',
    args: [
      1n, // VALIDATOR type
      VALIDATOR_ADDRESS,
      '0x' as Hex
    ]
  });

  const userClient = await createKernelAccountClient({
    account: userKernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC)
  });

  try {
    console.log('Sending installModule transaction...');
    const installHash = await userClient.sendTransaction({
      to: userKernelAddress,
      data: installCallData,
      value: 0n
    });

    console.log('Install TX:', installHash);
    const installReceipt = await publicClient.waitForTransactionReceipt({ hash: installHash });
    
    if (installReceipt.status === 'success') {
      console.log('✅ Validator installed\n');
    } else {
      throw new Error('Install transaction failed');
    }
  } catch (e: any) {
    console.log('⚠️  Install failed:', e.message);
    if (e.message?.includes('already installed') || e.message?.includes('module exists')) {
      console.log('   (Module may already be installed, continuing...)\n');
    } else {
      throw e;
    }
  }

  // Step 3: Backend creates delegated attestation
  console.log('Step 3: Creating delegated attestation...');
  
  const result = await createDelegatedAttestation({
    userKernelAddress,
    identityAttestationUid: IDENTITY_UID,
    commitHash: 'test-delegated-' + Date.now(),
    repoOwner: 'cyberstorm-dev',
    repoName: 'didgit',
    author: 'cyberstorm-nisto',
    message: 'Test: delegated attestation with user-pays-gas'
  });

  if (result.success) {
    console.log('\n✅ SUCCESS!');
    console.log('   Attestation UID:', result.attestationUid);
    console.log('   TX hash:', result.txHash);
    console.log('   View: https://sepolia.basescan.org/tx/' + result.txHash);
    console.log('');
    console.log('🎉 Delegated attestation works!');
    console.log('   - User\'s Kernel paid gas');
    console.log('   - Backend signed with verifier key');
    console.log('   - SimpleAllowlistValidator authorized the operation');
  } else {
    console.log('\n❌ FAILED');
    console.log('   Error:', result.error);
    process.exit(1);
  }
}

test().catch((e) => {
  console.error('\n❌ Fatal error:', e);
  process.exit(1);
});
