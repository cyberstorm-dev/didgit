# Environment Variables

This repo uses a small set of environment variables across backend tooling and workers.

| Variable | Required | Purpose | Used In |
|---|---|---|---|
| `GITHUB_TOKEN` | Optional (recommended) | GitHub API auth for higher rate limits | `backend/src/github.ts`, verifier runs |
| `PRIVATE_KEY` | Required (attest/permission setup) | Sign attestations and onchain operations | `backend/src/attest-identity.ts`, `backend/src/attest-permission.ts` |
| `CHAIN` | Optional | Select chain config (`base` default, `arbitrum` optional) | `backend/src/config.ts`, worker config, docs |
| `RPC_URL` | Optional | Override default RPC for selected chain | tooling, scripts |
| `WORKER_API_KEY` | Optional | Permission worker API key | `backend/src/permission-setup.ts` |

> [!IMPORTANT]
> Never commit real private keys. Use `.env` and ensure it is ignored.
