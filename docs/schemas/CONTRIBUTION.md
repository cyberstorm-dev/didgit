# Contribution Attestations

This document describes the contribution attestation schema for tracking verified GitHub activity on-chain.

## Overview

While the primary didgit.dev flow handles **identity binding** (linking GitHub usernames to wallet addresses), the contribution attestation schema enables tracking **individual contributions** (commits, PRs, etc.) on-chain.

## Schema

**Schema UID (Base mainnet):** `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782`

```
string repo,string commitHash,string author,string message,uint64 timestamp,bytes32 identityUid
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | Full repository name (e.g., `cyberstorm-dev/didgit`) |
| `commitHash` | string | Git commit SHA |
| `author` | string | GitHub username |
| `message` | string | Commit message (truncated to 200 chars) |
| `timestamp` | uint64 | Commit timestamp (Unix epoch) |
| `identityUid` | bytes32 | Reference to identity attestation UID |

### Relationships

Each contribution attestation references an **identity attestation** via:
1. `identityUid` field in the attestation data
2. `refUID` in the EAS attestation request (creates on-chain link)

This enables:
- Verifying the contributor's wallet ownership
- Querying all contributions for a given identity
- Building reputation graphs from verified activity

## Usage

### Polling GitHub Activity

The contribution attestor polls the GitHub Events API for push events:

```javascript
const events = await fetch(`https://api.github.com/users/${username}/events`);
const commits = events
  .filter(e => e.type === 'PushEvent')
  .flatMap(e => e.payload.commits);
```

### Creating Attestations

```javascript
const encodedData = encodeAbiParameters(
  [
    { type: 'string', name: 'repo' },
    { type: 'string', name: 'commitHash' },
    { type: 'string', name: 'author' },
    { type: 'string', name: 'message' },
    { type: 'uint64', name: 'timestamp' },
    { type: 'bytes32', name: 'identityUid' }
  ],
  [repo, commitHash, author, message, timestamp, identityUid]
);

await eas.attest({
  schema: CONTRIBUTION_SCHEMA_UID,
  data: {
    recipient: authorWallet,
    refUID: identityUid, // Links to identity
    data: encodedData
  }
});
```

## Repository Registration

Before attesting contributions, repos must be registered on-chain via the UsernameUniqueResolver.

**Resolver (Base mainnet):** `0x...`

### Setting Patterns

Users register repository patterns (supports wildcards):

```javascript
// Register all repos under an org
await resolver.setRepositoryPattern(
  'github.com',           // domain
  'cyberstorm-nisto',     // identifier (GitHub username)
  'cyberstorm-dev',       // namespace (org/owner)
  '*',                    // name (* = wildcard)
  true                    // enabled
);

// Register specific repo
await resolver.setRepositoryPattern(
  'github.com',
  'cyberstorm-nisto', 
  'cyberstorm-dev',
  'didgit',
  true
);
```

### Checking Registration

Before attesting, verify the repo is registered:

```javascript
const enabled = await resolver.isRepositoryEnabled(
  'cyberstorm-nisto',  // owner
  'github.com',        // domain
  'cyberstorm-nisto',  // identifier
  'cyberstorm-dev',    // namespace
  'didgit'             // name
);
```

This prevents accidental attestation of private or unregistered repos.

## Roadmap

- [x] On-chain repo registration via UsernameUniqueResolver
- [ ] Integrate contribution attestations into didgit.dev UI
- [ ] Add PR and issue attestation support
- [ ] Build contribution leaderboard / reputation dashboard
- [ ] Explore automated attestation via GitHub webhooks or polling service

## Related

- [Identity Attestation Schema](../README.md) - Primary identity binding
- [EAS Documentation](https://docs.attest.sh/) - Ethereum Attestation Service
- [Base Explorer](https://base.easscan.org/) - View attestations
