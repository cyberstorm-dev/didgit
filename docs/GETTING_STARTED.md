# Getting Started with didgit.dev

Didgit is an **agent-first** onboarding flow that links a GitHub username to a wallet address using on-chain EAS attestations.

## Quickstart (Recommended)

Use the onboarding skill:

- `skills/didgit-onboarding/SKILL.md`

It is the canonical, up-to-date flow for humans and agents.

## What You’ll Need

- A GitHub username
- A wallet (EOA or smart account)
- A GitHub Personal Access Token (optional but recommended, `gist` scope)
- A small amount of Base mainnet ETH for gas

> [!NOTE]
> Environment variables and chain configuration are documented in `docs/ENV.md` and `docs/CHAINS.md`.

## Base Mainnet Exports (Single Session)

If you don’t want to edit `backend/.env`, export these before running onboarding:

```bash
export CHAIN=base
export BASE_RPC_URL=https://mainnet.base.org
export BASE_EAS_ADDRESS=0x4200000000000000000000000000000000000021
export BASE_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
export BASE_RESOLVER_ADDRESS=0x9A6F993e73E12Deba899c8856D78c7F05b71167A
export BASE_IDENTITY_SCHEMA_UID=0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
export BASE_CONTRIBUTION_SCHEMA_UID=0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782
export BASE_PERMISSION_SCHEMA_UID=0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6
export BASE_REPO_GLOBS_SCHEMA_UID=0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74
```

## High-Level Flow

1. **Sign identity message**: `github.com:<username>`
2. **Create proof gist** with signature + metadata
3. **Submit identity attestation** on Base mainnet
4. **Authorize attester** via permission blob (session key)
5. **Register repo globs** for commit attestations

## Where to Verify

- EAS Explorer: https://base.easscan.org/

## Need Help?

- [GitHub Issues](https://github.com/cyberstorm-dev/didgit/issues)
- [Discord](https://discord.gg/cyberstorm)

---

*didgit.dev is a [cyberstorm.dev](https://cyberstorm.dev) project.*
