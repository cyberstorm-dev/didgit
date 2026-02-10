#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';
import { extractAttestationUid } from './attest-permission';

const ACTIVE = getConfig();
const EAS = ACTIVE.easAddress;
const REPO_GLOBS_SCHEMA_UID = ACTIVE.repoGlobsSchemaUid;
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function buildRepoGlobsData(globs: string[]) {
  const joined = globs.map((g) => g.trim()).filter(Boolean).join(',');
  return encodeAbiParameters(parseAbiParameters('string'), [joined]);
}

function parseGlobs(input: string): string[] {
  const globs = input
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  const invalid = globs.filter((g) => g.startsWith('*/'));
  if (invalid.length > 0) {
    throw new Error(`Invalid repo globs (no */ prefix allowed): ${invalid.join(', ')}`);
  }
  return globs;
}

async function main() {
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || '').trim();
  const IDENTITY_UID = (process.env.IDENTITY_UID || '').trim();
  const REPO_GLOBS = (process.env.REPO_GLOBS || process.env.REPO_GLOB || process.env.PATTERN || '').trim();

  if (!PRIVATE_KEY.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');
  if (!IDENTITY_UID.startsWith('0x')) throw new Error('IDENTITY_UID required (0x-prefixed)');
  if (!REPO_GLOBS) throw new Error('REPO_GLOBS required (comma-separated)');

  const globs = parseGlobs(REPO_GLOBS);
  if (globs.length === 0) throw new Error('REPO_GLOBS required (non-empty)');

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });
  const publicClient = createPublicClient({ chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });

  const data = buildRepoGlobsData(globs);

  const easAbi = [{
    name: 'attest',
    type: 'function',
    inputs: [{ name: 'request', type: 'tuple', components: [
      { name: 'schema', type: 'bytes32' },
      { name: 'data', type: 'tuple', components: [
        { name: 'recipient', type: 'address' },
        { name: 'expirationTime', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'uint256' }
      ]}
    ]}],
    outputs: [{ name: '', type: 'bytes32' }]
  }] as const;

  const req = {
    schema: REPO_GLOBS_SCHEMA_UID as `0x${string}`,
    data: {
      recipient: account.address,
      expirationTime: 0n,
      revocable: true,
      refUID: IDENTITY_UID as `0x${string}`,
      data,
      value: 0n
    }
  };

  console.log('Registering repo globs:', globs.join(', '));
  console.log('Identity UID:', IDENTITY_UID);
  const tx = await walletClient.writeContract({ address: EAS as `0x${string}`, abi: easAbi, functionName: 'attest', args: [req] });
  console.log('TX', tx);
  const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
  const uid = extractAttestationUid(rc.logs as any, EAS);
  console.log('UID', uid);
  console.log('Basescan URL:', `${ACTIVE.explorers.tx}/${tx}`);
  if (uid) {
    console.log('EASscan URL:', `${ACTIVE.explorers.easAttestation}/${uid}`);
  }
  console.log('EASscan Address:', `${ACTIVE.explorers.easAddress}/${account.address}`);
}

const isMain = process.argv[1] && /attest-repo-globs\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
