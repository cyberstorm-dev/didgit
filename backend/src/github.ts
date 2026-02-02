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
