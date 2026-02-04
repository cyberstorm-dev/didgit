import { Octokit } from '@octokit/rest';

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

  const { data: commits } = await octokit.repos.listCommits({
    owner,
    repo,
    since: since?.toISOString(),
    per_page: 100
  });

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

export async function getCommit(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitInfo | null> {
  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    });

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
      const { data } = await octokit.repos.listForOrg({
        org,
        type: 'public',
        per_page: 100,
        page
      });
      
      if (data.length === 0) break;
      
      repos.push(...data.map(r => ({ owner: org, name: r.name })));
      page++;
      
      if (data.length < 100) break;
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
      const { data } = await octokit.repos.listForUser({
        username,
        type: 'public',
        per_page: 100,
        page
      });
      
      if (data.length === 0) break;
      
      repos.push(...data.map(r => ({ owner: username, name: r.name })));
      page++;
      
      if (data.length < 100) break;
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

/**
 * Issue information
 */
export interface IssueInfo {
  number: number;
  title: string;
  author: string;
  state: 'open' | 'closed';
  labels: string[];
  createdAt: string;
  closedAt: string | null;
  repo: {
    owner: string;
    name: string;
  };
}

/**
 * Get issues from a repository
 */
export async function getRepoIssues(
  owner: string,
  repo: string,
  since?: Date,
  state: 'open' | 'closed' | 'all' = 'all'
): Promise<IssueInfo[]> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state,
      since: since?.toISOString(),
      per_page: 100
    });

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    return issues
      .filter(issue => !issue.pull_request)
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        author: issue.user?.login || '',
        state: issue.state as 'open' | 'closed',
        labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || '').filter(Boolean),
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        repo: { owner, name: repo }
      }));
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`[github] Repo ${owner}/${repo} not found`);
      return [];
    }
    throw e;
  }
}

/**
 * Get a specific issue
 */
export async function getIssue(
  owner: string,
  repo: string,
  number: number
): Promise<IssueInfo | null> {
  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: number
    });

    // Check if it's a pull request
    if (issue.pull_request) {
      console.log(`[github] #${number} is a pull request, not an issue`);
      return null;
    }

    return {
      number: issue.number,
      title: issue.title,
      author: issue.user?.login || '',
      state: issue.state as 'open' | 'closed',
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || '').filter(Boolean),
      createdAt: issue.created_at,
      closedAt: issue.closed_at,
      repo: { owner, name: repo }
    };
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`[github] Issue #${number} not found in ${owner}/${repo}`);
      return null;
    }
    console.error(`[github] Failed to fetch issue #${number}:`, e);
    return null;
  }
}
