# Delegated Attestation Implementation Status

## What I Built

### Documentation
- ✅ `docs/protocol/DELEGATED_ATTESTATION.md` - Full architecture docs
- ✅ GitHub Issues #10, #11, #12 for backend, funding, and chart

### Code Investigation
- ✅ Found ZeroDev permissions package already in dependencies
- ✅ Identified the flow: user grants on-chain permission, verifier submits UserOps
- ✅ Created test implementation in `aa/permissions.ts` and `aa/test-permissions.ts`

## Architecture (Validated)

```
1. User creates Kernel wallet (AA)
2. User pre-funds wallet with ETH
3. User grants permission to verifier address via toPermissionValidator
   - Permission has call policy: only EAS.attest with contribution schema
   - Permission references verifier's signer address
4. Verifier service (backend):
   - Watches repos for commits (GitHub webhook or polling)
   - Validates commit ownership
   - Creates UserOp signed with verifier's key
   - Submits to ZeroDev bundler
5. Bundler executes UserOp
6. User's wallet validates: permission check passes
7. Gas paid from user's pre-funded wallet
```

## Final Architecture (Confirmed with Allen)

### Constraints
1. Verifier operates on cron (auto-detect commits)
2. Attestation paid from registrant's wallet
3. Registrant does nothing post-registration
4. Registrant configures their repos
5. **Registrant is tx submitter** (owns attestation, can revoke)

### Implementation

**AllowlistValidator.sol:**
- Deployed once with verifier address hardcoded
- Validator checks: "signature from verifier? allow"
- Trust verifier's signature (no on-chain oracle needed)
- Static allowlist (part of ops deployment)

**User flow:**
1. Register identity (existing flow)
2. Create Kernel wallet (existing)
3. Fund wallet with ETH for gas
4. Enable AllowlistValidator on Kernel account (one-time setup)
5. Done - verifier handles rest

**Verifier service (cron):**
1. Watch registered repos for new commits
2. Detect commits by registered users
3. Validate: commit exists, author matches identity
4. Sign attestation data with verifier private key
5. Create UserOp for user's Kernel wallet:
   - sender: user's wallet address
   - callData: execute(EAS.attest(...))
   - signature: verifier's signature
6. Submit UserOp to bundler
7. Bundler executes → user's wallet validates → EAS.attest called
8. Gas deducted from user's wallet
9. User owns attestation (can revoke directly)

**Key insight:** Verifier submits UserOp, but UserOp.sender is user's wallet. Gas comes from user, attestation owned by user. AllowlistValidator allows this because verifier signed it.

## What's Left to Build

### 1. Permission Grant UI (`RegisterPage.tsx`)
- Button: "Enable Automated Attestations"
- Creates permission validator with call policy
- Enables permission on user's Kernel account
- Shows permission ID and status

### 2. Backend Service (Node.js/Cloudflare Worker)
Endpoints:
- `POST /webhook/github` - Receives commit webhooks
- `POST /attest` - Manual attestation trigger (for testing)

Flow:
- Validate commit via GitHub API
- Check user has registered identity
- Create UserOp for EAS.attest
- Sign with verifier key + permission validator
- Submit to ZeroDev bundler
- Return attestation UID

### 3. GitHub App/Webhook
- Register GitHub App for commit events
- Or use repo webhooks for registered repos
- Trigger backend on push events

### 4. Commit Attestation Chart
- Query Contribution Schema attestations
- Add to StatsCard component
- Show time-series of commit attestations

## Time Estimate
- Permission grant UI: 2-4 hours
- Backend service: 4-6 hours
- GitHub webhook: 2-3 hours
- Chart UI: 1-2 hours
- Testing & debugging: 4-6 hours
**Total: ~15-20 hours** (assuming key issue resolved)

## Questions for Allen

1. **Verifier key:** Do you have the private key for `0x0CA6...`, or should I update the resolver to use `0xa11CE...`?
2. **Backend hosting:** Preference for where to run the attestation service? (Cloudflare Worker, Vercel, VPS, local for now?)
3. **GitHub App:** Should I create a new GitHub App for didgit, or use existing webhook setup?
4. **Testing approach:** OK to test on Base Sepolia with fresh deployments, or need to preserve existing state?
