/**
 * Gitea/Codeberg API adapter
 * 
 * Supports both codeberg.org and self-hosted Gitea instances.
 * Default host is codeberg.org when no custom host is specified.
 */

import { CommitInfo } from './types';

export { CommitInfo };

const GITEA_TOKEN = process.env.GITEA_TOKEN;
const DEFAULT_HOST = 'codeberg.org';
const MAX_PAGES = 100;

/**
 * Gitea API commit response
 */
interface GiteaCommit {
  sha: string;
  commit?: {
    author?: {
      email?: string;
      name?: string;
      date?: string;
    };
    message?: string;
  };
  author?: {
    login?: string;
  };
  created?: string;
}

/**
 * Gitea API single commit response (from /git/commits/:sha endpoint)
 * Different structure than list endpoint
 */
interface GiteaSingleCommit {
  sha: string;
  author?: {
    email?: string;
    name?: string;
    date?: string;
    login?: string;
  };
  message?: string;
  created?: string;
}

export interface GiteaRepo {
  id: number;
  owner: { login: string };
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
}

export interface GiteaGist {
  id: string;
  url: string;
  html_url: string;
  description: string;
  public: boolean;
  owner: {
    id: number;
    login: string;
    avatar_url: string;
  };
  files: Record<string, {
    filename: string;
    size: number;
    raw_url: string;
    content?: string;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * Build base URL for Gitea API
 */
function getBaseUrl(customHost?: string): string {
  const host = customHost || DEFAULT_HOST;
  // Ensure host doesn't have protocol prefix
  const cleanHost = host.replace(/^https?:\/\//, '');
  return `https://${cleanHost}/api/v1`;
}

/**
 * Build headers for Gitea API requests
 */
function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  
  const authToken = token || GITEA_TOKEN;
  if (authToken) {
    headers['Authorization'] = `token ${authToken}`;
  }
  
  return headers;
}

/**
 * Get recent commits from a repository
 */
export async function getRecentCommits(
  owner: string,
  repo: string,
  since?: Date,
  customHost?: string
): Promise<CommitInfo[]> {
  const baseUrl = getBaseUrl(customHost);
  const url = new URL(`${baseUrl}/repos/${owner}/${repo}/commits`);
  url.searchParams.set('limit', '100');
  
  // Gitea API uses 'sha' param for branch, not 'since' for date filtering
  // We'll need to filter client-side for date
  
  try {
    const resp = await fetch(url.toString(), { headers: getHeaders() });
    if (!resp.ok) {
      if (resp.status === 404 || resp.status === 403) {
        const error = new Error(`Failed to fetch commits: ${resp.status}`) as Error & { status: number };
        error.status = resp.status;
        throw error;
      }
      console.error(`[gitea] Failed to fetch commits: ${resp.status}`);
      return [];
    }
    
    const commits = await resp.json() as GiteaCommit[];
    
    return commits
      .filter(commit => {
        if (!since) return true;
        const commitDate = new Date(commit.commit?.author?.date || commit.created);
        return commitDate >= since;
      })
      .map(commit => ({
        sha: commit.sha,
        author: {
          email: commit.commit?.author?.email || '',
          name: commit.commit?.author?.name || '',
          username: commit.author?.login,
        },
        message: commit.commit?.message || '',
        timestamp: commit.commit?.author?.date || commit.created,
        repo: {
          owner,
          name: repo,
        },
      }));
  } catch (e) {
    console.error(`[gitea] Error fetching commits for ${owner}/${repo}:`, e);
    return [];
  }
}

/**
 * Get a specific commit
 */
export async function getCommit(
  owner: string,
  repo: string,
  sha: string,
  customHost?: string
): Promise<CommitInfo | null> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const resp = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/git/commits/${sha}`,
      { headers: getHeaders() }
    );
    
    if (!resp.ok) {
      console.error(`[gitea] Failed to fetch commit ${sha}: ${resp.status}`);
      return null;
    }
    
    const commit = await resp.json() as GiteaSingleCommit;
    
    return {
      sha: commit.sha,
      author: {
        email: commit.author?.email || '',
        name: commit.author?.name || '',
        username: commit.author?.login,
      },
      message: commit.message || '',
      timestamp: commit.author?.date || commit.created,
      repo: {
        owner,
        name: repo,
      },
    };
  } catch (e) {
    console.error(`[gitea] Error fetching commit ${sha}:`, e);
    return null;
  }
}

/**
 * List repositories for a user
 */
export async function listUserRepos(
  username: string,
  customHost?: string
): Promise<{ owner: string; name: string }[]> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const repos: { owner: string; name: string }[] = [];
    let page = 1;
    
    while (page <= MAX_PAGES) {
      const resp = await fetch(
        `${baseUrl}/users/${username}/repos?page=${page}&limit=50`,
        { headers: getHeaders() }
      );
      
      if (!resp.ok) {
        if (resp.status === 404) {
          console.log(`[gitea] User ${username} not found on ${customHost || DEFAULT_HOST}`);
          return [];
        }
        throw new Error(`Failed to fetch repos: ${resp.status}`);
      }
      
      const data = await resp.json() as GiteaRepo[];
      
      if (data.length === 0) break;
      
      repos.push(...data
        .filter(r => !r.private)
        .map(r => ({ owner: r.owner.login, name: r.name }))
      );
      
      page++;
      if (data.length < 50) break;
    }
    
    return repos;
  } catch (e) {
    console.error(`[gitea] Error listing repos for ${username}:`, e);
    return [];
  }
}

/**
 * List repositories for an organization
 */
export async function listOrgRepos(
  org: string,
  customHost?: string
): Promise<{ owner: string; name: string }[]> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const repos: { owner: string; name: string }[] = [];
    let page = 1;
    
    while (page <= MAX_PAGES) {
      const resp = await fetch(
        `${baseUrl}/orgs/${org}/repos?page=${page}&limit=50`,
        { headers: getHeaders() }
      );
      
      if (!resp.ok) {
        if (resp.status === 404) {
          console.log(`[gitea] Org ${org} not found on ${customHost || DEFAULT_HOST}`);
          return [];
        }
        throw new Error(`Failed to fetch org repos: ${resp.status}`);
      }
      
      const data = await resp.json() as GiteaRepo[];
      
      if (data.length === 0) break;
      
      repos.push(...data
        .filter(r => !r.private)
        .map(r => ({ owner: org, name: r.name }))
      );
      
      page++;
      if (data.length < 50) break;
    }
    
    return repos;
  } catch (e) {
    console.error(`[gitea] Error listing repos for org ${org}:`, e);
    return [];
  }
}

/**
 * Verify that a gist is owned by the expected user
 */
export async function verifyGistOwnership(
  gistId: string,
  expectedUsername: string,
  customHost?: string,
  token?: string
): Promise<boolean> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const resp = await fetch(
      `${baseUrl}/gists/${gistId}`,
      { headers: getHeaders(token) }
    );
    
    if (!resp.ok) {
      console.error(`[gitea] Failed to fetch gist ${gistId}: ${resp.status}`);
      return false;
    }
    
    const gist = await resp.json() as GiteaGist;
    
    return gist.owner.login.toLowerCase() === expectedUsername.toLowerCase();
  } catch (e) {
    console.error(`[gitea] Error verifying gist ownership:`, e);
    return false;
  }
}

/**
 * Fetch content of a gist
 */
export async function fetchGistContent(
  gistId: string,
  customHost?: string
): Promise<string | null> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const resp = await fetch(
      `${baseUrl}/gists/${gistId}`,
      { headers: getHeaders() }
    );
    
    if (!resp.ok) {
      console.error(`[gitea] Failed to fetch gist ${gistId}: ${resp.status}`);
      return null;
    }
    
    const gist = await resp.json() as GiteaGist;
    
    // Get content from first file
    const files = Object.values(gist.files);
    if (files.length === 0) {
      return null;
    }
    
    const firstFile = files[0];
    
    // If content is included, return it
    if (firstFile.content) {
      return firstFile.content;
    }
    
    // Otherwise fetch raw content
    const rawResp = await fetch(firstFile.raw_url);
    if (!rawResp.ok) {
      console.error(`[gitea] Failed to fetch raw gist content: ${rawResp.status}`);
      return null;
    }
    
    return await rawResp.text();
  } catch (e) {
    console.error(`[gitea] Error fetching gist content:`, e);
    return null;
  }
}

/**
 * Get user events/activity (for contribution tracking)
 */
export async function getUserEvents(
  username: string,
  customHost?: string,
  token?: string
): Promise<Array<{
  type: string;
  repo: { owner: string; name: string };
  commits?: Array<{ sha: string; message: string }>;
  created_at: string;
}>> {
  const baseUrl = getBaseUrl(customHost);
  
  try {
    const resp = await fetch(
      `${baseUrl}/users/${username}/events?limit=100`,
      { headers: getHeaders(token) }
    );
    
    if (!resp.ok) {
      console.error(`[gitea] Failed to fetch events for ${username}: ${resp.status}`);
      return [];
    }
    
    const events = await resp.json() as any[];
    
    return events
      .filter(e => e.type === 'PushEvent' || e.type === 'CreateEvent')
      .map(e => ({
        type: e.type,
        repo: {
          owner: e.repo?.owner || e.repo?.full_name?.split('/')[0] || '',
          name: e.repo?.name || e.repo?.full_name?.split('/')[1] || '',
        },
        commits: e.payload?.commits?.map((c: any) => ({
          sha: c.sha,
          message: c.message,
        })),
        created_at: e.created_at,
      }));
  } catch (e) {
    console.error(`[gitea] Error fetching events for ${username}:`, e);
    return [];
  }
}

/**
 * Match commit author to Gitea username
 */
export function matchCommitToGiteaUser(commit: CommitInfo): string | null {
  if (commit.author.username) {
    return commit.author.username;
  }
  return null;
}

/**
 * Verify a commit exists in a repository
 */
export async function verifyCommit(
  owner: string,
  repo: string,
  commitHash: string,
  customHost?: string
): Promise<boolean> {
  const commit = await getCommit(owner, repo, commitHash, customHost);
  return commit !== null;
}

/**
 * Get the domain for a host (used for attestation domain field)
 */
export function getDomain(customHost?: string): string {
  const host = customHost || DEFAULT_HOST;
  // Clean host and return as domain
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
