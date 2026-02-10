#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http, parseEventLogs, getEventSelector } from 'viem';
import { parseAbi } from 'viem';
import type { Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';

/**
 * Attest a pre-signed permission blob to EAS (Base Sepolia).
 * Requires:
 *   PRIVATE_KEY   (0x-prefixed EOA — same as your Kernel owner)
 *   USER_KERNEL   (0x-prefixed Kernel address)
 *   PERMISSION_DATA (0x-prefixed bytes from attester-generated permission)
 *
 * Flags override envs:
 *   --private-key 0x...
 *   --kernel 0x...
 *   --permission 0x...
 */

const ACTIVE = getConfig();
const SCHEMA_UID = ACTIVE.permissionSchemaUid as Hex;
const EAS = ACTIVE.easAddress as Address;
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';
const EMPTY_UID = ZERO_UID;

const easRegistryAbi = parseAbi([
  'function getSchemaRegistry() view returns (address)'
]);

const schemaRegistryAbi = parseAbi([
  'function getSchema(bytes32 uid) view returns ((bytes32,address,bool,string))'
]);

const EAS_ERROR_SELECTORS: Record<string, string> = {
  '0xbf37b20e': 'InvalidSchema()',
  '0x05d2aee8': 'NotPayable()',
  '0x587bb4b3': 'Irrevocable()',
  '0xcaa61f11': 'InsufficientValue()',
  '0x0cf5cbe4': 'InvalidExpirationTime()',
  '0x3caccd13': 'InvalidAttestation()',
  '0x3aa8e7c3': 'AccessDenied()',
  '0x539ef336': 'InvalidLength()'
};

function extractRevertSelector(err: any): string | undefined {
  const candidates = [
    err?.signature,
    err?.cause?.signature,
    err?.data,
    err?.cause?.data,
    err?.cause?.raw,
    err?.raw
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.startsWith('0x') && value.length >= 10) {
      return value.slice(0, 10);
    }
  }
  return undefined;
}

async function assertSchemaExists(publicClient: any, schemaUid: Hex) {
  console.log('[permission] RPC:', ACTIVE.rpcUrl);
  console.log('[permission] Permission schema UID:', schemaUid);
  const schemaRegistry = await publicClient.readContract({
    address: EAS,
    abi: easRegistryAbi,
    functionName: 'getSchemaRegistry'
  }) as Address;

  const record = await publicClient.readContract({
    address: schemaRegistry,
    abi: schemaRegistryAbi,
    functionName: 'getSchema',
    args: [schemaUid]
  }) as [Hex, Address, boolean, string] | { uid: Hex; resolver: Address; revocable: boolean; schema: string };

  const uid = Array.isArray(record) ? record[0] : record?.uid;
  console.log('[permission] Schema record:', record);
  if (!uid || uid.toLowerCase() === EMPTY_UID.toLowerCase()) {
    const chainId = await publicClient.getChainId();
    throw new Error(
      `Schema not found on chain ${chainId}. Check BASE_PERMISSION_SCHEMA_UID and register schemas on this chain.`
    );
  }
}

export function extractAttestationUid(
  logs: Array<{ address?: string; topics?: string[]; data?: string }>,
  easAddress: string
) {
  const attestedIndexedUidTopic0 = getEventSelector('Attested(bytes32,address,address,bytes32)');
  const attestedDataUidTopic0 = getEventSelector('Attested(address,address,bytes32,bytes32)');
  const attestedIndexedUidAbi = [{
    name: 'Attested',
    type: 'event',
    inputs: [
      { name: 'uid', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'attester', type: 'address', indexed: true },
      { name: 'schema', type: 'bytes32', indexed: false }
    ]
  }] as const;
  const attestedDataUidAbi = [{
    name: 'Attested',
    type: 'event',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'attester', type: 'address', indexed: true },
      { name: 'schema', type: 'bytes32', indexed: true },
      { name: 'uid', type: 'bytes32', indexed: false }
    ]
  }] as const;

  try {
    const parsed = parseEventLogs({ abi: attestedIndexedUidAbi, logs: logs as any, eventName: 'Attested' });
    const uid = parsed[0]?.args?.uid as string | undefined;
    if (uid) return uid;
  } catch {
    // fall through
  }

  try {
    const parsed = parseEventLogs({ abi: attestedDataUidAbi, logs: logs as any, eventName: 'Attested' });
    const uid = parsed[0]?.args?.uid as string | undefined;
    if (uid) return uid;
  } catch {
    // fall through
  }

  const match = logs.find(
    (l) =>
      l.address?.toLowerCase() === easAddress.toLowerCase() &&
      Array.isArray(l.topics) &&
      l.topics.length > 1 &&
      (
        l.topics[0]?.toLowerCase() === attestedIndexedUidTopic0.toLowerCase() ||
        l.topics[0]?.toLowerCase() === attestedDataUidTopic0.toLowerCase()
      )
  );
  if (!match) return undefined;
  if (match.topics?.[0]?.toLowerCase() === attestedIndexedUidTopic0.toLowerCase()) {
    return match.topics?.[1];
  }
  if (match.data && match.data.length >= 66) {
    return `0x${match.data.slice(2, 66)}`;
  }
  return undefined;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.replace(/^--/, '');
    const val = args[i + 1];
    if (val && !val.startsWith('--')) {
      out[key] = val;
      i++;
    }
  }
  return out;
}

export async function attestPermission(input: {
  privateKey: string;
  kernelAddress: string;
  permissionData: string;
}) {
  const PRIVATE_KEY = input.privateKey.trim();
  const USER_KERNEL = input.kernelAddress.trim();
  const PERMISSION_DATA = input.permissionData.trim();

  if (!PRIVATE_KEY.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');
  if (!USER_KERNEL.startsWith('0x')) throw new Error('USER_KERNEL required (0x-prefixed)');
  if (!PERMISSION_DATA.startsWith('0x')) throw new Error('PERMISSION_DATA required (0x-prefixed)');
  if (!/^0x[0-9a-fA-F]{64}$/.test(SCHEMA_UID)) throw new Error('permission schema UID must be 32-byte hex');

  const account = privateKeyToAccount(PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({ account, chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });
  const publicClient = createPublicClient({ chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });

  await assertSchemaExists(publicClient, SCHEMA_UID);

  const abi = parseAbi([
    'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
  ]);

  const req = {
    schema: SCHEMA_UID,
    data: {
      recipient: USER_KERNEL as Address,
      expirationTime: 0n,
      revocable: true,
      refUID: ZERO_UID as Hex,
      data: PERMISSION_DATA as Hex,
      value: 0n,
    },
  };

  console.log('Submitting permission for Kernel:', USER_KERNEL);
  let tx: `0x${string}`;
  try {
    tx = await walletClient.writeContract({ address: EAS, abi, functionName: 'attest', args: [req] });
  } catch (err: any) {
    const selector = extractRevertSelector(err);
    if (selector && EAS_ERROR_SELECTORS[selector]) {
      console.error('EAS revert:', EAS_ERROR_SELECTORS[selector]);
      if (selector === '0xbf37b20e') {
        console.error('Hint: permission schema UID is missing on this chain or wrong.');
      }
    }
    throw err;
  }
  console.log('TX', tx);
  const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
  const uid = extractAttestationUid(rc.logs as any, EAS);
  console.log('UID', uid);
  console.log('Basescan URL:', `${ACTIVE.explorers.tx}/${tx}`);
  if (uid) {
    console.log('EASscan URL:', `${ACTIVE.explorers.easAttestation}/${uid}`);
  }
  console.log('EASscan Address:', `${ACTIVE.explorers.easAddress}/${USER_KERNEL}`);
}

async function main() {
  const flags = parseArgs();
  const PRIVATE_KEY = (flags['private-key'] || process.env.PRIVATE_KEY || '').trim();
  const USER_KERNEL = (flags['kernel'] || process.env.KERNEL_ADDRESS || process.env.USER_KERNEL || '').trim();
  const PERMISSION_DATA = (flags['permission'] || process.env.PERMISSION_DATA || '').trim();

  await attestPermission({
    privateKey: PRIVATE_KEY,
    kernelAddress: USER_KERNEL,
    permissionData: PERMISSION_DATA
  });
}

const isMain = process.argv[1] && /attest-permission\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
