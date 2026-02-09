import { Octokit } from '@octokit/rest';

export function shouldRetryGitHubError(err: any): boolean {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status === 403) {
    const msg = `${err?.message || ''} ${err?.data?.message || ''}`.toLowerCase();
    if (msg.includes('abuse') || msg.includes('rate limit')) return true;
  }
  return false;
}

export function parseRetryAfterMs(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, date.getTime() - now.getTime());
}

export function getRetryDelayMs(
  err: any,
  attempt: number,
  baseDelayMs: number,
  abuseMinMs: number,
  now: Date = new Date()
): number {
  const retryAfter = parseRetryAfterMs(err?.response?.headers?.['retry-after'], now);
  let wait = retryAfter ?? baseDelayMs * attempt;
  const msg = `${err?.message || ''} ${err?.data?.message || ''}`.toLowerCase();
  if (msg.includes('abuse')) {
    wait = Math.max(wait, abuseMinMs);
  }
  return wait;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function requestWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = Number(process.env.GITHUB_RETRY_ATTEMPTS || '3');
  const baseDelayMs = Number(process.env.GITHUB_RETRY_DELAY_MS || '500');
  const abuseMinMs = Number(process.env.GITHUB_ABUSE_RETRY_MS || '30000');

  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!shouldRetryGitHubError(err) || attempt === maxAttempts) {
        throw err;
      }
      const wait = getRetryDelayMs(err, attempt, baseDelayMs, abuseMinMs);
      console.log(`[github] ${label} failed (${err?.status}); retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export interface CommitInfo {
  sha: string;
  author: {
    email: string;
    name: string;
    username?: string;
  };
  message: string;
  timestamp: string;
  repo: {
    owner: string;
    name: string;
  };
}

export async function getRecentCommits(
  owner: string,
  repo: string,
  since?: Date
): Promise<CommitInfo[]> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  const { data: commits } = await requestWithRetry(
    () =>
      octokit.repos.listCommits({
        owner,
        repo,
        since: since?.toISOString(),
        per_page: 100
      }),
    `listCommits ${owner}/${repo}`
  );

  return commits.map(commit => ({
    sha: commit.sha,
    author: {
      email: commit.commit.author?.email || '',
      name: commit.commit.author?.name || '',
      username: commit.author?.login
    },
    message: commit.commit.message,
    timestamp: commit.commit.author?.date || new Date().toISOString(),
    repo: {
      owner,
      name: repo
    }
  }));
}

export function parsePushEventsToCommits(events: any[]): CommitInfo[] {
  const commits: CommitInfo[] = [];
  for (const event of events || []) {
    if (event?.type !== 'PushEvent') continue;
    const repoName = event?.repo?.name || '';
    const [owner, name] = repoName.split('/');
    if (!owner || !name) continue;
    const authorUsername = event?.actor?.login;
    const timestamp = event?.created_at || new Date().toISOString();
    const payloadCommits = event?.payload?.commits || [];
    for (const c of payloadCommits) {
      if (!c?.sha) continue;
      commits.push({
        sha: c.sha,
        author: {
          email: c.author?.email || '',
          name: c.author?.name || '',
          username: authorUsername
        },
        message: c.message || '',
        timestamp,
        repo: { owner, name }
      });
    }
  }
  return commits;
}

export async function getRecentUserPushCommits(username: string, since?: Date): Promise<CommitInfo[]> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { data: events } = await requestWithRetry(
    () =>
      octokit.activity.listPublicEventsForUser({
        username,
        per_page: 100
      }),
    `listPublicEventsForUser ${username}`
  );

  const commits = parsePushEventsToCommits(events as any[]);
  if (!since) return commits;
  const sinceMs = since.getTime();
  return commits.filter((c) => new Date(c.timestamp).getTime() >= sinceMs);
}

export async function getCommit(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitInfo | null> {
  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const { data: commit } = await requestWithRetry(
      () =>
        octokit.repos.getCommit({
          owner,
          repo,
          ref: sha
        }),
      `getCommit ${owner}/${repo}@${sha.slice(0, 7)}`
    );

    return {
      sha: commit.sha,
      author: {
        email: commit.commit.author?.email || '',
        name: commit.commit.author?.name || '',
        username: commit.author?.login
      },
      message: commit.commit.message,
      timestamp: commit.commit.author?.date || new Date().toISOString(),
      repo: {
        owner,
        name: repo
      }
    };
  } catch (e) {
    console.error(`[github] Failed to fetch commit ${sha}:`, e);
    return null;
  }
}

export function matchCommitToGitHubUser(commit: CommitInfo): string | null {
  // First try username from commit author
  if (commit.author.username) {
    return commit.author.username;
  }

  // Could also match by email if we have a mapping
  // For now, just return null if no username
  return null;
}

/**
 * List all public repos in an organization
 */
export async function listOrgRepos(org: string): Promise<{ owner: string; name: string }[]> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const repos: { owner: string; name: string }[] = [];
    let page = 1;
    
    while (true) {
      const { data } = await requestWithRetry(
        () =>
          octokit.repos.listForOrg({
            org,
            type: 'public',
            per_page: 100,
            page
          }),
        `listForOrg ${org} page ${page}`
      );
      
      if (data.length === 0) break;
      
      repos.push(...data.map(r => ({ owner: org, name: r.name })));
      page++;
      
      if (data.length < 100) break;
      const maxPages = Number(process.env.GITHUB_MAX_PAGES || '5');
      if (page > maxPages) break;
    }
    
    return repos;
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`[github] Org ${org} not found or not accessible`);
      return [];
    }
    throw e;
  }
}

/**
 * List repos for a user
 */
export async function listUserRepos(username: string): Promise<{ owner: string; name: string }[]> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const repos: { owner: string; name: string }[] = [];
    let page = 1;
    
    while (true) {
      const { data } = await requestWithRetry(
        () =>
          octokit.repos.listForUser({
            username,
            type: 'owner',
            per_page: 100,
            page
          }),
        `listForUser ${username} page ${page}`
      );
      
      if (data.length === 0) break;
      
      repos.push(...data.map(r => ({ owner: username, name: r.name })));
      page++;
      
      if (data.length < 100) break;
      const maxPages = Number(process.env.GITHUB_MAX_PAGES || '5');
      if (page > maxPages) break;
    }
    
    return repos;
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`[github] User ${username} not found`);
      return [];
    }
    throw e;
  }
}
