#!/usr/bin/env npx tsx
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

/**
 * Print Kernel address derived from USER_PRIVKEY (EOA) on Base Sepolia.
 * Usage:
 *   USER_PRIVKEY=0x... pnpm run kernel:address
 * or:
 *   pnpm run kernel:address -- --user-privkey 0x...
 */

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
  const USER_PRIVKEY = (flags['user-privkey'] || process.env.USER_PRIVKEY || '').trim();
  if (!USER_PRIVKEY.startsWith('0x')) throw new Error('USER_PRIVKEY required (0x-prefixed)');

  const account = privateKeyToAccount(USER_PRIVKEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const entryPoint = getEntryPoint('0.7');
  const ecdsa = await signerToEcdsaValidator(publicClient, { signer: account, entryPoint, kernelVersion: KERNEL_V3_1 });
  const kernel = await createKernelAccount(publicClient, { plugins: { sudo: ecdsa }, entryPoint, kernelVersion: KERNEL_V3_1 });

  console.log('EOA:', account.address);
  console.log('Kernel:', kernel.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
