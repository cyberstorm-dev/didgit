# Didgit Backend

Attestation service for GitHub contributions using EAS on Base.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION KEY ATTESTATION FLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ONE-TIME SETUP (requires USER_PRIVKEY):                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. User registers identity (GitHub ↔ Wallet)             │   │
│  │ 2. User deploys Kernel smart account (if needed)         │   │
│  │ 3. User grants EAS.attest permission to verifier         │   │
│  │ 4. Permission is serialized to .permission-account.json  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  RUNTIME (no USER_PRIVKEY needed):                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Backend monitors repos for commits                    │   │
│  │ 2. Matches commit authors to registered users            │   │
│  │ 3. Deserializes user's permission account                │   │
│  │ 4. Verifier signs UserOp with delegated permission       │   │
│  │ 5. User's Kernel executes EAS.attest()                   │   │
│  │    └─→ User pays gas, attestation owned by user          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Insight: User Pays Gas via Session Key

Unlike traditional delegated attestation where a verifier pays:

1. **User's Kernel** is the attester (owns the attestation)
2. **Verifier** signs UserOps using a **scoped permission**
3. **Permission** is limited to `EAS.attest()` only
4. **User** can revoke the permission at any time
5. **User's Kernel balance** pays gas

This means:
- No USER_PRIVKEY at runtime (only during one-time setup)
- Attestations are FROM the user, not the verifier
- User retains full control and can revoke

## Setup

### Prerequisites

- Node.js 18+
- Access to Base Sepolia RPC
- ZeroDev Bundler RPC

### Environment Variables

```bash
# Runtime (always needed)
VERIFIER_PRIVKEY=0x...   # Backend's signing key (has delegated permission)
GITHUB_TOKEN=ghp_...     # GitHub API access
BUNDLER_RPC=https://...  # ZeroDev bundler endpoint

# Setup only (one-time per user)
USER_PRIVKEY=0x...       # User's EOA key (for permission granting)
```

### Install

```bash
cd backend
npm install
```

### One-Time User Setup

For each new user, run the setup script with their private key:

```bash
USER_PRIVKEY=0x... npm run setup-session-key
```

This will:
1. Create/find the user's Kernel smart account
2. Fund it from verifier if balance is low
3. Grant EAS.attest permission to the verifier
4. Save serialized permission to `.permission-account.json`

**Store the `.permission-account.json` securely** — it enables attestations without the user's key.

### Runtime

```bash
# Single attestation run (for cron/heartbeat)
npm run attest

# Daemon mode (watches continuously)
npm run dev
```

## How It Works

### Session Key Flow

```
User's EOA (0x5B64...)
    │
    ├─ owns → Kernel Smart Account (0x2Ce0...)
    │              │
    │              ├─ sudo validator: User's ECDSA key
    │              └─ regular validator: Permission (EAS.attest only)
    │                        │
    │                        └─ signer: Verifier's key (0x0CA6...)
    │
    └─ funded with ETH for gas
```

### Attestation Flow

1. Backend queries EAS for registered identities
2. Resolves repo globs to actual repos (e.g., `cyberstorm-dev/*`)
3. Fetches commits since last check
4. For each commit:
   - Deserializes user's permission account
   - Creates UserOp calling EAS.attest()
   - Verifier signs with delegated permission
   - Bundler submits to Base
   - User's Kernel executes, paying gas
5. Attestation is owned by user's Kernel address

## Contracts

| Contract | Address | Note |
|----------|---------|------|
| EAS | `0x4200000000000000000000000000000000000021` | Base Sepolia |
| UsernameUniqueResolverV2 | `0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7` | 3 roles |
| Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` | GitHub ↔ Wallet |
| Contribution Schema | `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782` | Commit attestation |
| Repo Globs Schema | `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74` | Repo patterns |

## Registered Users

| User | EOA | Kernel | Permission |
|------|-----|--------|------------|
| cyberstorm-nisto | `0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd` | `0x2Ce0cE887De4D0043324C76472f386dC5d454e96` | ✓ Active |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run attest` | Single attestation pass (for cron) |
| `npm run dev` | Daemon mode (continuous) |
| `npm run setup-session-key` | One-time user setup |

## Troubleshooting

### "Insufficient Kernel balance"
The user's Kernel needs ETH for gas. Fund it:
```bash
cast send <KERNEL_ADDRESS> --value 0.01ether --rpc-url https://sepolia.base.org
```

### "Permission not found"
Run `npm run setup-session-key` for the user first.

### "entryPoint does not exist"
SDK was updated. Remove `entryPoint` from `createKernelAccountClient()` calls — it's now inferred from the account.

## Versioning

- **v0.2.0** — Session key flow working (user pays gas)
- **v0.1.x** — Verifier pays gas (deprecated)
