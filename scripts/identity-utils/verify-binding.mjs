#!/usr/bin/env node
import {
  createPublicResolverClient,
  identitySummary,
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
  const expected = args.expected ? validateAddress(args.expected, 'expected wallet') : null;

  const publicClient = createPublicResolverClient({ rpcUrl });

  const { owner, patterns } = await readIdentity({ publicClient, resolverAddress, domain, username });

  console.log(`🔍 Identity: ${identitySummary({ domain, username, wallet: owner })}`);
  if (expected) {
    const match = owner.toLowerCase() === expected.toLowerCase();
    console.log(`Expected: ${expected} (${match ? 'match' : 'mismatch'})`);
  }

  if (patterns.length) {
    console.log('\n📦 Repository patterns:');
    patterns.forEach((p) => {
      console.log(` - ${p.enabled ? '✅' : '❌'} ${p.namespace}/${p.name}`);
    });
  } else {
    console.log('\n📦 Repository patterns: none registered');
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exitCode = 1;
});
