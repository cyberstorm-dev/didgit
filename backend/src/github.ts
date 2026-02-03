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
    throw e;
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
