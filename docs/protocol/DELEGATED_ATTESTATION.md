# Delegated Attestation Architecture

This document describes how didgit handles contribution attestations where users don't sign each transaction.

## Overview

There are two types of attestations in didgit:

1. **Identity Attestations** — User signs & pays gas (one-time registration)
2. **Contribution Attestations** — User pays gas via session key (automatic, per-commit)

## Why Session Keys?

Commit attestations could number in hundreds or thousands per user. Options considered:

| Approach | Problem |
|----------|---------|
| User signs each | UX friction, wallet popup per commit |
| Attester pays | Attestations owned by attester, not user |
| Paymaster | Still need user signature |
| **Session Key** | ✓ User pays, user owns, no signing needed |

**Session keys win.** The user grants a scoped permission once, then attestations happen automatically with the user as owner.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SESSION KEY FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ONE-TIME SETUP (user involved):                               │
│   ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐   │
│   │  User EOA   │───▶│ Deploy Kernel │───▶│ Grant Permission │   │
│   │             │    │ Smart Account │    │ to Attester      │   │
│   └─────────────┘    └───────────────┘    └─────────────────┘   │
│                                                  │               │
│                                     Serialize permission        │
│                                                  ▼               │
│                               ┌──────────────────────────┐      │
│                               │ .permission-account.json │      │
│                               └──────────────────────────┘      │
│                                                                  │
│   RUNTIME (fully automatic):                                    │
│   ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐   │
│   │  Backend    │───▶│ Deserialize   │───▶│ Sign UserOp     │   │
│   │  (attester) │    │ Permission    │    │ as Attester     │   │
│   └─────────────┘    └───────────────┘    └─────────────────┘   │
│                                                  │               │
│                                    Submit to bundler            │
│                                                  ▼               │
│   ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐   │
│   │ User's      │◀───│   Execute     │◀───│    Bundler      │   │
│   │ Kernel      │    │  EAS.attest() │    │                 │   │
│   └─────────────┘    └───────────────┘    └─────────────────┘   │
│         │                                                        │
│         └─▶ Pays gas from Kernel balance                        │
│         └─▶ Attestation FROM user's address                     │
│         └─▶ User can revoke permission anytime                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Permission Scope

The session key permission is narrowly scoped:

```typescript
const callPolicy = toCallPolicy({
  policyVersion: CallPolicyVersion.V0_0_4,
  permissions: [
    {
      target: EAS_ADDRESS,        // 0x4200...0021
      selector: ATTEST_SELECTOR,  // 0xf17325e7 (attest function)
      valueLimit: BigInt(0)       // No ETH transfer allowed
    }
  ]
});
```

The attester **can only**:
- Call `EAS.attest()` on the specific EAS contract
- With zero value

The attester **cannot**:
- Transfer tokens
- Call any other contract
- Call any other EAS function

## Security Model

### User Maintains Control

1. **Ownership**: Attestations are FROM the user's Kernel, not the attester
2. **Revocation**: User can remove the permission at any time via Kernel
3. **Gas**: User's Kernel balance pays — attester has no spending authority
4. **Audit**: All attestations visible on-chain under user's address

### Key Management

| Key | Location | Access |
|-----|----------|--------|
| User's EOA | User only | Setup only, never at runtime |
| User's Kernel | On-chain | Controlled by user's EOA |
| Attester | Backend | Signs UserOps, cannot spend |
| Serialized Permission | `.permission-account.json` | Contains enable signature |

### Attack Vectors Mitigated

| Attack | Mitigation |
|--------|------------|
| Attester drains wallet | Permission scoped to attest() only |
| Spam attestations | Rate limits on backend |
| False attestations | GitHub API validation required |
| Attester key leak | User revokes permission |

## Setup Flow

### 1. User Registers Identity
Standard didgit identity attestation (GitHub ↔ wallet binding).

### 2. User Deploys Kernel
ZeroDev Kernel v3.1 smart account with ECDSA validator.

### 3. User Grants Permission
```typescript
// One-time setup with USER_PRIVKEY
const permissionValidator = await toPermissionValidator(publicClient, {
  signer: attesterSigner,
  policies: [callPolicy],
  entryPoint,
  kernelVersion: KERNEL_V3_1
});

const kernelWithPermission = await createKernelAccount(publicClient, {
  plugins: {
    sudo: ecdsaValidator,
    regular: permissionValidator
  },
  entryPoint,
  kernelVersion: KERNEL_V3_1
});

// Serialize for runtime use
const serialized = await serializePermissionAccount(
  kernelWithPermission, 
  ATTESTER_PRIVKEY
);
```

### 4. Backend Stores Permission
The serialized permission contains everything needed to use it later:
- Enable signature (user's authorization)
- Permission policies
- Kernel address

**No user private key needed at runtime.**

## Runtime Flow

### 1. Backend Detects Commit
Monitors registered repos via GitHub API.

### 2. Deserialize Permission
```typescript
const kernelAccount = await deserializePermissionAccount(
  publicClient,
  entryPoint,
  KERNEL_V3_1,
  serializedAccount
);
```

### 3. Create & Sign UserOp
```typescript
const kernelClient = createKernelAccountClient({
  account: kernelAccount,
  chain: baseSepolia,
  bundlerTransport: http(bundlerRpc)
});

const userOpHash = await kernelClient.sendUserOperation({
  callData: await kernelAccount.encodeCalls([{
    to: EAS_ADDRESS,
    value: 0n,
    data: attestCallData
  }])
});
```

### 4. Kernel Executes
- Bundler validates and submits
- Kernel checks permission validator
- EAS.attest() executed
- Gas paid from Kernel balance
- Attestation logged with Kernel as attester

## Schemas

### Identity Schema
```
UID: 0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
Fields: domain (string), username (string)
Attester: User (self-attestation)
```

### Contribution Schema
```
UID: 0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782
Fields: repo (string), commitHash (string), author (string), 
        message (string), timestamp (uint64), identityUid (bytes32)
RefUID: Points to user's identity attestation
Attester: User's Kernel (via session key)
```

### Repo Globs Schema
```
UID: 0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74
Fields: pattern (string), e.g., "cyberstorm-dev/*"
RefUID: Points to user's identity attestation
```

## Comparison: Old vs New

| Aspect | Attester Pays (v0.1) | Session Key (v0.2) |
|--------|---------------------|-------------------|
| Gas payer | Attester | User's Kernel |
| Attestation owner | Attester | User |
| User control | None | Full (can revoke) |
| Runtime key needed | Attester only | Attester only |
| Trust model | Trust attester | Cryptographic scope |

## FAQ

**Q: What if the user's Kernel runs out of ETH?**
A: Attestations fail with "insufficient balance". User needs to fund their Kernel.

**Q: Can the attester steal funds?**
A: No. Permission is scoped to `attest()` only with zero value.

**Q: What if the attester key is compromised?**
A: User revokes the permission. Worst case: spam attestations (annoying, not harmful).

**Q: Can users attest their own commits?**
A: Yes, if they want to pay gas directly. Session keys just automate it.

---

*Session keys enable the best of both worlds: automatic attestations with user ownership.*
