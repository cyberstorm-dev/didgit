# didgit.dev Onboarding Skill

Create a verified GitHub <-> wallet identity attestation on Base mainnet.

Repo: https://github.com/cyberstorm-dev/didgit
Network: Base mainnet
Time: ~5 minutes

---

## Overview

didgit.dev links a GitHub username to a wallet address via an on-chain attestation.

Use this skill to:
- Prove control of both GitHub and a wallet
- Build portable developer reputation
- Unlock gated services that verify identity

> [!NOTE]
> This flow avoids the didgit.dev UI and uses direct API + repo scripts.

---

## Prerequisites

- GitHub account with access to public gists
- Wallet private key (0x-prefixed) for signing
- Base ETH for gas (~0.01)
- Tooling:
  - Node.js + pnpm (repo deps already installed)
  - Foundry `cast` (or use the ethers.js snippet)
  - `curl` and `jq` if using the GitHub API path

---

## Step 1: Prepare identity inputs

```bash
export GITHUB_USERNAME="your-github-username"  # lowercase
export WALLET_ADDRESS="0xYourWalletAddress"    # 0x-prefixed
export MESSAGE="github.com:${GITHUB_USERNAME}"
export PRIVATE_KEY="0xYourWalletPrivateKey"    # 0x-prefixed
```

---

## Step 2: Run the onboarding script (preferred)

This script auto-signs, creates the gist if a PAT is available, submits the identity attestation,
and then sets up the permission (session key) automatically.

```bash
cd backend

# Required chain config (Base mainnet)
export CHAIN=base
export BASE_RPC_URL=https://mainnet.base.org
export BASE_EAS_ADDRESS=0x4200000000000000000000000000000000000021
export BASE_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
export BASE_RESOLVER_ADDRESS=0x9A6F993e73E12Deba899c8856D78c7F05b71167A
export BASE_IDENTITY_SCHEMA_UID=0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
export BASE_CONTRIBUTION_SCHEMA_UID=0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782
export BASE_PERMISSION_SCHEMA_UID=0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6
export BASE_REPO_GLOBS_SCHEMA_UID=0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74

# Full-auto if GITHUB_TOKEN is set (PAT with `gist` scope)
GITHUB_USERNAME=$GITHUB_USERNAME \
PRIVATE_KEY=$PRIVATE_KEY \
GITHUB_TOKEN=$GITHUB_TOKEN \
pnpm run onboard
```

If no `GITHUB_TOKEN` is present, the script prints the exact JSON for the gist,
then you set `GIST_URL` and rerun the same command.

> [!TIP]
> `GITHUB_TOKEN` is optional. If present, full-auto gist creation is used.

> [!IMPORTANT]
> The script checks your Base ETH balance before submitting.

> [!NOTE]
> The onboarding command reads `backend/.env`. If you don’t want to edit that file, the exports above are sufficient for the current shell session.

---

## Step 3: Manual fallback (only if you skipped full-auto)

Create a **public** gist named `didgit-proof.json` with the JSON printed by the script.
Then export `GIST_URL` and rerun `pnpm run onboard`.

Example rerun:
```bash
GITHUB_USERNAME=$GITHUB_USERNAME \
PRIVATE_KEY=$PRIVATE_KEY \
GIST_URL="https://gist.github.com/<user>/<gist-id>" \
pnpm run onboard
```

---

## Step 4: Output (trimmed)

The script prints only:
- `TX` (transaction hash)
- `UID` (attestation UID)
- `Kernel` (derived Kernel address)
- `Kernel balance` (and whether to skip top-up)
- `Basescan URL`, `EASscan URL`, `EASscan Address`

Verify:
- Basescan: https://basescan.org/tx/<TX>
- EASscan: https://base.easscan.org/attestation/view/<UID>
- EASscan by address: https://base.easscan.org/address/<WALLET_ADDRESS>

---

## Automatic Commit Attestations (optional, requires verifier)

This enables a **session key** so the attester can attest commits on your behalf.
It requires a pre-signed permission blob from the attester.

### Step 5: Fund your Kernel

```bash
cast send <KERNEL_ADDRESS> --value 0.01ether --rpc-url https://mainnet.base.org
```

> [!CAUTION]
> Skip funding if your Kernel already has >= 0.1 ETH.

### Step 6: Fetch + attest the permission blob (CLI)

This calls the attester worker, signs the enable typed data, and attests the permission.

```bash
cd /Users/allenday/src/didgit/backend

PRIVATE_KEY=$PRIVATE_KEY \
pnpm run permission:setup
```

Optional:
- `PERMISSION_API_URL` (default `https://didgit-permission-blob.ops7622.workers.dev`)
- `PERMISSION_API_KEY` (default `ab95ab7e1850`)
- `KERNEL_ADDRESS` (if you want to force a specific kernel)

---

## Step 7: Register repo globs

Your identity attestation UID from Step 4 is required as `IDENTITY_UID`. In the onboarding output, use the **first UID** that appears right after the identity attestation TX (not the permission UID).

```bash
cd backend

PRIVATE_KEY=$PRIVATE_KEY \
IDENTITY_UID=0x<IDENTITY_ATTESTATION_UID> \
REPO_GLOBS="$USER/*" \
pnpm run repo:register
```

Examples:
- `username/*` all repos for a user/org
- `username/myrepo` specific repo

> [!WARNING]  
> `*/*` and `*/repo` patterns are **not supported**. They can't be resolved reliably from public GitHub events, so the attestor rejects any glob prefixed with `*/`.

> [!NOTE]  
> If you skip this step, the attestor defaults to `username/*` for your GitHub username.

---

## Troubleshooting

### Username already registered
The resolver enforces a 1:1 mapping.
- Check if the username is already linked to another wallet
- Old attestations can be revoked, then re-registered

### Insufficient funds
You need Base ETH. Fund your wallet on Base mainnet (bridge/exchange).

### Invalid signature
- Message must be exactly `github.com:username` (lowercase)
- Must sign with the wallet being linked
- Use `personal_sign` (ethers `signMessage` is correct)

### Resolver rejected
The UsernameUniqueResolver checks:
- Username not already taken
- Wallet not already linked to a different username
- Attester == recipient (self-attestation only)

---

## Contract Addresses (Base mainnet)

| Contract | Address |
|----------|---------|
| EAS | `0x4200000000000000000000000000000000000021` |
| Schema Registry | `0x4200000000000000000000000000000000000020` |
| UsernameUniqueResolverV2 (Proxy) | `0x9A6F993e73E12Deba899c8856D78c7F05b71167A` |
| Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` |
| Permission Schema | `0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6` |
| Repo Globs Schema | `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74` |

---

## Why This Matters

Identity is the primitive. Without verified identity:
- Agents cannot build reputation
- Contributions cannot be attributed
- Bounties cannot be paid to the right wallet

Didgit solves this with on-chain attestations that anyone can verify.

---

This skill is part of cyberstorm.dev.
