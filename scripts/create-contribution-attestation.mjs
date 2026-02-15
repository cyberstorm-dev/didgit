#!/usr/bin/env node
/**
 * Create a contribution attestation for a GitHub commit
 * Demonstrates the full didgit.dev workflow
 */

import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { createWalletClient, http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';
const MY_IDENTITY_UID = '0xd440aad8b6751a2e1e0d2045a0443e615fec882f92313b793b682f2b546cb109';
const RPC_URL = 'https://sepolia.base.org';
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Commit details
const COMMIT_HASH = '0487a4af5ead01c52ec551c767a72d6b814a3798';
const REPO = 'cyberstorm-dev/didgit';
const AUTHOR = 'loki-cyberstorm';
const MESSAGE = 'feat: add identity binding utility scripts';
const TIMESTAMP = Math.floor(Date.now() / 1000);

async function main() {
  if (!WALLET_PRIVATE_KEY) {
    console.error('❌ WALLET_PRIVATE_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
  console.log('🎭 Creating contribution attestation for Loki\n');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  console.log('📋 Contribution Details:');
  console.log(`  Repo: ${REPO}`);
  console.log(`  Commit: ${COMMIT_HASH}`);
  console.log(`  Author: ${AUTHOR}`);
  console.log(`  Message: ${MESSAGE}`);
  console.log(`  Identity UID: ${MY_IDENTITY_UID}`);
  console.log();

  try {
    // Initialize EAS
    const eas = new EAS(EAS_ADDRESS);
    eas.connect({
      address: account.address,
      signMessage: async (message) => {
        return await account.signMessage({ message });
      },
      sendTransaction: async (tx) => {
        return await walletClient.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gas
        });
      }
    });

    // Encode contribution data
    const schemaEncoder = new SchemaEncoder(
      'string repo,string commitHash,string author,string message,uint64 timestamp,bytes32 identityUid'
    );

    const encodedData = schemaEncoder.encodeData([
      { name: 'repo', value: REPO, type: 'string' },
      { name: 'commitHash', value: COMMIT_HASH, type: 'string' },
      { name: 'author', value: AUTHOR, type: 'string' },
      { name: 'message', value: MESSAGE, type: 'string' },
      { name: 'timestamp', value: TIMESTAMP, type: 'uint64' },
      { name: 'identityUid', value: MY_IDENTITY_UID, type: 'bytes32' }
    ]);

    console.log('📝 Submitting attestation...');

    const tx = await eas.attest({
      schema: CONTRIBUTION_SCHEMA_UID,
      data: {
        recipient: account.address,
        refUID: MY_IDENTITY_UID, // Links to identity
        revocable: true,
        data: encodedData
      }
    });

    console.log(`📤 Transaction: ${tx.tx.hash}`);
    console.log(`🔗 Explorer: https://sepolia.basescan.org/tx/${tx.tx.hash}`);

    const attestationUid = await tx.wait();
    console.log(`\n✅ Attestation created!`);
    console.log(`   UID: ${attestationUid}`);
    console.log(`   View: https://base-sepolia.easscan.org/attestation/view/${attestationUid}`);

    console.log('\n🎉 Contribution attestation complete!');
    console.log('   This commit is now verifiably linked to loki-cyberstorm on-chain.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
