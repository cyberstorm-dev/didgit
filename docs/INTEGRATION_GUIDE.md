# Integration Guide

Integrate didgit.dev attestations into your DAO, dApp, or governance system.

## Use Cases

- **Contribution-weighted voting** — Weight governance by verified work
- **Gated access** — Require attestations for roles or permissions
- **Reputation scores** — Build composite scores from on-chain history
- **Bounty verification** — Automate payment on contribution proof

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Your App  │────▶│  EAS Query  │────▶│ Base Chain  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Attestation │
                    │    Data     │
                    └─────────────┘
```

All attestations are on-chain via [EAS](https://attest.sh/). Query directly or use our SDK.

## Quick Start

### Install SDK (coming soon)

```bash
npm install @didgit/sdk
```

### Query Attestations

```typescript
import { DidgitClient } from '@didgit/sdk';

const client = new DidgitClient({
  chain: 'base-sepolia', // or 'base' for mainnet
});

// Get identity by username
const identity = await client.getIdentity('cyberstorm-nisto');
console.log(identity.wallet); // 0x0CA6...

// Get contributions
const contributions = await client.getContributions(identity.uid);
console.log(`${contributions.length} verified commits`);

// Verify a user has contributed to a repo
const hasContributed = await client.hasContributedTo(
  'cyberstorm-nisto',
  'cyberstorm-dev/didgit'
);
```

### Direct EAS Query

No SDK needed — query EAS directly:

```typescript
const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';

const query = `
  query GetIdentity($username: String!) {
    attestations(
      where: {
        schemaId: { equals: "${IDENTITY_SCHEMA}" }
        decodedDataJson: { contains: $username }
        revoked: { equals: false }
      }
    ) {
      id
      recipient
      decodedDataJson
    }
  }
`;

const response = await fetch(EAS_GRAPHQL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { username } })
});
```

## Governance Integration

### Snapshot Strategy

Create a custom Snapshot strategy that weights votes by contribution count:

```javascript
// snapshot-strategy-didgit.js
export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  const scores = {};
  
  for (const address of addresses) {
    const contributions = await getContributionsForWallet(address);
    scores[address] = contributions.length; // 1 vote per contribution
  }
  
  return scores;
}
```

### On-Chain Gating

Use attestation checks in your smart contracts:

```solidity
import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";

contract GatedAccess {
    IEAS public eas;
    bytes32 public identitySchema;
    
    function hasIdentity(address user) public view returns (bool) {
        // Query EAS for identity attestation
        // Return true if valid, non-revoked attestation exists
    }
    
    modifier onlyAttested() {
        require(hasIdentity(msg.sender), "No identity attestation");
        _;
    }
    
    function sensitiveAction() external onlyAttested {
        // Only users with verified identity can call
    }
}
```

## Webhooks (Coming Soon)

Subscribe to new attestations:

```typescript
client.subscribe({
  schema: 'identity',
  filter: { repo: 'cyberstorm-dev/*' },
  callback: (attestation) => {
    console.log(`New contribution: ${attestation.commitHash}`);
  }
});
```

## Rate Limits

- EAS GraphQL: No strict limits, but be reasonable
- SDK: Caches queries, respects rate limits automatically

## Contract Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | EAS | `0x4200000000000000000000000000000000000021` |
| Base Sepolia | Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` |
| Base Sepolia | Contribution Schema | `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782` |
| Base Sepolia | Resolver | `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c` |

## Next Steps

- [Schema Reference](./schemas/) — Field definitions
- [Contracts Reference](./reference/CONTRACTS.md) — ABI and addresses
- [Protocol Docs](./protocol/PROTOCOL.md) — Architecture deep dive
