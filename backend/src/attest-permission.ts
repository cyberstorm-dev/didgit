#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http, parseEventLogs, getEventSelector } from 'viem';
import { parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';

/**
 * Attest a pre-signed permission blob to EAS (Base Sepolia).
 * Requires:
 *   PRIVATE_KEY   (0x-prefixed EOA — same as your Kernel owner)
 *   USER_KERNEL   (0x-prefixed Kernel address)
 *   PERMISSION_DATA (0x-prefixed bytes from verifier-generated permission)
 *
 * Flags override envs:
 *   --private-key 0x...
 *   --kernel 0x...
 *   --permission 0x...
 */

const ACTIVE = getConfig();
const SCHEMA_UID = ACTIVE.permissionSchemaUid;
const EAS = ACTIVE.easAddress;
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

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

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });
  const publicClient = createPublicClient({ chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });

  const abi = parseAbi([
    'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
  ]);

  const req = {
    schema: SCHEMA_UID,
    data: {
      recipient: USER_KERNEL as `0x${string}`,
      expirationTime: 0n,
      revocable: true,
      refUID: ZERO_UID,
      data: PERMISSION_DATA as `0x${string}`,
      value: 0n,
    },
  };

  console.log('Submitting permission for Kernel:', USER_KERNEL);
  const tx = await walletClient.writeContract({ address: EAS, abi, functionName: 'attest', args: [req] });
  console.log('TX', tx);
  const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
  const uid = extractAttestationUid(rc.logs as any, EAS);
  console.log('UID', uid);
  console.log('Basescan URL:', `${ACTIVE.explorers.basescanTx}/${tx}`);
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
