#!/usr/bin/env npx tsx
/**
 * Create all EAS schemas in one shot.
 *
 * Required env:
 * - OWNER_PRIVKEY (0x-prefixed)
 * - CHAIN (defaults to base)
 *
 * Optional:
 * - BASE_SCHEMA_REGISTRY_ADDRESS / ARBITRUM_SCHEMA_REGISTRY_ADDRESS (from config)
 * - BASE_*_SCHEMA_UID (if set, will skip registering that schema)
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';

const ACTIVE = getConfig();
const SCHEMA_REGISTRY = ACTIVE.schemaRegistryAddress as Address;

const schemaRegistryAbi = parseAbi([
  'function register(string schema,address resolver,bool revocable) returns (bytes32)',
  'event Registered(bytes32 indexed uid, address indexed registrar, string schema, address resolver, bool revocable)'
]);

type SchemaItem = {
  name: 'IDENTITY' | 'CONTRIBUTION' | 'REPO_GLOBS' | 'PERMISSION';
  envKey: string;
  schema: string;
};

const SCHEMAS: SchemaItem[] = [
  {
    name: 'IDENTITY',
    envKey: 'BASE_IDENTITY_SCHEMA_UID',
    schema: 'string domain,string username,address wallet,string message,bytes signature,string proof_url'
  },
  {
    name: 'CONTRIBUTION',
    envKey: 'BASE_CONTRIBUTION_SCHEMA_UID',
    schema: 'string repo,string commitHash,string author,string message,uint64 timestamp,bytes32 identityUid'
  },
  {
    name: 'REPO_GLOBS',
    envKey: 'BASE_REPO_GLOBS_SCHEMA_UID',
    schema: 'string repoGlobs'
  },
  {
    name: 'PERMISSION',
    envKey: 'BASE_PERMISSION_SCHEMA_UID',
    schema: 'address userKernel,address verifier,address target,bytes4 selector,bytes serializedPermission'
  }
];

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} required (0x-prefixed)`);
  return value;
}

function isUid(value: string | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

async function main() {
  const OWNER_PRIVKEY = requireEnv('OWNER_PRIVKEY', process.env.OWNER_PRIVKEY);
  const account = privateKeyToAccount(OWNER_PRIVKEY as Hex);

  const publicClient = createPublicClient({
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  console.log('[schemas] Chain:', ACTIVE.name, ACTIVE.chainId);
  console.log('[schemas] Registrar:', account.address);
  console.log('[schemas] Registry:', SCHEMA_REGISTRY);
  console.log();

  for (const item of SCHEMAS) {
    const existing = process.env[item.envKey];
    if (isUid(existing)) {
      console.log(`[schemas] ${item.name} already set: ${existing}`);
      continue;
    }

    console.log(`[schemas] Registering ${item.name}...`);
    console.log(`[schemas] Schema: ${item.schema}`);

    const hash = await walletClient.writeContract({
      address: SCHEMA_REGISTRY,
      abi: schemaRegistryAbi,
      functionName: 'register',
      args: [item.schema, '0x0000000000000000000000000000000000000000', true]
    });

    console.log(`[schemas] TX: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const log = receipt.logs.find(l => l.address.toLowerCase() === SCHEMA_REGISTRY.toLowerCase());
    const uid = (log?.topics?.[1] as Hex | undefined) ?? undefined;

    if (!uid || !/^0x[0-9a-fA-F]{64}$/.test(uid)) {
      throw new Error(`Failed to parse ${item.name} schema UID from receipt`);
    }

    console.log(`[schemas] ${item.name} UID: ${uid}`);
    console.log(`[schemas] Export: ${item.envKey}=${uid}`);
    console.log();
  }

  console.log('[schemas] Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
