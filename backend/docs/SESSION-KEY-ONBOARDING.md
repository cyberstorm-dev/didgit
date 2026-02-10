# Session Key Onboarding Guide

## What This Is

Didgit attests your GitHub commits on-chain. To do this without you signing every commit, you grant the Didgit attester a **limited permission** to attest on your behalf.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR CONTROL                             │
├─────────────────────────────────────────────────────────────────┤
│  You sign ONE permission grant                                  │
│  ↓                                                              │
│  Permission is attested to EAS (public, on-chain)               │
│  ↓                                                              │
│  Attester can now call EAS.attest() via YOUR Kernel             │
│  ↓                                                              │
│  You can REVOKE anytime by revoking the EAS attestation         │
└─────────────────────────────────────────────────────────────────┘
```

## What Gets Stored Where

| Data | Location | Who Controls |
|------|----------|--------------|
| Permission grant | EAS on Base Sepolia | **You** (attester = your EOA) |
| Your identity | EAS attestation | **You** (can revoke) |
| Repo globs | EAS attestation | **You** (defines which repos) |
| Commit attestations | EAS attestations | Created via your Kernel |

**Nothing is stored in files.** Everything is on-chain via EAS.

## What The Permission Allows

The attester can ONLY:
- Call `EAS.attest()` (one specific function)
- Via your Kernel (your smart account pays gas)
- To create Contribution attestations (commit records)

The attester CANNOT:
- Transfer your funds
- Call any other contract
- Do anything else with your Kernel

## Prerequisites

1. **Base Sepolia ETH** in your Kernel (for gas)
   - Your Kernel address is derived from your EOA
   - Fund it before running setup

2. **Identity attestation** on Didgit
   - Links your GitHub username to your wallet
   - Must exist before permission setup

3. **Repo globs attestation**
   - Defines which repos to attest commits for
   - e.g., `cyberstorm-dev/*` or `myorg/myrepo`

## Setup Steps (current flow)

> Note: The current CLI is a one-step helper that temporarily requires the attester signing key locally to serialize the permission. We will move this to a service so external users never handle the attester key. For now, delete the attester key from your env after setup.

### 1. Create `.env`

```
ATTESTER_PRIVKEY=0xfcb525413bd7c69608771c60e923c7dcb283caa07559f5bbfcffb86ed2bbd637
GITHUB_TOKEN=<your_github_token>
BUNDLER_RPC=https://rpc.zerodev.app/api/v3/aa40f236-4eff-41e1-8737-ab95ab7e1850/chain/8453
USER_PRIVKEY=0x<your EOA privkey>
```

- Do **not** reuse the example USER_PRIVKEY; use your own EOA key. It is used locally only to attest your permission.
- The attester key is only used to sign the serialized permission blob; your EOA is the on-chain attester.

### 2. Run the setup CLI

```bash
cd backend
npx tsx src/setup-permission.ts
```

This will:
1. Derive your Kernel address from your EOA
2. Create a permission allowing the attester to call EAS.attest()
3. Attest this permission to EAS **as you** (you are the attester)
4. Print the EAS attestation UID

### 3. Verify on-chain

Check your permission at:
```
https://base.easscan.org/attestation/view/[UID]
```

You should see:
- **Attester**: Your EOA address
- **Schema**: Session Key Permission schema
- **Data**: Your Kernel address, attester address, EAS target, attest selector

### 4. Fund your Kernel

Your Kernel pays gas for attestations. Send Base Sepolia ETH to your Kernel address (shown during setup).

**That's it. You're done.**

The attester handles everything from here. Your commits get attested automatically. You just need to:
- Keep gas in your Kernel
- Update repo globs if you want to track different repos

## Upcoming improvement (planned)
- Two-step flow so external users never load `ATTESTER_PRIVKEY` locally:
  1) User derives Kernel address and submits it.
  2) Service signs the permission blob with the attester key.
  3) User attests the blob with their EOA key only.
- When available, this section will be updated and the setup CLI will be split accordingly.

## How Attestations Work After Setup

**You do nothing. Attester handles it all.**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│   Attester  │────▶│    EAS      │
│   Commit    │     │   Service   │     │  Contract   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Your Kernel │
                    │ (pays gas)  │
                    └─────────────┘
```

1. Attester detects your commit on GitHub
2. Attester creates a UserOp calling EAS.attest()
3. Attester signs using your permission (stored on-chain in EAS)
4. Your Kernel validates permission, executes attest()
5. Attestation created from your Kernel address
6. Your Kernel pays gas

## Revocation

To revoke the attester's permission:

1. Go to your permission attestation on EASScan
2. Click "Revoke" (requires signing with your EOA)
3. Done - attester can no longer attest via your Kernel

Or via CLI:
```bash
npx tsx src/revoke-permission.ts [ATTESTATION_UID]
```

## Schema Details

### Session Key Permission Schema
- **UID**: `0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6`
- **Fields**:
  - `address userKernel` - Your smart account address
  - `address attester` - Didgit attester address
  - `address target` - EAS contract (0x4200...0021)
  - `bytes4 selector` - attest() function selector
  - `bytes serializedPermission` - ZeroDev permission blob

### Other Relevant Schemas
- **Identity**: `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af`
- **Contribution**: `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782`
- **Repo Globs**: `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74`

## Addresses (Base Sepolia)

- **EAS**: `0x4200000000000000000000000000000000000021`
- **Schema Registry**: `0x4200000000000000000000000000000000000020`
- **Attester**: `0x0CA6A71045C26087F8dCe6d3F93437f31B81C138`

## Troubleshooting

### "No repo globs registered"
You need to attest which repos to track. Create a Repo Globs attestation with patterns like `myorg/*`.

### "Permission not found"
Either:
- Permission not attested yet (run setup)
- Permission was revoked
- Querying wrong network

### "Insufficient funds"
Your Kernel needs Base Sepolia ETH for gas. Fund it at the Kernel address shown during setup.

## Security Model

- **You control revocation**: Only you can revoke (you're the attester)
- **Limited scope**: Permission only allows EAS.attest(), nothing else
- **Your gas**: You fund your Kernel, you control spending
- **Transparent**: All permissions visible on-chain via EAS
- **No secrets**: Attester needs no private keys from you
