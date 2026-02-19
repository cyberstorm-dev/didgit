#!/usr/bin/env node
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const RESOLVER_ADDRESS = '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c';
const RPC_URL = 'https://sepolia.base.org';
const MY_WALLET = '0x7a1de0Fa7242194bbA84E915f39bF7E621B50d2E';

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'getIdentityOwner',
    inputs: [
      { name: 'domain', type: 'string' },
      { name: 'identifier', type: 'string' }
    ],
    outputs: [{ name: 'owner', type: 'address' }],
    stateMutability: 'view'
  },
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
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL)
  });

  console.log('🔍 Verifying identity binding...\n');

  try {
    const owner = await client.readContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_ABI,
      functionName: 'getIdentityOwner',
      args: ['github.com', 'loki-cyberstorm']
    });

    console.log(`✅ Identity bound:`);
    console.log(`   github.com:loki-cyberstorm -> ${owner}`);
    console.log(`   Expected: ${MY_WALLET}`);
    console.log(`   Match: ${owner.toLowerCase() === MY_WALLET.toLowerCase() ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`❌ getIdentityOwner failed: ${error.message}`);
    process.exit(1);
  }

  console.log();

  try {
    const patterns = await client.readContract({
      address: RESOLVER_ADDRESS,
      abi: RESOLVER_ABI,
      functionName: 'getRepositoryPatterns',
      args: ['github.com', 'loki-cyberstorm']
    });

    console.log(`✅ Repository patterns:`);
    patterns.forEach(p => {
      const status = p.enabled ? '✅' : '❌';
      console.log(`   ${status} ${p.namespace}/${p.name}`);
    });

    console.log('\n🎉 Success! Loki can now attest contributions to registered repos.');
  } catch (error) {
    console.log(`❌ getRepositoryPatterns failed: ${error.message}`);
  }
}

main();
