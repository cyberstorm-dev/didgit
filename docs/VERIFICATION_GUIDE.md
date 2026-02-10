# Verification Guide

How to verify a contributor's identity and history using didgit.dev attestations.

## Use Cases

- **Hiring**: Verify candidate claims about open source contributions
- **Access Control**: Vet contributors before granting commit rights
- **Due Diligence**: Check a developer's track record before partnering

## Quick Verification

### 1. Get Their Username

Ask for their GitHub username (e.g., `cyberstorm-nisto`).

### 2. Check Identity Attestation

Search for their identity attestation on [EAS Explorer](https://base.easscan.org/):

```
Schema: 0x... (Base mainnet identity schema UID)
Filter by: decodedDataJson contains "username"
```

Or use the GraphQL API:

```graphql
query VerifyIdentity($username: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x...<IDENTITY_SCHEMA_UID>" }
      decodedDataJson: { contains: $username }
      revoked: { equals: false }
    }
  ) {
    id
    recipient
    attester
    decodedDataJson
    timeCreated
  }
}
```

### 3. Verify the Binding

The attestation contains:
- `username` — The claimed GitHub username
- `wallet` — The linked wallet address
- `signature` — Proof the wallet signed the claim
- `proof_url` — Link to public gist with proof

**Check the gist exists** and contains matching data. This confirms:
- The GitHub account holder authorized the binding
- The wallet owner signed the claim

### 4. Check Contribution History

Query contributions linked to their identity:

```graphql
query GetContributions($identityUid: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x...<CONTRIBUTION_SCHEMA_UID>" }
      refUID: { equals: $identityUid }
      revoked: { equals: false }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    decodedDataJson
    timeCreated
  }
}
```

Each contribution shows:
- Repository name
- Commit hash (verify on GitHub)
- Commit message
- Timestamp

## Verification Checklist

- [ ] Identity attestation exists and is not revoked
- [ ] Proof gist exists and matches attestation data
- [ ] Signature in attestation is valid for claimed wallet
- [ ] Contribution attestations reference the identity
- [ ] Commit hashes exist in the claimed repositories

## Programmatic Verification

```typescript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http()
});

// Verify signature matches wallet
import { verifyMessage } from 'viem';

const isValid = await verifyMessage({
  address: attestation.wallet,
  message: `github.com:${attestation.username}`,
  signature: attestation.signature
});
```

## Red Flags

- ⚠️ No proof gist or gist is private
- ⚠️ Attestation was recently created (right before application)
- ⚠️ Very few contribution attestations despite claimed experience
- ⚠️ Contributions only to personal repos, not collaborative projects
- ⚠️ Revoked attestations in history

## Next Steps

- [Integration Guide](./INTEGRATION_GUIDE.md) — Automate verification in your app
- [API Reference](./reference/API.md) — Full query documentation
