#!/usr/bin/env node
/**
 * Create a contribution attestation using viem directly
 */

import { createWalletClient, http, createPublicClient, encodeAbiParameters, parseAbiParameters } from 'viem';
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
const TIMESTAMP = BigInt(Math.floor(Date.now() / 1000));

const EAS_ABI = [
  {
    type: 'function',
    name: 'attest',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'schema', type: 'bytes32' },
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'expirationTime', type: 'uint64' },
              { name: 'revocable', type: 'bool' },
              { name: 'refUID', type: 'bytes32' },
              { name: 'data', type: 'bytes' },
              { name: 'value', type: 'uint256' }
            ]
          }
        ]
      }
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'payable'
  }
];

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
    // Encode contribution data
    const encodedData = encodeAbiParameters(
      parseAbiParameters('string repo, string commitHash, string author, string message, uint64 timestamp, bytes32 identityUid'),
      [REPO, COMMIT_HASH, AUTHOR, MESSAGE, TIMESTAMP, MY_IDENTITY_UID]
    );

    console.log('📝 Submitting attestation...');

    const hash = await walletClient.writeContract({
      address: EAS_ADDRESS,
      abi: EAS_ABI,
      functionName: 'attest',
      args: [
        {
          schema: CONTRIBUTION_SCHEMA_UID,
          data: {
            recipient: account.address,
            expirationTime: 0n, // No expiration
            revocable: true,
            refUID: MY_IDENTITY_UID, // Links to identity
            data: encodedData,
            value: 0n
          }
        }
      ]
    });

    console.log(`📤 Transaction sent: ${hash}`);
    console.log(`🔗 Explorer: https://sepolia.basescan.org/tx/${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      // Extract attestation UID from logs
      const attestationUid = receipt.logs[0]?.topics[1]; // First log topic after event signature

      console.log(`\n✅ Attestation created!`);
      if (attestationUid) {
        console.log(`   UID: ${attestationUid}`);
        console.log(`   View: https://base-sepolia.easscan.org/attestation/view/${attestationUid}`);
      }

      console.log('\n🎉 Contribution attestation complete!');
      console.log(`   Commit ${COMMIT_HASH.substring(0, 8)} is now verifiably linked to ${AUTHOR} on-chain.`);
      console.log(`   Query it via:`);
      console.log(`   - EAS Explorer: https://base-sepolia.easscan.org/`);
      console.log(`   - GraphQL: Filter by refUID = ${MY_IDENTITY_UID}`);
    } else {
      console.log('❌ Transaction failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
