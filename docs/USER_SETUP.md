# User Setup for Automated Attestations

## Overview

To enable automated commit attestations that you pay for, you need to authorize the attester to create attestations on your behalf using your Kernel (smart) wallet.

## Prerequisites

1. You have registered your GitHub identity (created Kernel wallet)
2. Your Kernel wallet has some ETH for gas (~0.01 ETH recommended)
3. You can access your Kernel wallet via Etherscan

## One-Time Setup

### Option A: Via Etherscan (Recommended)

1. **Find Your Kernel Account Address**
   - Check your identity attestation on EAS Scan
   - Your Kernel address is the recipient address

2. **Go to Etherscan**
   - Navigate to: https://sepolia.basescan.org/address/YOUR_KERNEL_ADDRESS#writeProxyContract
   - Connect your wallet (the one that controls the Kernel account)

3. **Enable Permission Validator**
   - TODO: Add specific function call instructions once validator is deployed

### Option B: Programmatic (Advanced)

```typescript
// Coming soon: CLI tool for this
npm run setup-attestation-permission
```

## Verification

After setup, verify the permission is enabled:

1. Check your Kernel account on Etherscan
2. Look for `PermissionConfig` or similar storage slot
3. Attester address should be authorized (see `docs/CHAINS.md` for the active chain)

## What This Enables

Once set up, the attester service will:
- Detect your commits automatically
- Create attestation transactions
- Submit them to the network
- Your wallet will validate the permission and execute
- Gas is paid from your Kernel wallet balance

You remain in control:
- You can revoke the permission anytime
- You own all attestations (can revoke individually)
- You can see all transactions on-chain

## Support

If you encounter issues:
- Check your Kernel wallet has ETH
- Verify the permission was set correctly
- Ask in Discord: [link TBD]
