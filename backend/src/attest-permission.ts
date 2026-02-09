#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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

const SCHEMA_UID = '0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6';
const EAS = '0x4200000000000000000000000000000000000021';
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

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
  const USER_KERNEL = (flags['kernel'] || process.env.KERNEL_ADDRESS || process.env.USER_KERNEL || '').trim();
  const PERMISSION_DATA = (flags['permission'] || process.env.PERMISSION_DATA || '').trim();

  if (!PRIVATE_KEY.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');
  if (!USER_KERNEL.startsWith('0x')) throw new Error('USER_KERNEL required (0x-prefixed)');
  if (!PERMISSION_DATA.startsWith('0x')) throw new Error('PERMISSION_DATA required (0x-prefixed)');

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

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
  const log = rc.logs.find((l) => l.topics?.length > 1);
  console.log('UID', log?.topics[1]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
