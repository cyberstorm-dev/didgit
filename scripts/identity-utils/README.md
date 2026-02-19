# Identity Binding Utilities

Command-line scripts for managing didgit.dev identity bindings on Base Sepolia.

## Prerequisites

```bash
npm install viem
export WALLET_PRIVATE_KEY=0x...
```

## Scripts

### bind-identity.mjs

Binds an existing EAS attestation to the UsernameUniqueResolver contract.

**When to use:** After creating an identity attestation via the web app or API, run this to register it in the resolver. This enables contribution attestations and automatically sets the `*/*` repository pattern.

```bash
node bind-identity.mjs
```

**What it does:**
1. Calls `bindIdentity(attestationUid, wallet, domain, username)` on the resolver
2. Automatically registers the `*/*` pattern (all repos in all orgs)
3. Verifies the binding was successful

### verify-binding.mjs

Checks if an identity is bound in the resolver.

```bash
node verify-binding.mjs
```

**Output:**
- Identity owner (wallet address for username)
- Binding status

### check-my-patterns.mjs

Lists all repository patterns registered for your identity.

```bash
node check-my-patterns.mjs
```

**Output:**
- All registered patterns (e.g., `*/*`, `cyberstorm-dev/*`, etc.)
- Enabled/disabled status for each pattern

## Architecture Notes

### Why Two Steps?

1. **EAS Attestation** - Creates the cryptographic proof (signature + gist)
2. **Resolver Binding** - Registers the attestation on-chain for uniqueness enforcement

The resolver ensures:
- One username → one wallet (no squatting)
- One wallet → one username (no multi-claiming)
- Repository patterns are tracked per identity

### Automatic `*/*` Registration

When `bindIdentity()` is called, the contract automatically enables the `*/*` pattern:

```solidity
bytes32 wildcardPatternKey = _patternKey("*", "*");
repoPatterns[identityKey][wildcardPatternKey] = true;
```

This allows immediate contribution attestations to any repo without manual pattern setup.

## Contract Addresses

- **Resolver:** `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c`
- **EAS:** `0x4200000000000000000000000000000000000021`
- **Network:** Base Sepolia

## Related Docs

- [Identity Schema](../../docs/schemas/IDENTITY.md)
- [Contribution Schema](../../docs/schemas/CONTRIBUTION.md)
- [Contract Reference](../../docs/reference/CONTRACTS.md)
