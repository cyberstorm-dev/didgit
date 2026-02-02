# Delegated Attestation - User-Pays-Gas Progress

## 🎯 Goal
Enable automated commit attestations where:
- Verifier detects commits (cron/webhook)
- Verifier creates UserOps for user's Kernel wallet
- User's wallet pays gas (not verifier)
- User owns attestations (can revoke)

## ✅ What's Built

### 1. SimpleAllowlistValidator Contract
**Deployed:** `0x42c340f4bb328df1a62d5cea46be973698ae1e37` (Base Sepolia)
- Validates that signer is the verifier address (`0x0CA6...`)
- Allows verifier to sign UserOps on behalf of users
- Deployed successfully with verifier + EAS address hardcoded

**Files:**
- `backend/src/SimpleAllowlistValidator.sol` - Contract source
- `backend/src/SimpleAllowlistValidator.abi.json` - ABI
- `backend/src/compile-and-deploy.ts` - Deployment script

### 2. Test Scripts
**Files:**
- `backend/src/test-full-flow.ts` - Proves backend derives different address without explicit address param
- `backend/src/test-with-explicit-address.ts` - Proves `createKernelAccount({address})` CAN reference user's Kernel

**Key Finding:** ZeroDev SDK's `createKernelAccount` accepts an `address` parameter that allows backend to reference user's existing Kernel account!

### 3. Working MVP Backend
**Files:**
- `backend/src/attest.ts` - Current verifier-pays-gas implementation (WORKING)
- `backend/src/attest-with-permissions.ts` - User-pays-gas attempt (needs fixing)

## 🚧 What's Left

### Critical Path Issues

#### 1. Kernel Account Deployment + Funding
**Problem:** User's Kernel account must be:
- Deployed (requires first UserOp)
- Funded with ETH (to pay gas)

**Solutions:**
A) User deploys + funds manually (frontend UI needed)
B) Verifier funds user's Kernel initially (centralized bootstrap)
C) Paymaster sponsors deployment + first tx (requires paymaster integration)

#### 2. Permission/Validator Installation
**Problem:** User must enable SimpleAllowlistValidator on their Kernel account

**Current Understanding:**
- Kernel v3 has plugin system
- Need to call some `installPlugin` or similar
- OR specify validator at account creation time
- OR permission validator approach (ZeroDev SDK)

**Questions:**
- Can SimpleAllowlistValidator be used standalone? Or does it need to implement full Kernel validator interface?
- Do we use ZeroDev's permission system OR custom SimpleAllowlistValidator?
- How does user enable it? (Transaction? Part of account creation?)

#### 3. Backend UserOp Construction
**Problem:** Backend needs to create UserOps for user's Kernel, but SDK derives different address

**Current Approach:**
```typescript
const kernelAccount = await createKernelAccount(publicClient, {
  entryPoint,
  kernelVersion,
  address: userKernelAddress, // Explicit address!
  plugins: {
    sudo: permissionValidator // Verifier's validator
  }
});
```

**Issue:** When account doesn't exist yet, SDK tries to deploy it with factory data that derives DIFFERENT address (because plugins are different from what user used).

**Possible Solutions:**
A) Only use this after account is deployed (check bytecode first)
B) Don't include factory/factoryData when account exists
C) Reconstruct factory data that matches user's original deployment

### Dependencies

**Backend npm packages:**
- ✅ @zerodev/permissions (installed)
- ✅ @zerodev/sdk (installed)
- ✅ @zerodev/ecdsa-validator (installed)
- ✅ solc (installed)
- ✅ tslib (installed)

**Contract deployments:**
- ✅ SimpleAllowlistValidator: `0x42c340f4bb328df1a62d5cea46be973698ae1e37`
- ❓ Do we need more? (Factory? Registry?)

## 🔬 Test Results

### Test 1: Full Flow (test-full-flow.ts)
```
User Kernel address:    0x2Ce0cE887De4D0043324C76472f386dC5d454e96
Backend derived address: 0x3B6D13Fff8bA706EFaB9dC836C8397653dC9a320
Matches? NO ❌
```
**Conclusion:** Without explicit address, backend derives different address.

### Test 2: Explicit Address (test-with-explicit-address.ts)
```
User Kernel address:    0x2Ce0cE887De4D0043324C76472f386dC5d454e96
Backend Kernel address: 0x2Ce0cE887De4D0043324C76472f386dC5d454e96
Matches? YES ✅
```
**Conclusion:** Explicit address param WORKS! But deployment fails due to insufficient funds.

### Current Blocker
```
Error: AA21 didn't pay prefund
Details: Smart Account does not have sufficient funds
```
User's Kernel needs ETH to deploy + execute.

## 📋 Next Steps (In Order)

### Option A: Manual Bootstrap (Fastest)
1. User creates Kernel account via frontend
2. User funds Kernel with 0.01 ETH (manual send)
3. User enables SimpleAllowlistValidator (frontend button)
4. Backend creates UserOps using `createKernelAccount({address})`
5. Test end-to-end with funded account

### Option B: Verifier Bootstrap (More Automated)
1. Backend detects new user registration
2. Verifier sends 0.001 ETH to user's Kernel address
3. Backend creates deployment UserOp
4. User pays gas going forward

### Option C: Paymaster (Most Complex)
1. Integrate ZeroDev paymaster
2. Sponsor deployment + first few txs
3. User funds Kernel after initial usage

**Recommended:** Start with Option A to validate the architecture, then consider B or C.

## 🤔 Open Questions

1. **Does SimpleAllowlistValidator need full Kernel validator interface?**
   - Current implementation is minimal (validateSignature, isValidCaller)
   - May need: validateUserOp, enable/disable hooks, etc.
   - OR use ZeroDev's permission system instead?

2. **How to avoid factory data address mismatch?**
   - Explicit address param seems to help
   - But SDK still generates factory data
   - Need to handle "account already deployed" case explicitly

3. **Should we deploy AllowlistValidator at all, or use pure ZeroDev permissions?**
   - AllowlistValidator: Custom contract, more control
   - ZeroDev permissions: SDK-based, less code
   - Trade-off: simplicity vs. flexibility

4. **What's the user activation flow?**
   - Create Kernel → fund → enable validator → done?
   - Or: Create Kernel → enable validator → fund → done?
   - Need clear frontend UX

## 📊 Time Estimate to Complete

**Assuming Option A (Manual Bootstrap):**
- Fix backend UserOp construction: 2-3 hours
- Frontend: Kernel creation + funding UI: 2-3 hours
- Frontend: Enable SimpleAllowlistValidator UI: 3-4 hours
- Integration testing: 2-3 hours
- Documentation: 1-2 hours

**Total: ~12-16 hours**

**Current session:** ~4-5 hours invested
