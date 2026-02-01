# API Reference

Query attestations via EAS GraphQL API.

## Endpoints

| Network | GraphQL Endpoint |
|---------|------------------|
| Base Sepolia | `https://base-sepolia.easscan.org/graphql` |
| Base Mainnet | `https://base.easscan.org/graphql` |

## Schema UIDs

```typescript
const IDENTITY_SCHEMA = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';
```

## Common Queries

### Get Identity by Username

```graphql
query GetIdentity($username: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af" }
      decodedDataJson: { contains: $username }
      revoked: { equals: false }
    }
    take: 1
  ) {
    id
    attester
    recipient
    time
    decodedDataJson
  }
}
```

### Get Identity by Wallet

```graphql
query GetIdentityByWallet($wallet: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af" }
      recipient: { equals: $wallet }
      revoked: { equals: false }
    }
    take: 1
  ) {
    id
    decodedDataJson
  }
}
```

### Get Contributions for Identity

```graphql
query GetContributions($identityUid: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782" }
      refUID: { equals: $identityUid }
      revoked: { equals: false }
    }
    orderBy: { time: desc }
    take: 100
  ) {
    id
    time
    decodedDataJson
  }
}
```

### Get Contributions by Repo

```graphql
query GetRepoContributions($repo: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782" }
      decodedDataJson: { contains: $repo }
      revoked: { equals: false }
    }
    orderBy: { time: desc }
  ) {
    id
    recipient
    time
    decodedDataJson
  }
}
```

### Count Contributions

```graphql
query CountContributions($identityUid: String!) {
  aggregateAttestation(
    where: {
      schemaId: { equals: "0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782" }
      refUID: { equals: $identityUid }
      revoked: { equals: false }
    }
  ) {
    _count {
      id
    }
  }
}
```

### Recent Attestations

```graphql
query RecentAttestations($schema: String!, $limit: Int!) {
  attestations(
    where: {
      schemaId: { equals: $schema }
      revoked: { equals: false }
    }
    orderBy: { time: desc }
    take: $limit
  ) {
    id
    attester
    recipient
    time
    decodedDataJson
  }
}
```

## Response Format

### Attestation Object

```typescript
interface Attestation {
  id: string;              // Attestation UID
  attester: string;        // Address that created attestation
  recipient: string;       // Address attestation is about
  time: number;            // Unix timestamp
  revoked: boolean;        // Whether attestation was revoked
  refUID: string;          // Reference to another attestation (if any)
  decodedDataJson: string; // JSON string of decoded data
}
```

### Decoded Data (Identity)

```typescript
interface IdentityData {
  domain: string;      // "github.com"
  username: string;    // "cyberstorm-nisto"
  wallet: string;      // "0x0CA6..."
  message: string;     // "github.com:cyberstorm-nisto"
  signature: string;   // "0x..."
  proof_url: string;   // "https://gist.github.com/..."
}
```

### Decoded Data (Contribution)

```typescript
interface ContributionData {
  repo: string;        // "cyberstorm-dev/didgit"
  commitHash: string;  // "abc123..."
  author: string;      // "cyberstorm-nisto"
  message: string;     // "feat: add verification"
  timestamp: number;   // Unix timestamp
  identityUid: string; // Reference to identity attestation
}
```

## TypeScript Client

```typescript
const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';

async function query<T>(gql: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(EAS_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// Example: Get identity
const { attestations } = await query<{ attestations: Attestation[] }>(
  GET_IDENTITY_QUERY,
  { username: 'cyberstorm-nisto' }
);

if (attestations.length > 0) {
  const data = JSON.parse(attestations[0].decodedDataJson);
  console.log('Wallet:', data.wallet);
}
```

## Rate Limits

EAS GraphQL API has no strict rate limits, but:
- Use pagination (`take`, `skip`) for large queries
- Cache results when possible
- Don't poll more than once per minute

## Error Handling

```typescript
try {
  const result = await query(QUERY, variables);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Retry with exponential backoff
  } else if (error.message.includes('rate limit')) {
    // Wait and retry
  } else {
    // Log and handle gracefully
  }
}
```

---

*Full EAS documentation: [docs.attest.sh](https://docs.attest.sh/)*
