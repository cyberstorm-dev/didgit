# Chain Configuration

Default chain is **Base mainnet**. Override with `CHAIN=arbitrum`.

## Base (default)

- `name`: base
- `chainId`: 8453
- `rpcUrl`: `https://mainnet.base.org` (override with `BASE_RPC_URL`)
- `easAddress`: `0x4200000000000000000000000000000000000021` (`BASE_EAS_ADDRESS`)
- `schemaRegistryAddress`: `0x4200000000000000000000000000000000000020` (`BASE_SCHEMA_REGISTRY_ADDRESS`)
- `resolverAddress`: `0x9A6F993e73E12Deba899c8856D78c7F05b71167A` (`BASE_RESOLVER_ADDRESS`)
- `schemaUids`:
  - `identity`: `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` (`BASE_IDENTITY_SCHEMA_UID`)
  - `contribution`: `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782` (`BASE_CONTRIBUTION_SCHEMA_UID`)
  - `permission`: `0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6` (`BASE_PERMISSION_SCHEMA_UID`)
  - `repoGlobs`: `0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74` (`BASE_REPO_GLOBS_SCHEMA_UID`)
- Roles (Base mainnet):
  - `owner`: `0xd04FC7D728AA0052dFB2A9C2D1251fdbe59a4f0b`
  - `attester` (on-chain role name: `verifier`): `0xD1c0CC69E0D8fF131D2775E2B541df1541092E3a`
  - `treasury`: `0xB7ec37267f8a6Bb08124653CE500B916d284Dae2`
- Explorers:
  - BaseScan: `https://basescan.org`
  - EASScan (Base): `https://base.easscan.org`

## Arbitrum One

- `name`: arbitrum
- `chainId`: 42161
- `rpcUrl`: `https://arb1.arbitrum.io/rpc` (override with `ARBITRUM_RPC_URL`)
- `easAddress`: **TBD** (`ARBITRUM_EAS_ADDRESS`)
- `schemaRegistryAddress`: **TBD** (`ARBITRUM_SCHEMA_REGISTRY_ADDRESS`)
- `resolverAddress`: **TBD** (`ARBITRUM_RESOLVER_ADDRESS`)
- `schemaUids`:
  - `identity`: **TBD** (`ARBITRUM_IDENTITY_SCHEMA_UID`)
  - `contribution`: **TBD** (`ARBITRUM_CONTRIBUTION_SCHEMA_UID`)
  - `permission`: **TBD** (`ARBITRUM_PERMISSION_SCHEMA_UID`)
  - `repoGlobs`: **TBD** (`ARBITRUM_REPO_GLOBS_SCHEMA_UID`)
- Explorers:
  - Arbiscan: `https://arbiscan.io`
  - EASScan (Arbitrum): `https://arbitrum.easscan.org`

> [!IMPORTANT]
> Schema UIDs are chain-specific and must be registered separately on each chain.
