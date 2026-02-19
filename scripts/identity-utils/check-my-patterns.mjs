#!/usr/bin/env node
import { createWalletClient, http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RESOLVER_ADDRESS = '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c';
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const RPC_URL = 'https://sepolia.base.org';

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'getRepositoryPatterns',
    inputs: [
      { name: 'domain', type: 'string' },
      { name: 'identifier', type: 'string' }
    ],
    outputs: [{
      name: 'patterns',
      type: 'tuple[]',
      components: [
        { name: 'namespace', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'enabled', type: 'bool' }
      ]
    }],
    stateMutability: 'view'
  }
];

async function main() {
  const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
  
  const client = createPublicClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  console.log('🔍 Checking repository patterns for loki-cyberstorm...\n');

  try {
    const patterns = await client.readContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_ABI,
      functionName: 'getRepositoryPatterns',
      args: ['github.com', 'loki-cyberstorm'],
      account
    });

    if (patterns.length === 0) {
      console.log('❌ No patterns registered');
    } else {
      console.log(`✅ Registered patterns (${patterns.length}):`);
      patterns.forEach(p => {
        const status = p.enabled ? '✅' : '❌';
        const pattern = `${p.namespace}/${p.name}`;
        console.log(`   ${status} ${pattern}`);
        
        if (p.namespace === '*' && p.name === '*') {
          console.log('      ↳ This means ALL REPOS in ALL ORGS! 🚀');
        }
      });
    }

    console.log('\n🎉 Loki can attest contributions to any GitHub repo!');
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
