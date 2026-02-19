# Issue Attestations

This document describes the issue attestation schema for tracking verified GitHub issue contributions on-chain.

## Overview

Issue attestations extend didgit.dev's contribution tracking beyond code commits to include non-code contributions such as:
- Bug reports
- Feature requests
- Issue triage and labeling
- Documentation requests

Each issue attestation links a specific GitHub issue to an on-chain identity, enabling reputation building for all forms of contribution.

## Schema

**Schema UID (Base Sepolia):** `0x56dcaaecb00e7841a4271d792e4e6a724782b880441adfa159aa06fa1cfda9cc`

```
string repo,uint64 issueNumber,string author,string title,string labels,uint64 timestamp,bytes32 identityUid
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | Full repository name (e.g., `cyberstorm-dev/didgit`) |
| `issueNumber` | uint64 | GitHub issue number |
| `author` | string | GitHub username who created the issue |
| `title` | string | Issue title (truncated to 200 chars) |
| `labels` | string | Comma-separated labels (e.g., `"bug,good first issue"`) |
| `timestamp` | uint64 | Issue creation timestamp (Unix epoch) |
| `identityUid` | bytes32 | Reference to identity attestation UID |

### Relationships

Each issue attestation references an **identity attestation** via:
1. `identityUid` field in the attestation data
2. `refUID` in the EAS attestation request (creates on-chain link)

This enables:
- Verifying the issue creator's wallet ownership
- Querying all issues created by a given identity
- Building comprehensive reputation graphs across commits AND issues

## Current Scope (MVP)

The initial implementation attests **issue creation only**:
- One attestation per issue
- Created when the issue is opened
- Captures issue metadata at creation time

### Future Extensions

Potential future attestations:
- Issue closure (who closed the issue)
- Issue comments (substantive contributions)
- Issue labels added (triage activity)
- Issue assignments

Each would use a separate schema or action field to track different types of issue activity.

## Usage

### Manual Attestation via CLI

```bash
cd ~/projects/didgit
node scripts/attest-issue.mjs --repo owner/name --issue NUMBER
```

**Example:**
```bash
node scripts/attest-issue.mjs --repo cyberstorm-dev/didgit --issue 19
```

### Creating Attestations Programmatically

```typescript
import { encodeIssueAttestationData } from './backend/src/issue-constants';

const issueData = encodeIssueAttestationData({
  repo: 'cyberstorm-dev/didgit',
  issueNumber: 19n,
  author: 'cyberstorm-nisto',
  title: 'Support issue attestations',
  labels: 'enhancement,help wanted',
  timestamp: 1738627152n,
  identityUid: '0xd440aad8...'
});

await eas.attest({
  schema: ISSUE_SCHEMA_UID,
  data: {
    recipient: authorWallet,
    refUID: identityUid,
    data: issueData
  }
});
```

## Verification

### Proving Issue Authorship

Unlike commits (which can be cryptographically signed), GitHub issues rely on **OAuth + API verification**:

1. **Identity Binding**: User has valid identity attestation (GitHub username → wallet)
2. **GitHub API**: Verify issue exists and author matches via GitHub API
3. **Attestation**: Create on-chain attestation linking issue to identity

The attestation acts as a **timestamp proof** that:
- The GitHub API confirmed this user created this issue
- The issue existed at the time of attestation
- The identity <-> wallet binding was valid

### Querying Issue Attestations

**By Identity:**
```graphql
query GetIssues($identityUid: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x56dcaae..." }
      refUID: { equals: $identityUid }
      revoked: { equals: false }
    }
    orderBy: { timeCreated: desc }
  ) {
    id
    decodedDataJson
    timeCreated
  }
}
```

**By Repository:**
```graphql
query GetRepoIssues($repo: String!) {
  attestations(
    where: {
      schemaId: { equals: "0x56dcaae..." }
      decodedDataJson: { contains: $repo }
    }
  ) {
    id
    recipient
    decodedDataJson
  }
}
```

## Example Attestation

**Issue:** [cyberstorm-dev/didgit#19 - Support issue attestations](https://github.com/cyberstorm-dev/didgit/issues/19)

**Attestation UID:** `0x0000000000000000000000007a1de0fa7242194bba84e915f39bf7e621b50d2e`

**View on EAS:** [https://base-sepolia.easscan.org/attestation/view/0x0000000000000000000000007a1de0fa7242194bba84e915f39bf7e621b50d2e](https://base-sepolia.easscan.org/attestation/view/0x0000000000000000000000007a1de0fa7242194bba84e915f39bf7e621b50d2e)

**Data:**
```json
{
  "repo": "cyberstorm-dev/didgit",
  "issueNumber": 19,
  "author": "cyberstorm-nisto",
  "title": "Support issue attestations",
  "labels": "enhancement,help wanted",
  "timestamp": 1738627152,
  "identityUid": "0xd440aad8b6751a2e1e0d2045a0443e615fec882f92313b793b682f2b546cb109"
}
```

## Repository Registration

Issue attestations respect the same repository registration patterns as commit attestations. Before attesting, ensure the repo is registered via UsernameUniqueResolver.

See [Contribution Attestations - Repository Registration](./CONTRIBUTION.md#repository-registration) for details.

## Security Considerations

1. **Timing Window**: Only attest recent issues (e.g., within 30 days of creation) to prevent retroactive gaming
2. **Duplicate Prevention**: Check if attestation already exists for (repo, issueNumber) before creating
3. **Author Verification**: Always verify issue author via GitHub API matches claimed username
4. **Pull Request Filtering**: GitHub API returns PRs in issues endpoint — must filter them out

## Related

- [Identity Attestations](./IDENTITY.md) - Primary identity binding
- [Contribution Attestations](./CONTRIBUTION.md) - Commit tracking
- [EAS Documentation](https://docs.attest.sh/) - Ethereum Attestation Service
- [Base Sepolia Explorer](https://base-sepolia.easscan.org/) - View attestations

---

*Implemented by Loki (@loki-cyberstorm) as part of Issue #19*
