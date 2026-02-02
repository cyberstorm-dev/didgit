/**
 * Compile SimpleAllowlistValidator.sol and deploy it
 */

import * as fs from 'fs';
import * as path from 'path';
import solc from 'solc';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const VERIFIER_ADDRESS = '0x0CA6A71045C26087F8dCe6d3F93437f31B81C138' as Address;
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;

async function main() {
  console.log('=== Compiling SimpleAllowlistValidator.sol ===\n');

  // Read source
  const sourcePath = path.join(__dirname, 'SimpleAllowlistValidator.sol');
  const source = fs.readFileSync(sourcePath, 'utf-8');

  // Compile
  const input = {
    language: 'Solidity',
    sources: {
      'SimpleAllowlistValidator.sol': {
        content: source
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // Check for errors
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ Compilation errors:');
      errors.forEach((e: any) => console.error(e.formattedMessage));
      process.exit(1);
    }
    
    // Show warnings
    const warnings = output.errors.filter((e: any) => e.severity === 'warning');
    if (warnings.length > 0) {
      console.warn('⚠️  Warnings:');
      warnings.forEach((w: any) => console.warn(w.formattedMessage));
      console.log('');
    }
  }

  const contract = output.contracts['SimpleAllowlistValidator.sol']['SimpleAllowlistValidator'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object as Hex;

  console.log('✅ Compilation successful');
  console.log(`   Bytecode length: ${bytecode.length} chars`);
  console.log('');

  // Save ABI
  const abiPath = path.join(__dirname, 'SimpleAllowlistValidator.abi.json');
  fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  console.log(`💾 ABI saved to: ${abiPath}`);
  console.log('');

  // Deploy
  console.log('=== Deploying to Base Sepolia ===\n');

  if (!VERIFIER_PRIVKEY) {
    throw new Error('VERIFIER_PRIVKEY not set');
  }

  const account = privateKeyToAccount(VERIFIER_PRIVKEY);
  console.log(`Deployer: ${account.address}`);
  console.log(`Constructor args:`);
  console.log(`  verifier: ${VERIFIER_ADDRESS}`);
  console.log(`  easAddress: ${EAS_ADDRESS}`);
  console.log('');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${balance} wei`);
  
  if (balance === 0n) {
    console.error('❌ No ETH for gas! Fund deployer wallet first.');
    process.exit(1);
  }
  
  console.log('');

  // Deploy contract
  console.log('📤 Deploying contract...');
  
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [VERIFIER_ADDRESS, EAS_ADDRESS]
  });

  console.log(`TX hash: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('');
    console.log('✅ Deployment successful!');
    console.log(`   Address: ${receipt.contractAddress}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
    console.log('');
    console.log('🔗 View on Basescan:');
    console.log(`   https://sepolia.basescan.org/address/${receipt.contractAddress}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Update backend with deployed address');
    console.log('   2. User enables this validator on their Kernel account');
    console.log('   3. Backend creates UserOps for user\'s Kernel, signed with verifier key');
  } else {
    console.error('❌ Deployment failed');
    console.error(receipt);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
