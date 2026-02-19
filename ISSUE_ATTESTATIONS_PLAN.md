# Implementation Plan: Issue Attestations (GitHub Issue #19)

## Executive Summary

This plan outlines the implementation of issue attestations for didgit.dev, enabling users to track non-code contributions (bug reports, feature requests, issue triage) on-chain alongside commit attestations.

---

## 1. Schema Analysis

### Option A: Extend Existing Contribution Schema (NOT Recommended)

The current contribution schema:
```
string repo, string commitHash, string author, string message, uint64 timestamp, bytes32 identityUid
```

**Problems with reusing:**
- `commitHash` field is semantically tied to git commits
- Missing issue-specific metadata (state, labels, issue number)
- Would require overloading field meanings (e.g., `commitHash` = issue number)
- Harder to query/filter issues vs commits

### Option B: New Issue-Specific Schema (RECOMMENDED)

Create a dedicated schema for issue attestations:

```
string repo, uint64 issueNumber, string author, string title, string action, string labels, uint64 timestamp, bytes32 identityUid
```

**Tradeoffs:**
| Factor | Extend Contribution | New Schema |
|--------|-------------------|------------|
| Schema registration | None | One-time 0.001 ETH |
| Query complexity | Must filter by field | Clean separation |
| Future flexibility | Constrained | Extensible |
| Semantic clarity | Confusing | Clear |

**Recommendation: New Schema** — The one-time schema registration cost is minimal, and clean separation enables better querying, indexing, and future extensibility.

---

## 2. Metadata Design

### Proposed Issue Schema

```solidity
// Schema string (for EAS registration)
"string repo,uint64 issueNumber,string author,string title,string action,string labels,uint64 timestamp,bytes32 identityUid"
```

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `repo` | string | Full repository path | `"cyberstorm-dev/didgit"` |
| `issueNumber` | uint64 | GitHub issue number | `19` |
| `author` | string | GitHub username | `"cyberstorm-nisto"` |
| `title` | string | Issue title (truncated 100 chars) | `"Support issue attestations"` |
| `action` | string | Action being attested | `"opened"`, `"closed"`, `"commented"` |
| `labels` | string | Comma-separated labels | `"enhancement,good first issue"` |
| `timestamp` | uint64 | Action timestamp (Unix epoch) | `1738627200` |
| `identityUid` | bytes32 | Reference to identity attestation | `0x90687e...` |

### Supported Actions

| Action | Description | When to attest |
|--------|-------------|----------------|
| `opened` | User created the issue | On issue creation |
| `closed` | User closed the issue | When issue is closed by author |
| `commented` | User commented on issue | On substantive comments (optional) |
| `labeled` | User added labels | On triage activity (optional) |

**Initial scope:** Start with `opened` and `closed` actions, expand later.

---

## 3. Verification Strategy

### Challenge: Proving Issue Authorship

Unlike commits (which can be GPG-signed), GitHub issues don't have cryptographic signatures. We need an alternative verification approach.

### Approach: OAuth + API Verification

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────┐
│  User   │────▶│  GitHub  │────▶│  Verifier   │────▶│   EAS   │
│  Wallet │     │  OAuth   │     │   Service   │     │ Contract│
└─────────┘     └──────────┘     └─────────────┘     └─────────┘
     │               │                  │                 │
     │  1. Auth      │                  │                 │
     │──────────────▶│                  │                 │
     │               │                  │                 │
     │  2. Token     │                  │                 │
     │◀──────────────│                  │                 │
     │               │                  │                 │
     │  3. Request attestation          │                 │
     │─────────────────────────────────▶│                 │
     │               │                  │                 │
     │               │  4. Verify via   │                 │
     │               │◀─────────────────│                 │
     │               │     GitHub API   │                 │
     │               │                  │                 │
     │               │  5. Confirm      │                 │
     │               │─────────────────▶│                 │
     │               │                  │                 │
     │               │                  │  6. Attest      │
     │               │                  │────────────────▶│
     │               │                  │                 │
     │  7. Attestation UID              │                 │
     │◀─────────────────────────────────│                 │
```

### Verification Steps

1. **Identity Binding Exists**: User has valid identity attestation (GitHub username → wallet)
2. **OAuth Authentication**: User authenticated with GitHub (proves account ownership)
3. **API Verification**: Backend calls GitHub API to verify:
   - Issue exists in the specified repo
   - Issue author matches claimed username
   - Action (opened/closed) matches reality
4. **Attestation Creation**: Verifier creates attestation on user's behalf (via Kernel permission)

### Security Model

- **Trust anchor**: GitHub API as source of truth
- **Replay protection**: Check if attestation already exists for (repo, issueNumber, action, user)
- **Timing**: Only attest recent actions (configurable window, e.g., 30 days)

---

## 4. Integration Points

### Backend (`backend/src/`)

| File | Change |
|------|--------|
| `github.ts` | Add `getIssues()`, `getIssueDetails()`, `getUserIssueActivity()` functions |
| `service.ts` | Add `processIssues()` method alongside `processRepo()` |
| `attest-with-kernel.ts` | Add `attestIssueWithKernel()` function |
| **NEW** `issue-constants.ts` | Issue schema UID, encoding helpers |
| **NEW** `register-issue-schema.ts` | One-time schema registration |
| **NEW** `attest-issue.ts` | Issue attestation logic |

### Frontend (`src/main/typescript/apps/web/`)

| File | Change |
|------|--------|
| `utils/eas.ts` | Add `encodeIssueData()`, issue schema constants |
| `ui/Leaderboards.tsx` | Add "Issues" tab, fetch issue attestations |
| **NEW** `ui/IssueAttestation.tsx` | UI for viewing/requesting issue attestations |
| `ui/App.tsx` | Add navigation to issue attestations |

### Documentation (`docs/`)

| File | Change |
|------|--------|
| `schemas/CONTRIBUTION.md` | Update roadmap, link to issue schema |
| **NEW** `schemas/ISSUE.md` | Document issue attestation schema |
| `protocol/PROTOCOL.md` | Add issue attestations to "New Attestation Types" |

### Scripts (`scripts/`)

| File | Change |
|------|--------|
| **NEW** `attest-issue.mjs` | CLI script for manual issue attestation |

---

## 5. Implementation Order

### Phase 1: Schema & Backend Foundation

**Step 1.1: Register Issue Schema on EAS**
- Create `backend/src/register-issue-schema.ts`
- Register schema on Base Sepolia
- Record schema UID in constants

**Step 1.2: GitHub API Extensions**
- Add issue-fetching functions to `backend/src/github.ts`

**Step 1.3: Issue Attestation Logic**
- Create `backend/src/issue-constants.ts` with types and encoding
- Create `backend/src/attest-issue.ts` with attestation logic

### Phase 2: CLI Script

**Step 2.1: Manual Attestation Script**
- Create `scripts/attest-issue.mjs` for CLI usage
- Test schema registration and attestation flow

### Phase 3: Documentation

**Step 3.1: Schema Documentation**
- Create `docs/schemas/ISSUE.md`
- Update related documentation

### Phase 4 (Future): Service + Frontend Integration

- Service polling integration
- Frontend leaderboard updates
- UI for browsing issue attestations

---

## Critical Review & Improvements

### What's Excellent About This Plan

1. **Clear schema design rationale** - Explains why new schema vs extending
2. **Detailed verification strategy** - OAuth + API verification is correct approach
3. **Phased implementation** - Sensible progression from backend to frontend
4. **Comprehensive file mapping** - Know exactly what to touch

### Areas for Improvement

1. **Schema field: `labels` should be `string` not `string[]`** - EAS doesn't support arrays in schema strings. Plan correctly uses comma-separated string.
2. **Missing: State field** - Should track issue state (open/closed) in attestation for easier querying
3. **Action field might be redundant** - If we have state + timestamps, can infer actions
4. **Title truncation** - 100 chars might be too small, suggest 200
5. **Missing: Closed by info** - Issues can be closed by author or others, should track

### Recommended Schema Refinement

```
string repo,uint64 issueNumber,string author,string title,string state,string labels,uint64 createdAt,uint64 closedAt,bytes32 identityUid
```

**Rationale:**
- `state` instead of `action` - More semantic, easier to query
- `createdAt` + `closedAt` - Explicit timestamps for both events
- `closedAt` = 0 means still open
- Remove redundant `action` field
- Simpler querying: "Find all closed issues" vs "Find all 'closed' action attestations"

---

## Implementation Decision: Simplified Scope

For this initial implementation, I recommend:

**Scope: MVP - Single attestation per issue (when opened)**
- One attestation per issue, created when issue is opened
- Schema: `string repo,uint64 issueNumber,string author,string title,string labels,uint64 timestamp,bytes32 identityUid`
- Skip: closed events (can be added as separate schema later)
- Focus: Get basic issue attestations working, then iterate

**Why simplified:**
- Faster to ship
- Easier to test
- Avoids complexity of multiple attestations per issue
- Can extend with "issue update" schema later

---

## Final Implementation Plan

### Phase 1: Schema Registration & Constants
1. Register simplified schema on Base Sepolia
2. Create `backend/src/issue-constants.ts` with schema UID and types

### Phase 2: GitHub API + Attestation Logic  
1. Add `getRepoIssues()` to `backend/src/github.ts`
2. Create attestation script `scripts/attest-issue.mjs`

### Phase 3: Test + Document
1. Test: Create test issue, attest it, verify on EAS
2. Document: Create `docs/schemas/ISSUE.md`

### Phase 4: Commit, Attest, PR
1. Commit all changes
2. Create contribution attestation for the commit
3. Create PR with full implementation
