#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/*
 * Identity attestation helper (Base Sepolia)
 * Usage (env or flags):
 *   PRIVATE_KEY=0x... GITHUB_USERNAME=alice WALLET_ADDRESS=0x... SIGNATURE=0x... GIST_URL=https://gist... \
 *   pnpm run attest:identity
 *
 * Flags override envs:
 *   --private-key 0x...
 *   --username alice
 *   --wallet 0x...
 *   --signature 0x...
 *   --proof-url https://gist...
 */

const EAS = '0x4200000000000000000000000000000000000021';
const SCHEMA = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';

// Minimal flag parser
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

async function main() {
  const flags = parseArgs();

  const PRIVATE_KEY = (flags['private-key'] || process.env.PRIVATE_KEY || '').trim();
  const GITHUB_USERNAME = (flags['username'] || process.env.GITHUB_USERNAME || '').trim();
  const WALLET_ADDRESS = (flags['wallet'] || process.env.WALLET_ADDRESS || '').trim();
  const SIGNATURE = (flags['signature'] || process.env.SIGNATURE || '').trim();
  const GIST_URL = (flags['proof-url'] || process.env.GIST_URL || '').trim();

  if (!PRIVATE_KEY.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');
  if (!GITHUB_USERNAME) throw new Error('GITHUB_USERNAME required');
  if (!WALLET_ADDRESS.startsWith('0x')) throw new Error('WALLET_ADDRESS required (0x-prefixed)');
  if (!SIGNATURE.startsWith('0x')) throw new Error('SIGNATURE required (0x-prefixed)');
  if (!GIST_URL) throw new Error('GIST_URL required');

  console.log('Submitting identity attestation for', GITHUB_USERNAME, '→', WALLET_ADDRESS);
  console.log('Proof:', GIST_URL);

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http('https://sepolia.base.org') });

  const data = encodeAbiParameters(
    parseAbiParameters('string domain,string username,address wallet,string message,bytes signature,string proof_url'),
    [
      'github.com',
      GITHUB_USERNAME,
      WALLET_ADDRESS as `0x${string}`,
      `github.com:${GITHUB_USERNAME}`,
      SIGNATURE as `0x${string}`,
      GIST_URL
    ]
  );

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
  }];

  const req = {
    schema: SCHEMA,
    data: {
      recipient: WALLET_ADDRESS as `0x${string}`,
      expirationTime: 0n,
      revocable: true,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      value: 0n
    }
  };

  const tx = await walletClient.writeContract({ address: EAS, abi: easAbi, functionName: 'attest', args: [req] });
  console.log('TX:', tx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  const log = receipt.logs.find((l) => l.topics?.length > 1);
  const uid = log?.topics[1];
  console.log('UID:', uid);
  if (tx) console.log('BaseScan:', `https://sepolia.basescan.org/tx/${tx}`);
  if (uid) console.log('EASscan:', `https://base-sepolia.easscan.org/attestation/view/${uid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
