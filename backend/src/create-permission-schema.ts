/**
 * Create EAS schema for Session Key Permissions
 * 
 * Run once to create the schema, then use the UID in setup-permission.ts
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';
import { getAttesterPrivKey } from './env';

const ACTIVE = getConfig();
const SCHEMA_REGISTRY = ACTIVE.schemaRegistryAddress;

const schemaRegistryAbi = [
  {
    name: 'register',
    type: 'function',
    inputs: [
      { name: 'schema', type: 'string' },
      { name: 'resolver', type: 'address' },
      { name: 'revocable', type: 'bool' }
    ],
    outputs: [{ name: '', type: 'bytes32' }]
  }
] as const;

async function main() {
  const ATTESTER_PRIVKEY = getAttesterPrivKey() as Hex;
  const account = privateKeyToAccount(ATTESTER_PRIVKEY);
  
  const publicClient = createPublicClient({
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  // Schema (legacy field name): userKernel, verifier (attester), target, selector, serializedPermission
  const schema = 'address userKernel,address verifier,address target,bytes4 selector,bytes serializedPermission';

  console.log('Registering schema:', schema);
  console.log('From:', account.address);

  const hash = await walletClient.writeContract({
    address: SCHEMA_REGISTRY,
    abi: schemaRegistryAbi,
    functionName: 'register',
    args: [schema, '0x0000000000000000000000000000000000000000', true]
  });

  console.log('TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Block:', receipt.blockNumber);

  // The schema UID is in the logs
  // For now, check on basescan or EAS explorer
  console.log('\nCheck EAS explorer for schema UID');
  console.log(`${ACTIVE.explorers.easAddress}/${account.address}`);
}

main().catch(console.error);
