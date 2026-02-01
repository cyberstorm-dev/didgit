# GitHub Activity Attestation (Base Sepolia)

Minimal, strongly-typed frontend to create on-chain attestations binding a GitHub username to a wallet address with a public proof (Gist URL). Uses EAS on Base Sepolia and injected wallets (MetaMask, etc.) via viem.

## Features
- Strong typing via TypeScript + zod
- BYOW wallet connect (injected)
- Sign GitHub username and submit EAS attestation
- Verify by querying EAS GraphQL (client-side)

## Config
Create a `.env` (or set Vite env vars):

 - `VITE_EAS_BASE_SEPOLIA_SCHEMA_UID` — EAS schema UID on Base Sepolia (defaults to provided UID)
 - `VITE_EAS_BASE_SEPOLIA_ADDRESS` — EAS contract address on Base Sepolia (required)
- `VITE_GITHUB_CLIENT_ID` — GitHub OAuth App client ID (required for OAuth)
- `VITE_GITHUB_REDIRECT_URI` — Optional override (defaults to `window.location.origin/`)
- `VITE_WEB3AUTH_CLIENT_ID` — Web3Auth project Client ID (required for SSO)
- `VITE_WEB3AUTH_NETWORK` — Web3Auth network to use. Set to `testnet`, `mainnet`, `sapphire_devnet`, or `sapphire_mainnet` to match your Web3Auth project (defaults to `testnet`).
- `VITE_ZERODEV_BUNDLER_RPC` — Required for AA. Full Bundler RPC URL for Base Sepolia (e.g., ZeroDev/Pimlico bundler endpoint for your project).
 - `VITE_ZERODEV_PROJECT_ID` — ZeroDev project ID (Kernel AA on Base Sepolia)
 - `VITE_GITHUB_TOKEN_PROXY` — Optional. URL of a tiny serverless endpoint that exchanges code↔token to avoid GitHub CORS.
 - `VITE_PRIVY_APP_ID` — Optional. If set, GitHub connect uses Privy and embedded wallets can be enabled.

You can copy the EAS contract address from EAS scan chain info for Base Sepolia.

## Scripts
- `pnpm dev` — run locally
- `pnpm build` — production build
- `pnpm preview` — preview build
- `pnpm typecheck` — run TypeScript

## Flow
1. Connect wallet (BYOW). If not on Base Sepolia, click switch.
2. Connect GitHub (OAuth PKCE) to fetch your username and allow gist creation.
3. Click “Create Proof Gist” to auto-create a public proof, or paste an existing gist URL.
4. Click “Sign Username” to produce a wallet signature.
5. Click “Submit Attestation” to publish on Base Sepolia EAS.

## Notes
- Single-transaction AA wallet deployment and permissioning are out-of-scope for this minimal UI. Hooks are designed to be extended to an AA path later.
- Public verification uses EAS GraphQL on base-sepolia (no backend/database required).
 - GitHub PKCE token exchange from a browser can hit CORS on `github.com/login/oauth/access_token`. If so, set `VITE_GITHUB_TOKEN_PROXY` to your serverless endpoint that performs the exchange server-side.

## Security Boundaries (MVP)
- Service wallet not used; user wallet signs and sends the attestation directly.
- Signature is verified client-side against the connected wallet before submitting.

## Tech
- React + Vite + TypeScript
- TailwindCSS + Radix Tabs (shadcn-style UI)
- viem for wallet + contract writes
- zod for validation
- EAS (attest) with ABI-encoded schema data

Tailwind build is configured via `tailwind.config.js`, `postcss.config.js`, and `src/index.css`.

## Monorepo Layout (Scaffolded)
- `src/main/typescript/apps/web` — web UI (current app will be migrated here)
- `src/main/typescript/packages/{sdk,abi,config}` — shared TS libs
- `src/main/solidity` — Foundry project for resolver contract
- `src/main/python` — Python utilities for explorer/BigQuery
- `src/generated/abi` — ABIs synced from Foundry for TS/Python

The existing app still runs from the repo root. We’ll migrate it into `src/main/typescript/apps/web` to keep the root clean in a follow-up step.
