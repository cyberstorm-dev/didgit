# Didgit Backend

Attestation service for GitHub contributions using EAS on Base.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ATTESTATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User registers identity (GitHub ↔ Wallet)                   │
│     └─→ Identity Attestation created (via dapp)                 │
│                                                                  │
│  2. User grants permission to verifier                          │
│     └─→ Kernel enables EAS.attest permission for verifier key   │
│                                                                  │
│  3. Backend monitors repos for commits                          │
│     └─→ Matches commit authors to registered users              │
│                                                                  │
│  4. Backend creates attestation via user's Kernel               │
│     └─→ Verifier signs UserOp with permission                   │
│     └─→ Kernel executes → User's account is attester            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Insight: Permission-Based Attestation

The verifier can create attestations **on behalf of the user** without the user signing each one:

1. User's smart account (Kernel) is the **attester** in EAS
2. Verifier signs UserOps using a **delegated permission**
3. Permission is scoped to only `EAS.attest()` calls
4. User grants permission once, backend handles the rest

## Setup

### Prerequisites

- Node.js 18+
- Access to Base Sepolia RPC
- ZeroDev project (for bundler)

### Environment Variables

```bash
# Required
VERIFIER_PRIVKEY=0x...      # Backend's signing key (has permission to attest)
USER_PRIVKEY=0x...          # User's EOA key (for Kernel reconstruction)

# Optional
ZERODEV_PROJECT_ID=...      # Default: aa40f236-4eff-41e1-8737-ab95ab7e1850
GITHUB_TOKEN=...            # For GitHub API rate limits
```

### Install & Run

```bash
cd backend
npm install

# Test the attestation flow
VERIFIER_PRIVKEY=0x... USER_PRIVKEY=0x... npx ts-node src/test-backend-attest.ts

# Run the service
VERIFIER_PRIVKEY=0x... USER_PRIVKEY=0x... npx ts-node src/index.ts
```

## Contracts

| Contract | Address | Note |
|----------|---------|------|
| EAS | `0x4200000000000000000000000000000000000021` | Base Sepolia |
| Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` | GitHub ↔ Wallet |
| Contribution Schema | `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782` | Commit attestation |
| UsernameUniqueResolver | `0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7` | Username uniqueness |

## Test Users

| User | EOA | Kernel |
|------|-----|--------|
| cyberstorm-nisto | `0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd` | `0x2Ce0cE887De4D0043324C76472f386dC5d454e96` |

## API (planned)

```
POST /api/attest
  Request: { commitHash, repoOwner, repoName, githubUsername }
  Response: { attestationUid, txHash }

GET /api/attestations/:githubUsername
  Response: { attestations: [...] }
```
