# Identity Attestations

This document describes the identity attestation schema for linking GitHub usernames to wallet addresses.

## Overview

The identity attestation is the **cornerstone** of didgit.dev — it creates a verified, on-chain link between a GitHub username and a wallet address. Once attested, this identity can be referenced by contribution attestations to build an immutable activity graph.

## Schema

**Schema UID (Base Sepolia):** `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af`

```
string domain,string username,address wallet,string message,bytes signature,string proof_url
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `domain` | string | Identity provider domain (e.g., `github.com`) |
| `username` | string | Username on the domain (case-insensitive, stored lowercase) |
| `wallet` | address | EOA wallet address being linked |
| `message` | string | Signed message format: `{domain}:{username}` |
| `signature` | bytes | ECDSA signature of the message by the wallet |
| `proof_url` | string | URL to public proof (e.g., GitHub gist) |

## Verification Flow

### 1. Connect Wallet + GitHub

User connects their wallet (via Web3Auth) and authenticates with GitHub OAuth.

### 2. Sign Identity Message

The wallet signs a message proving ownership:

```
github.com:cyberstorm-nisto
```

This creates a cryptographic binding between the wallet's private key and the claimed username.

### 3. Create Public Proof

A public GitHub gist is created containing:

```json
{
  "domain": "github.com",
  "username": "cyberstorm-nisto",
  "wallet": "0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd",
  "message": "github.com:cyberstorm-nisto",
  "signature": "0x...",
  "chain_id": 84532,
  "schema_uid": "0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af"
}
```

This gist:
- Proves the GitHub account holder authorized the binding
- Provides an off-chain verifiable reference
- Can be checked even if EAS is unavailable

### 4. Submit Attestation

The attestation is submitted on-chain via EAS, with the signing wallet as both attester and recipient.

## Uniqueness Enforcement

The `UsernameUniqueResolver` contract ensures:

1. **One username → one wallet** (per domain): Each GitHub username can only be linked to one wallet
2. **One wallet → one username** (per domain): Each wallet can only claim one GitHub username

This prevents:
- Squatting on usernames
- Linking multiple wallets to the same identity
- Sybil attacks via identity multiplication

**Resolver (Base Sepolia):** `0x7419150b821a507ef60c618d03c26517310ee633`

## Off-Chain Verification (Hardening)

### Current Model

User creates gist → User submits attestation → Contract records binding

### Enhanced Model (In Progress)

User creates gist → **Attester service checks gist** → **Attester signs approval** → User submits with attester signature → Contract checks `ecrecover == trustedAttester`

This adds:
- Server-side verification that the gist exists and contains valid data
- Protection against front-running or forged proofs
- A trusted party confirms the binding before on-chain submission

## Querying Identities

### By Username

```graphql
query GetIdentity($username: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x6ba0509..." }
      decodedDataJson: { contains: $username }
    }
  ) {
    id
    recipient
    attester
    decodedDataJson
  }
}
```

### By Wallet

```graphql
query GetIdentityByWallet($wallet: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x6ba0509..." }
      recipient: { equals: $wallet }
    }
  ) {
    id
    decodedDataJson
  }
}
```

## Security Considerations

1. **Signature Verification**: Always verify the signature matches the claimed wallet before accepting
2. **Username Normalization**: Store and compare usernames in lowercase to prevent case confusion
3. **Gist Ownership**: The gist should be created by the authenticated GitHub user (OAuth token validates this)
4. **Revocation**: Attestations can be revoked if an identity is compromised

## Related

- [Contribution Attestations](./CONTRIBUTION_ATTESTATIONS.md) - Activity tracking
- [UsernameUniqueResolver](../src/main/solidity/src/UsernameUniqueResolver.sol) - Uniqueness enforcement
- [EAS Documentation](https://docs.attest.sh/) - Ethereum Attestation Service
- [Base Sepolia Explorer](https://base-sepolia.easscan.org/) - View attestations
