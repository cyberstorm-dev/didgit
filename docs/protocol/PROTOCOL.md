# Protocol Architecture

Technical deep-dive into didgit.dev's trust model, schemas, and architecture.

## Design Principles

1. **On-chain truth** — Attestations live on-chain via EAS, not our servers
2. **Portable identity** — Your reputation follows your wallet, not your account
3. **Open schemas** — Anyone can read, verify, and build on attestations
4. **Minimal trust** — Attester is OSS; run your own if you don't trust ours

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Connect │───▶│  Sign   │───▶│  Gist   │───▶│ Attest  │  │
│  │ Wallet  │    │ Message │    │ Proof   │    │ On-chain│  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Verification Layer                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Attester  │───▶│  Signature  │───▶│  Contract   │     │
│  │   Service   │    │   Approval  │    │   Check     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        On-Chain Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │     EAS     │    │  Resolver   │    │   Schema    │     │
│  │  Contract   │    │  Contract   │    │  Registry   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Trust Model

### Current: Centralized Attester

```
User ──▶ Attester (cyberstorm-dev) ──▶ Contract
```

- Single trusted attester signs approvals
- Simple, low latency
- Trust anchor: cyberstorm-dev

> [!NOTE]
> In `UsernameUniqueResolverV2`, the on-chain role is named `verifier`. In docs and ops, we refer to this key as the **attester**.

### Future: Attester Registry

```
User ──▶ Any Registered Attester ──▶ Contract
         (Attester A, B, C...)
```

- Contract maintains list of approved attesters
- Any approved attester can sign
- Decentralized trust, same interface

### Alternative: Self-Sovereign

```
User ──▶ Own Attester ──▶ Own Resolver Instance
```

- Deploy your own resolver
- Set your own attester
- Full control, full responsibility

## Schemas

### Identity Schema

Links external identity (GitHub) to on-chain identity (wallet).

```
string domain        // "github.com"
string username      // "cyberstorm-nisto"
address wallet       // 0x0CA6...
string message       // "github.com:cyberstorm-nisto"
bytes signature      // ECDSA sig of message by wallet
string proof_url     // https://gist.github.com/...
```

**Invariants:**
- One username → one wallet (per domain)
- One wallet → one username (per domain)
- Signature must verify against wallet

### Contribution Schema

Links specific contributions to identity.

```
string repo          // "cyberstorm-dev/didgit"
string commitHash    // "abc123..."
string author        // "cyberstorm-nisto"
string message       // "feat: add verification"
uint64 timestamp     // Unix epoch
bytes32 identityUid  // Reference to identity attestation
```

**Invariants:**
- Must reference valid identity attestation
- Repo must be registered in resolver
- Commit must exist (verifiable on GitHub)

## Resolver Contract

The `UsernameUniqueResolver` enforces:

1. **Uniqueness** — No duplicate username↔wallet bindings
2. **Authorization** — Only registered repos can be attested
3. **Verification** — Attester signature required (v2)

### Key Functions

```solidity
// Bind identity (requires attester approval in v2)
function bindIdentity(
    string domain,
    string username,
    address wallet,
    bytes attesterSig,  // v2
    uint256 expiry      // v2
) external;

// Register repo pattern
function setRepoPattern(
    string domain,
    string username,
    string namespace,
    string name,
    bool enabled
) external;

// Check if repo is enabled
function isRepositoryEnabled(
    address owner,
    string domain,
    string identifier,
    string namespace,
    string name
) external view returns (bool);
```

## Verification Flow (v2)

```
1. User signs: "github.com:username"
2. User creates gist with proof JSON
3. User requests approval from attester
4. Attester checks:
   - Gist exists and is public
   - Gist owner matches claimed username
   - Signature in gist matches wallet
5. Attester signs: (domain, username, wallet, gistUrl, expiry)
6. User submits to contract with attester signature
7. Contract: ecrecover(sig) == trustedAttester?
8. If valid: attestation created
```

## Security Considerations

### Replay Protection
- Attester signatures include expiry timestamp
- Contract tracks used approvals (nonce or hash)

### Front-Running
- Attester approval is bound to specific wallet
- Can't be used by different address

### Gist Tampering
- Gist URL recorded in attestation
- Historical verification possible via GitHub API
- Consider IPFS pinning for immutability

### Key Compromise
- Attester key rotation supported
- Old signatures invalid after rotation
- User attestations remain valid (on-chain)

## Extensibility

### New Platforms

Adding GitLab, Bitbucket, etc.:
1. Same schemas, different `domain` field
2. Platform-specific attester logic
3. Same resolver contract

See [EXTENDING.md](./EXTENDING.md) for implementation guide.

### New Attestation Types

Beyond commits:
- Pull requests
- Issues closed
- Code reviews
- Releases

Each gets its own schema, references identity.

## Contract Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Base Mainnet | EAS | `0x4200000000000000000000000000000000000021` |
| Base Mainnet | SchemaRegistry | `0x4200000000000000000000000000000000000020` |
| Base Mainnet | UsernameUniqueResolver | `0x9A6F993e73E12Deba899c8856D78c7F05b71167A` |
| Base (mainnet) | EAS | `0x4200000000000000000000000000000000000021` |

---

*Open protocol. Verifiable identity. Portable reputation.*
