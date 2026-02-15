#!/usr/bin/env node
/**
 * Create an issue attestation
 * 
 * Usage:
 *   node attest-issue.mjs --repo owner/name --issue 19
 */

import { createWalletClient, http, createPublicClient, encodeAbiParameters, parseAbiParameters } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Octokit } from '@octokit/rest';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const ISSUE_SCHEMA_UID = '0x56dcaaecb00e7841a4271d792e4e6a724782b880441adfa159aa06fa1cfda9cc';
const MY_IDENTITY_UID = '0xd440aad8b6751a2e1e0d2045a0443e615fec882f92313b793b682f2b546cb109';
const RPC_URL = 'https://sepolia.base.org';
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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

async function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      parsed[key] = args[i + 1];
      i++;
    }
  }
  
  if (!parsed.repo || !parsed.issue) {
    console.error('Usage: node attest-issue.mjs --repo owner/name --issue NUMBER');
    process.exit(1);
  }
  
  const [owner, name] = parsed.repo.split('/');
  if (!owner || !name) {
    console.error('❌ Invalid repo format. Use: owner/name');
    process.exit(1);
  }
  
  return {
    owner,
    name,
    issueNumber: parseInt(parsed.issue, 10)
  };
}

async function fetchIssue(owner, name, issueNumber) {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  
  try {
    const { data: issue } = await octokit.issues.get({
      owner,
      repo: name,
      issue_number: issueNumber
    });
    
    if (issue.pull_request) {
      throw new Error('This is a pull request, not an issue');
    }
    
    return {
      number: issue.number,
      title: issue.title,
      author: issue.user?.login || '',
      state: issue.state,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || '').filter(Boolean),
      createdAt: issue.created_at
    };
  } catch (e) {
    console.error('❌ Failed to fetch issue:', e.message);
    process.exit(1);
  }
}

async function main() {
  if (!WALLET_PRIVATE_KEY) {
    console.error('❌ WALLET_PRIVATE_KEY not set');
    process.exit(1);
  }
  
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN not set');
    process.exit(1);
  }

  const { owner, name, issueNumber } = await parseArgs();
  
  const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
  console.log('🎭 Creating issue attestation for Loki\n');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  // Fetch issue from GitHub
  console.log(`🔍 Fetching issue #${issueNumber} from ${owner}/${name}...`);
  const issue = await fetchIssue(owner, name, issueNumber);
  
  console.log();
  console.log('📋 Issue Details:');
  console.log(`  Repo: ${owner}/${name}`);
  console.log(`  Issue: #${issue.number}`);
  console.log(`  Title: ${issue.title}`);
  console.log(`  Author: ${issue.author}`);
  console.log(`  State: ${issue.state}`);
  console.log(`  Labels: ${issue.labels.join(', ') || 'none'}`);
  console.log(`  Created: ${issue.createdAt}`);
  console.log(`  Identity UID: ${MY_IDENTITY_UID}`);
  console.log();

  // Check if author matches
  if (issue.author.toLowerCase() !== 'loki-cyberstorm') {
    console.log(`⚠️  Warning: Issue author (${issue.author}) does not match identity (loki-cyberstorm)`);
    console.log('   Proceeding anyway for testing purposes...\n');
  }

  try {
    // Encode issue data
    const encodedData = encodeAbiParameters(
      parseAbiParameters('string repo, uint64 issueNumber, string author, string title, string labels, uint64 timestamp, bytes32 identityUid'),
      [
        `${owner}/${name}`,
        BigInt(issue.number),
        issue.author,
        issue.title.substring(0, 200), // Truncate to 200 chars
        issue.labels.join(','),
        BigInt(Math.floor(new Date(issue.createdAt).getTime() / 1000)),
        MY_IDENTITY_UID
      ]
    );

    console.log('📝 Submitting attestation...');

    const hash = await walletClient.writeContract({
      address: EAS_ADDRESS,
      abi: EAS_ABI,
      functionName: 'attest',
      args: [
        {
          schema: ISSUE_SCHEMA_UID,
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

      console.log('\n🎉 Issue attestation complete!');
      console.log(`   Issue #${issue.number} is now verifiably linked to ${issue.author} on-chain.`);
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
