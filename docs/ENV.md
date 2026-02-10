# Environment Variables

This repo uses a small set of environment variables across backend tooling and workers.

| Variable | Required | Purpose | Used In |
|---|---|---|---|
| `GITHUB_TOKEN` | Optional (recommended) | GitHub API auth for higher rate limits | `backend/src/github.ts`, attester runs |
| `PRIVATE_KEY` | Required (attest/permission setup) | Sign attestations and onchain operations | `backend/src/attest-identity.ts`, `backend/src/attest-permission.ts` |
| `ATTESTER_PRIVKEY` | Required (attester) | Attester key used to sign permission data / UserOps | backend, worker |
| `CHAIN` | Optional | Select chain config (`base` default, `arbitrum` optional) | `backend/src/config.ts`, worker config, docs |
| `BASE_RPC_URL` | Optional | Override Base RPC URL | backend/worker |
| `ARBITRUM_RPC_URL` | Optional | Override Arbitrum RPC URL | backend/worker |
| `BASE_EAS_ADDRESS` | Required | EAS contract address for Base | backend/worker |
| `ARBITRUM_EAS_ADDRESS` | Required | EAS contract address for Arbitrum | backend/worker |
| `BASE_SCHEMA_REGISTRY_ADDRESS` | Required | EAS Schema Registry address for Base | backend |
| `ARBITRUM_SCHEMA_REGISTRY_ADDRESS` | Required | EAS Schema Registry address for Arbitrum | backend |
| `BASE_RESOLVER_ADDRESS` | Required | Username resolver contract on Base | backend |
| `ARBITRUM_RESOLVER_ADDRESS` | Required | Username resolver contract on Arbitrum | backend |
| `BASE_IDENTITY_SCHEMA_UID` | Required | Identity schema UID on Base | backend/worker |
| `ARBITRUM_IDENTITY_SCHEMA_UID` | Required | Identity schema UID on Arbitrum | backend/worker |
| `BASE_CONTRIBUTION_SCHEMA_UID` | Required | Contribution schema UID on Base | backend |
| `ARBITRUM_CONTRIBUTION_SCHEMA_UID` | Required | Contribution schema UID on Arbitrum | backend |
| `BASE_PERMISSION_SCHEMA_UID` | Required | Permission schema UID on Base | backend/worker |
| `ARBITRUM_PERMISSION_SCHEMA_UID` | Required | Permission schema UID on Arbitrum | backend/worker |
| `BASE_REPO_GLOBS_SCHEMA_UID` | Required | Repo globs schema UID on Base | backend |
| `ARBITRUM_REPO_GLOBS_SCHEMA_UID` | Required | Repo globs schema UID on Arbitrum | backend |
| `ATTEST_FALLBACK_REPO_SCAN` | Optional | Set to `1` to fallback to per-repo commit scans when no public events are found | backend |
| `WORKER_API_KEY` | Optional | Permission worker API key | `backend/src/permission-setup.ts` |

> [!IMPORTANT]
> Never commit real private keys. Use `.env` and ensure it is ignored. `VERIFIER_PRIVKEY` is legacy; prefer `ATTESTER_PRIVKEY`.

## Base Mainnet Exports (Single Session)

If you don’t want to edit `backend/.env`, export these in your shell before running onboarding:

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
