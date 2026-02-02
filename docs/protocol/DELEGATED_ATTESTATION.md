# Delegated Attestation Architecture

This document describes how didgit handles attestations where users don't pay gas directly.

## Overview

There are two types of attestations in didgit:

1. **Identity Attestations** - User pays gas (one-time registration)
2. **Contribution Attestations** - Verifier pays gas (per-commit, delegated)

## Why Delegated Attestation?

Commit attestations could number in hundreds or thousands per user. Requiring users to pay gas for each would:
- Create friction (wallet interaction per commit)
- Cost users significant fees over time
- Discourage frequent committing

Instead, users prove ownership once (identity), and a trusted verifier attests to their commits.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Agent/CLI     │     │  Verifier Backend │     │   Base Chain    │
│                 │     │                   │     │                 │
│  Has registered │────▶│  Validates commit │────▶│  EAS.attest()   │
│  identity       │     │  via GitHub API   │     │                 │
│                 │◀────│  Returns UID      │◀────│  Stores record  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Flow

### 1. Prerequisites
- User has registered identity (username ↔ wallet binding)
- User has committed code to a repository
- Verifier wallet has ETH for gas

### 2. Request Attestation
```bash
POST /api/attest-commit
{
  "commitHash": "abc123...",
  "repoOwner": "cyberstorm-dev",
  "repoName": "didgit",
  "branch": "main"  // optional
}
Authorization: Bearer <user-token or signed message>
```

### 3. Backend Validation
1. Fetch commit from GitHub API
2. Extract author email/username
3. Query resolver: does this author have a registered identity?
4. Verify the requester owns that identity
5. Check rate limits

### 4. On-Chain Attestation
```solidity
eas.attest({
  schema: CONTRIBUTION_SCHEMA_UID,
  data: {
    recipient: userAddress,
    refUID: identityAttestationUID,  // links to identity
    data: abi.encode(commitHash, repoName, timestamp)
  }
})
```

### 5. Return Result
```json
{
  "success": true,
  "attestationUid": "0x...",
  "explorerUrl": "https://base-sepolia.easscan.org/attestation/view/0x..."
}
```

## Wallet Roles

### Verifier Wallet
- Address: Set in `UsernameUniqueResolverV2.verifier`
- Permissions: Can sign verification messages, pays gas for delegated attestations
- Funding: Must maintain ETH balance for gas

### User Wallet
- Pays gas only for identity registration (one-time)
- Signs messages to prove ownership for commit attestation requests
- Never needs to interact with chain for contributions

## Security Considerations

### Rate Limiting
- Per-identity daily/hourly limits
- Prevents spam attestations draining verifier funds

### Validation
- All commits verified against GitHub API
- Author must match registered identity
- Replay protection via nonces or timestamps

### Key Management
- Verifier private key in secure storage (KMS, HSM)
- Backend has spending limits
- Monitoring for anomalous activity

## Schemas

### Identity Schema
```
UID: 0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
Fields: domain (string), username (string)
```

### Contribution Schema
```
UID: 0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782
Fields: commitHash (bytes32), repoName (string), timestamp (uint64)
RefUID: Points to user's identity attestation
```

## Future Enhancements

### Account Abstraction (AA)
- Batched attestations (multiple commits per tx)
- Paymaster integration (gasless for users)
- Multi-sig for verifier security

### Decentralization
- Multiple verifiers with stake
- Slashing for false attestations
- Community governance of verifier set

## Related Issues
- [#10 Delegated commit attestation backend](https://github.com/cyberstorm-dev/didgit/issues/10)
- [#11 Fund verifier wallet](https://github.com/cyberstorm-dev/didgit/issues/11)
- [#12 Commit attestation chart](https://github.com/cyberstorm-dev/didgit/issues/12)
