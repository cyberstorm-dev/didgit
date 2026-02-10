# Bounties Guide

Use didgit.dev attestations to prove bounty completion and automate rewards.

## The Problem

Traditional bounty flow:
1. Project posts bounty
2. Hunter claims completion
3. Project manually verifies
4. Dispute resolution (often)
5. Payment (eventually)

With attestations:
1. Project posts bounty with verification criteria
2. Hunter completes work → commit attested
3. Attestation proves completion → payment triggers

## Bounty Workflow

### For Bounty Posters

#### 1. Define Completion Criteria

Specify what constitutes completion:
- Specific commit to specific repo
- PR merged to main branch
- Issue closed with linked commit

#### 2. Set Up Verification

Option A: **Manual verification with attestation proof**
```
Bounty: Fix issue #42
Proof required: Contribution attestation linking your identity to the fix commit
```

Option B: **Automated verification** (via smart contract)
```solidity
function claimBounty(bytes32 contributionUid) external {
    // Verify attestation exists and matches criteria
    Attestation memory att = eas.getAttestation(contributionUid);
    require(!att.revoked, "Attestation revoked");
    require(att.schema == CONTRIBUTION_SCHEMA, "Wrong schema");
    
    // Decode and check repo/commit
    (string memory repo, string memory commitHash, ...) = 
        abi.decode(att.data, (string, string, ...));
    require(keccak256(bytes(repo)) == keccak256(bytes(requiredRepo)), "Wrong repo");
    
    // Pay the attester
    payable(att.recipient).transfer(bountyAmount);
}
```

### For Bounty Hunters

#### 1. Set Up Identity

Before hunting, complete [Getting Started](../GETTING_STARTED.md):
- Link GitHub to wallet
- Register repos you'll contribute to

#### 2. Complete the Work

Do the work, commit, get merged.

#### 3. Attest the Contribution

Ensure your contribution is attested (automatic if using didgit attestor).

#### 4. Submit Proof

Provide the attestation UID to claim:
```
Bounty completion proof:
- Attestation: 0x4a9aac12...
- Commit: abc123
- View: https://base.easscan.org/attestation/view/0x...
```

## Smart Contract Integration

### Simple Bounty Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IEAS, Attestation } from "@eas/IEAS.sol";

contract AttestationBounty {
    IEAS public immutable eas;
    bytes32 public immutable contributionSchema;
    
    struct Bounty {
        string requiredRepo;
        uint256 amount;
        address poster;
        bool claimed;
    }
    
    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCount;
    
    function createBounty(string calldata repo) external payable {
        bounties[bountyCount++] = Bounty({
            requiredRepo: repo,
            amount: msg.value,
            poster: msg.sender,
            claimed: false
        });
    }
    
    function claimBounty(uint256 bountyId, bytes32 attestationUid) external {
        Bounty storage bounty = bounties[bountyId];
        require(!bounty.claimed, "Already claimed");
        
        Attestation memory att = eas.getAttestation(attestationUid);
        require(!att.revoked, "Revoked");
        require(att.schema == contributionSchema, "Wrong schema");
        
        // Verify repo matches (simplified)
        // In production, decode and validate all fields
        
        bounty.claimed = true;
        payable(att.recipient).transfer(bounty.amount);
    }
}
```

### Escrow with Dispute Resolution

For higher-value bounties, add:
- Time-locked claims
- Poster approval period
- Arbitration fallback

## Platform Integration

### GitHub Issues

Label bounties and track with issue references:
```markdown
## 💰 Bounty: $500 USDC

**Task:** Implement GitLab support
**Repo:** cyberstorm-dev/didgit
**Proof:** Contribution attestation for merged PR

[Claim instructions →](https://didgit.dev/bounties/claim)
```

### Gitcoin / Bountycaster

Link attestation proofs to existing bounty platforms for verification layer.

## Example Flow

1. **Project posts:** "Fix rate limiting bug — 0.1 ETH"
2. **Hunter sees bounty, already has didgit identity**
3. **Hunter fixes bug, PR merged**
4. **Contribution attested:** `0xabc123...`
5. **Hunter submits attestation UID to bounty contract**
6. **Contract verifies → pays hunter automatically**

## FAQ

**What if the attestation is wrong?**
Poster can dispute before claim window closes. Attestations can be revoked.

**Can I hunt without didgit identity?**
You'll need to set one up first. Takes ~5 minutes.

**What chains are supported?**
Base (mainnet and Sepolia). More chains possible via EAS deployments.

---

*Trustless bounties, powered by verifiable contributions.*
