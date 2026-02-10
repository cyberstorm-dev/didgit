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
