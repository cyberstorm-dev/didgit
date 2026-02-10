#!/usr/bin/env node
/**
 * Bind Loki's identity in the resolver
 * This enables contribution attestations and automatically sets wildcard pattern
 */

import { createWalletClient, http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RESOLVER_ADDRESS = '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c';
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const RPC_URL = 'https://sepolia.base.org';

// My attestation UID from IDENTITY.md
const MY_ATTESTATION_UID = '0xd440aad8b6751a2e1e0d2045a0443e615fec882f92313b793b682f2b546cb109';
const MY_WALLET = '0x7a1de0Fa7242194bbA84E915f39bF7E621B50d2E';
const MY_USERNAME = 'loki-cyberstorm';

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'bindIdentity',
    inputs: [
      { name: 'attestationUid', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'domain', type: 'string' },
      { name: 'username', type: 'string' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getIdentity',
    inputs: [
      { name: 'domain', type: 'string' },
      { name: 'username', type: 'string' }
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'view'
  }
];

async function main() {
  if (!WALLET_PRIVATE_KEY) {
    console.error('❌ WALLET_PRIVATE_KEY not set in environment');
    process.exit(1);
  }

  const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
  console.log(`🎭 Binding identity for: ${account.address}\n`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  console.log('📋 Identity Details:');
  console.log(`  Username: github.com:${MY_USERNAME}`);
  console.log(`  Wallet: ${MY_WALLET}`);
  console.log(`  Attestation UID: ${MY_ATTESTATION_UID}`);
  console.log();

  try {
    console.log('📝 Binding identity in resolver...');
    
    const hash = await walletClient.writeContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_ABI,
      functionName: 'bindIdentity',
      args: [
        MY_ATTESTATION_UID,
        MY_WALLET,
        'github.com',
        MY_USERNAME
      ]
    });

    console.log(`📤 Transaction sent: ${hash}`);
    console.log(`🔗 Explorer: https://sepolia.basescan.org/tx/${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('✅ Identity bound successfully!');
    } else {
      console.log('❌ Transaction failed');
      process.exit(1);
    }

    // Verify binding
    console.log('\n🔍 Verifying binding...');
    
    const boundWallet = await publicClient.readContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_ABI,
      functionName: 'getIdentity',
      args: ['github.com', MY_USERNAME]
    });

    console.log(`  github.com:${MY_USERNAME} -> ${boundWallet}`);
    console.log(`  Match: ${boundWallet.toLowerCase() === MY_WALLET.toLowerCase() ? '✅' : '❌'}`);

    console.log('\n🎉 Done! The */* repository pattern was automatically enabled.');
    console.log('🚀 Loki can now attest contributions to any GitHub repo in any org.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('IDENTITY_TAKEN')) {
      console.log('\n💡 Identity is already bound. Checking current binding...');
      try {
        const boundWallet = await publicClient.readContract({
          address: RESOLVER_ADDRESS,
          abi: RESOLVER_ABI,
          functionName: 'getIdentity',
          args: ['github.com', MY_USERNAME]
        });
        console.log(`  Current binding: github.com:${MY_USERNAME} -> ${boundWallet}`);
      } catch {}
    }
    process.exit(1);
  }
}

main();
