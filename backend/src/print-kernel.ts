#!/usr/bin/env npx tsx
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

/**
 * Print Kernel address derived from PRIVATE_KEY/USER_PRIVKEY (EOA) on Base Sepolia.
 * Usage:
 *   PRIVATE_KEY=0x... pnpm run kernel:address
 *   # also accepts USER_PRIVKEY for backward compatibility
 * or:
 *   pnpm run kernel:address -- --private-key 0x...
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
  const key = (flags['private-key'] || process.env.PRIVATE_KEY || process.env.USER_PRIVKEY || '').trim();
  if (!key.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');

  const account = privateKeyToAccount(key as `0x${string}`);
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
