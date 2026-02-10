# Environment Variables

This repo uses a small set of environment variables across backend tooling and workers.

| Variable | Required | Purpose | Used In |
|---|---|---|---|
| `GITHUB_TOKEN` | Optional (recommended) | GitHub API auth for higher rate limits | `backend/src/github.ts`, verifier runs |
| `PRIVATE_KEY` | Required (attest/permission setup) | Sign attestations and onchain operations | `backend/src/attest-identity.ts`, `backend/src/attest-permission.ts` |
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
| `WORKER_API_KEY` | Optional | Permission worker API key | `backend/src/permission-setup.ts` |

> [!IMPORTANT]
> Never commit real private keys. Use `.env` and ensure it is ignored.
