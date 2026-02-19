#!/usr/bin/env node
import {
  createPublicResolverClient,
  formatPatterns,
  parseCliArgs,
  readIdentity,
  validateAddress,
  validateDomain,
  validateRpcUrl,
  validateUsername,
} from './lib.js';
import { DEFAULT_RESOLVER_ADDRESS, DEFAULT_RPC_URL } from './shared.js';

async function main() {
  const args = parseCliArgs();

  const username = validateUsername(args.username || process.env.DIDGIT_USERNAME);
  const domain = validateDomain(args.domain);
  const resolverAddress = validateAddress(args.resolver || DEFAULT_RESOLVER_ADDRESS, 'resolver address');
  const rpcUrl = validateRpcUrl(args.rpcUrl || DEFAULT_RPC_URL);

  const publicClient = createPublicResolverClient({ rpcUrl });
  const { patterns } = await readIdentity({ publicClient, resolverAddress, domain, username });

  console.log(`🔍 Repository patterns for ${domain}:${username}`);
  console.log(formatPatterns(patterns));
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exitCode = 1;
});
