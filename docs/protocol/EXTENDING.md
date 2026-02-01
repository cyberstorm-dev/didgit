# Extending to Other Platforms

How to add support for GitLab, Bitbucket, Codeberg, and other platforms.

## Overview

didgit.dev is designed for multi-platform support. The core protocol is platform-agnostic:
- `domain` field identifies the platform
- Schemas are reusable across platforms
- Only the verifier logic is platform-specific

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Adapters                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  GitHub  │  │  GitLab  │  │ Codeberg │  │Bitbucket │    │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            ▼                                │
│                   ┌──────────────┐                          │
│                   │   Verifier   │                          │
│                   │    Core      │                          │
│                   └──────────────┘                          │
│                            │                                │
│                            ▼                                │
│                   ┌──────────────┐                          │
│                   │   Resolver   │                          │
│                   │   Contract   │                          │
│                   └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Guide

### Step 1: Define Domain

Choose a canonical domain identifier:
- GitHub: `github.com`
- GitLab: `gitlab.com` (or `gitlab.example.com` for self-hosted)
- Codeberg: `codeberg.org`
- Bitbucket: `bitbucket.org`

### Step 2: Implement Proof Mechanism

Each platform needs a way to create public proof:

| Platform | Proof Mechanism | API |
|----------|-----------------|-----|
| GitHub | Public Gist | `POST /gists` |
| GitLab | Public Snippet | `POST /snippets` |
| Codeberg | Public Gist (Gitea) | `POST /api/v1/user/gists` |
| Bitbucket | Public Snippet | `POST /snippets/{workspace}` |

The proof must:
1. Be publicly accessible
2. Be created by the claimed user (OAuth verification)
3. Contain the signed binding data

### Step 3: Implement Verifier Adapter

```typescript
interface PlatformAdapter {
  domain: string;
  
  // Verify user owns the proof
  verifyProofOwnership(
    username: string,
    proofUrl: string,
    oauthToken: string
  ): Promise<boolean>;
  
  // Fetch proof content
  fetchProofContent(proofUrl: string): Promise<ProofData>;
  
  // Get user's activity/events
  getActivity(
    username: string,
    oauthToken: string
  ): Promise<Activity[]>;
  
  // Verify a commit exists
  verifyCommit(
    repo: string,
    commitHash: string
  ): Promise<boolean>;
}
```

### Step 4: GitLab Example

```typescript
class GitLabAdapter implements PlatformAdapter {
  domain = 'gitlab.com';
  
  async verifyProofOwnership(
    username: string,
    proofUrl: string,
    token: string
  ): Promise<boolean> {
    // Extract snippet ID from URL
    const snippetId = this.parseSnippetId(proofUrl);
    
    // Fetch snippet metadata
    const res = await fetch(
      `https://gitlab.com/api/v4/snippets/${snippetId}`,
      { headers: { 'PRIVATE-TOKEN': token } }
    );
    const snippet = await res.json();
    
    // Verify owner matches
    return snippet.author.username.toLowerCase() === username.toLowerCase();
  }
  
  async fetchProofContent(proofUrl: string): Promise<ProofData> {
    const snippetId = this.parseSnippetId(proofUrl);
    const res = await fetch(
      `https://gitlab.com/api/v4/snippets/${snippetId}/raw`
    );
    return JSON.parse(await res.text());
  }
  
  async getActivity(username: string, token: string): Promise<Activity[]> {
    const res = await fetch(
      `https://gitlab.com/api/v4/users/${username}/events?action=pushed`,
      { headers: { 'PRIVATE-TOKEN': token } }
    );
    const events = await res.json();
    
    return events.flatMap(e => 
      e.push_data?.commits?.map(c => ({
        repo: e.project_id, // Resolve to full path
        commitHash: c.id,
        message: c.title,
        timestamp: new Date(e.created_at).getTime() / 1000
      })) ?? []
    );
  }
  
  async verifyCommit(repo: string, commitHash: string): Promise<boolean> {
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(repo)}/repository/commits/${commitHash}`
    );
    return res.ok;
  }
}
```

### Step 5: Codeberg Example

Codeberg runs Gitea, so use Gitea API:

```typescript
class CodebergAdapter implements PlatformAdapter {
  domain = 'codeberg.org';
  baseUrl = 'https://codeberg.org/api/v1';
  
  async verifyProofOwnership(
    username: string,
    proofUrl: string,
    token: string
  ): Promise<boolean> {
    const gistId = this.parseGistId(proofUrl);
    const res = await fetch(
      `${this.baseUrl}/gists/${gistId}`,
      { headers: { 'Authorization': `token ${token}` } }
    );
    const gist = await res.json();
    return gist.owner.login.toLowerCase() === username.toLowerCase();
  }
  
  // ... similar to GitLab
}
```

### Step 6: Register Adapter

```typescript
const adapters: Map<string, PlatformAdapter> = new Map([
  ['github.com', new GitHubAdapter()],
  ['gitlab.com', new GitLabAdapter()],
  ['codeberg.org', new CodebergAdapter()],
]);

function getAdapter(domain: string): PlatformAdapter {
  const adapter = adapters.get(domain);
  if (!adapter) throw new Error(`Unsupported platform: ${domain}`);
  return adapter;
}
```

## Testing Your Adapter

1. **Unit tests** — Mock API responses
2. **Integration tests** — Real API calls with test account
3. **End-to-end** — Full flow on testnet

```typescript
describe('GitLabAdapter', () => {
  it('verifies snippet ownership', async () => {
    const adapter = new GitLabAdapter();
    const result = await adapter.verifyProofOwnership(
      'test-user',
      'https://gitlab.com/snippets/123',
      'test-token'
    );
    expect(result).toBe(true);
  });
});
```

## Contributing

1. Fork the repo
2. Implement adapter in `src/adapters/`
3. Add tests
4. Submit PR

See open issues:
- [GitLab Support](https://github.com/cyberstorm-dev/didgit/issues/3)
- [Codeberg Support](https://github.com/cyberstorm-dev/didgit/issues/4)

## Self-Hosted Instances

For GitLab/Gitea self-hosted:

```typescript
class SelfHostedGitLabAdapter extends GitLabAdapter {
  constructor(instanceUrl: string) {
    super();
    this.domain = new URL(instanceUrl).hostname;
    this.baseUrl = `${instanceUrl}/api/v4`;
  }
}

// Usage
const adapter = new SelfHostedGitLabAdapter('https://gitlab.mycompany.com');
```

Register with full domain: `gitlab.mycompany.com`

---

*Extending didgit.dev? We'd love to see your adapter. Open a PR!*
