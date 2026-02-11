# didgit attestor backend

Attestation service for didgit.dev - attests GitHub commits on-chain via EAS.

## Setup

```bash
pnpm install
# Optional: create .env and add required vars
```

## Environment Variables

```bash
# Runtime (attestor)
GITHUB_TOKEN=ghp_...           # GitHub token for API access
ATTESTER_PRIVKEY=0x...         # Attester key (signs UserOps)
BUNDLER_RPC=https://...        # ZeroDev bundler RPC
ATTEST_LOOKBACK_DAYS=7         # Lookback window for commits (default 7)
ATTEST_FALLBACK_REPO_SCAN=1    # Optional: scan repos when events are empty

# Chain config (Base mainnet)
CHAIN=base
BASE_RPC_URL=https://base.api.pocket.network
BASE_EAS_ADDRESS=0x4200000000000000000000000000000000000021
BASE_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
BASE_RESOLVER_ADDRESS=0x9A6F993e73E12Deba899c8856D78c7F05b71167A
BASE_IDENTITY_SCHEMA_UID=0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
BASE_CONTRIBUTION_SCHEMA_UID=0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782
BASE_PERMISSION_SCHEMA_UID=0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6
BASE_REPO_GLOBS_SCHEMA_UID=0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74

# One-time (schema registration)
OWNER_PRIVKEY=0x...            # Schema registrar / deployer
```

## User Onboarding (Session Key Setup)

Each user needs a one-time setup to authorize the attester to attest on their behalf.

### For Agents (have private key access)

```bash
USER_PRIVKEY=0x... npx tsx src/setup-permission.ts
```

## Mainnet Schema Registration

Register all schemas in one command:

```bash
cd backend
CHAIN=base OWNER_PRIVKEY=0x... npx tsx src/create-schemas.ts
```

This creates `.permission-{address}.json` containing the serialized session key.

### For Humans (MetaMask / hardware wallet)

Coming soon: WalletConnect web flow

## Running the Attestor

### Single run (for testing/cron)
```bash
pnpm run attest:once
```

### Daemon mode (watches continuously)
```bash
pnpm run dev
```

## How It Works

1. **Query EAS** for registered identities (users with Identity attestations)
2. **Query repo globs** for each identity (which repos to watch)
3. **Resolve globs** to actual repos via GitHub API
4. **Get commits** since last check
5. **Attest each commit** using user's session key (user's Kernel pays gas)

## Architecture

```
User registers on didgit.dev
    ↓
Identity attestation created (EAS)
    ↓
User adds repo globs (e.g., "myorg/*")
    ↓
User runs setup-permission.ts (one-time)
    ↓
Attestor watches repos, attests commits
    ↓
Attestations from user's Kernel address
```

## Files

- `src/setup-permission.ts` - One-time session key setup CLI
- `src/service.ts` - Main attestation service
- `src/attest.ts` - Low-level attestation logic
- `src/github.ts` - GitHub API helpers
- `src/run-once.ts` - Single-run entry point
- `src/index.ts` - Daemon entry point

## Schemas (Base Mainnet)

- Identity: `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af`
- Contribution: `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782`
- Repo Globs: `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74`
