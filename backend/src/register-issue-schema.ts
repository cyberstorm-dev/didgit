#!/usr/bin/env node
/**
 * Register the Issue Attestation Schema on Base Sepolia
 * 
 * Run once to create the schema, then update issue-constants.ts with the UID
 */

import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SCHEMA_REGISTRY = '0x4200000000000000000000000000000000000020' as Address;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as Hex;

const schemaRegistryAbi = parseAbi([
  'function register(string schema, address resolver, bool revocable) returns (bytes32)'
]);

async function main() {
  if (!WALLET_PRIVATE_KEY) {
    console.error('❌ WALLET_PRIVATE_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
  });

  // Issue attestation schema - simplified MVP (single attestation per issue when opened)
  const schema = 'string repo,uint64 issueNumber,string author,string title,string labels,uint64 timestamp,bytes32 identityUid';
  
  console.log('🔧 Registering Issue Attestation Schema');
  console.log('📋 Schema:', schema);
  console.log('👤 From:', account.address);
  console.log();
  
  const registerHash = await walletClient.writeContract({
    address: SCHEMA_REGISTRY,
    abi: schemaRegistryAbi,
    functionName: 'register',
    args: [schema, '0x0000000000000000000000000000000000000000', true]
  });
  
  console.log('📤 Transaction sent:', registerHash);
  console.log('🔗 Explorer: https://sepolia.basescan.org/tx/' + registerHash);
  console.log();
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
  
  if (receipt.status === 'success') {
    console.log('✅ Schema registered successfully!');
    
    // Parse schema UID from logs
    const schemaUid = receipt.logs[0]?.topics[1] as Hex;
    
    console.log();
    console.log('📝 Schema UID:', schemaUid);
    console.log('🔗 View: https://base-sepolia.easscan.org/schema/view/' + schemaUid);
    console.log();
    console.log('✏️  Next steps:');
    console.log('   1. Update backend/src/issue-constants.ts with this schema UID');
    console.log('   2. Run npm run build to compile');
    console.log('   3. Create test issue attestation');
  } else {
    console.log('❌ Transaction failed');
    process.exit(1);
  }
}

main().catch(console.error);
