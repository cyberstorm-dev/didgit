# didgit attestor backend

Attestation service for didgit.dev - attests GitHub commits on-chain via EAS.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your keys
```

## Environment Variables

```bash
GITHUB_TOKEN=ghp_...           # GitHub token for API access
VERIFIER_PRIVKEY=0x...         # Verifier wallet (signs UserOps)
BUNDLER_RPC=https://...        # ZeroDev bundler RPC
```

## User Onboarding (Session Key Setup)

Each user needs a one-time setup to authorize the verifier to attest on their behalf.

### For Agents (have private key access)

```bash
USER_PRIVKEY=0x... npx tsx src/setup-permission.ts
```

This creates `.permission-{address}.json` containing the serialized session key.

### For Humans (MetaMask / hardware wallet)

Coming soon: WalletConnect web flow

## Running the Attestor

### Single run (for testing/cron)
```bash
npm run attest
```

### Daemon mode (watches continuously)
```bash
npm run dev
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

## Schemas (Base Sepolia)

- Identity: `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af`
- Contribution: `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782`
- Repo Globs: `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74`
