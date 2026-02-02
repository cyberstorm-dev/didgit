/**
 * GitLab API adapter for didgit.dev
 * Mirrors the structure of github.ts for consistency
 */

const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const DEFAULT_GITLAB_HOST = 'gitlab.com';

/**
 * Build the API base URL for a GitLab instance
 * @param customHost - Custom GitLab host (e.g., "gitlab.example.com"), defaults to gitlab.com
 */
function getApiBase(customHost?: string): string {
  const host = customHost || DEFAULT_GITLAB_HOST;
  return `https://${host}/api/v4`;
}

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
    projectPath?: string; // GitLab uses full path like "owner/repo" (optional for GitHub compat)
  };
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
}

interface GitLabProject {
  id: number;
  path: string;
  path_with_namespace: string;
  name: string;
  namespace: {
    path: string;
    name: string;
  };
}

async function gitlabFetch<T>(endpoint: string, options: RequestInit = {}, customHost?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
  }

  const apiBase = getApiBase(customHost);
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get recent commits from a GitLab project
 * @param projectPath - Full project path (e.g., "owner/repo" or "group/subgroup/repo")
 * @param since - Optional date to filter commits from
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function getRecentCommits(
  projectPath: string,
  since?: Date,
  customHost?: string
): Promise<CommitInfo[]> {
  const encodedPath = encodeURIComponent(projectPath);
  const params = new URLSearchParams({ per_page: '100' });
  
  if (since) {
    params.set('since', since.toISOString());
  }

  const commits = await gitlabFetch<GitLabCommit[]>(
    `/projects/${encodedPath}/repository/commits?${params.toString()}`,
    {},
    customHost
  );

  // Parse project path to get owner/name
  const pathParts = projectPath.split('/');
  const repoName = pathParts.pop() || projectPath;
  const owner = pathParts.join('/') || projectPath;

  return commits.map(commit => ({
    sha: commit.id,
    author: {
      email: commit.author_email,
      name: commit.author_name,
      username: undefined, // GitLab doesn't include username in commit data, need separate lookup
    },
    message: commit.message,
    timestamp: commit.authored_date,
    repo: {
      owner,
      name: repoName,
      projectPath,
    },
  }));
}

/**
 * Get a specific commit from a GitLab project
 * @param projectPath - Full project path (e.g., "owner/repo")
 * @param sha - Commit SHA
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function getCommit(
  projectPath: string,
  sha: string,
  customHost?: string
): Promise<CommitInfo | null> {
  try {
    const encodedPath = encodeURIComponent(projectPath);
    const commit = await gitlabFetch<GitLabCommit>(
      `/projects/${encodedPath}/repository/commits/${sha}`,
      {},
      customHost
    );

    const pathParts = projectPath.split('/');
    const repoName = pathParts.pop() || projectPath;
    const owner = pathParts.join('/') || projectPath;

    return {
      sha: commit.id,
      author: {
        email: commit.author_email,
        name: commit.author_name,
        username: undefined,
      },
      message: commit.message,
      timestamp: commit.authored_date,
      repo: {
        owner,
        name: repoName,
        projectPath,
      },
    };
  } catch (e) {
    console.error(`[gitlab] Failed to fetch commit ${sha}:`, e);
    return null;
  }
}

/**
 * Try to match a commit to a GitLab username by email lookup
 * This requires additional API call since GitLab doesn't include username in commits
 */
export async function matchCommitToGitLabUser(commit: CommitInfo): Promise<string | null> {
  if (commit.author.username) {
    return commit.author.username;
  }

  // GitLab doesn't have a public email-to-user lookup API
  // We'd need to maintain our own mapping or use project members list
  // For now, return null and rely on identity registration matching
  return null;
}

/**
 * List projects for a GitLab user
 * @param username - GitLab username
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function listUserProjects(username: string, customHost?: string): Promise<{ owner: string; name: string; projectPath: string }[]> {
  try {
    const projects: { owner: string; name: string; projectPath: string }[] = [];
    let page = 1;

    while (true) {
      const params = new URLSearchParams({
        per_page: '100',
        page: String(page),
        visibility: 'public',
      });

      const data = await gitlabFetch<GitLabProject[]>(
        `/users/${encodeURIComponent(username)}/projects?${params.toString()}`,
        {},
        customHost
      );

      if (data.length === 0) break;

      projects.push(...data.map(p => ({
        owner: p.namespace.path,
        name: p.path,
        projectPath: p.path_with_namespace,
      })));

      page++;
      if (data.length < 100) break;
    }

    return projects;
  } catch (e: any) {
    if (e.message?.includes('404')) {
      console.log(`[gitlab] User ${username} not found`);
      return [];
    }
    throw e;
  }
}

/**
 * List projects in a GitLab group
 * @param groupPath - GitLab group path
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function listGroupProjects(groupPath: string, customHost?: string): Promise<{ owner: string; name: string; projectPath: string }[]> {
  try {
    const projects: { owner: string; name: string; projectPath: string }[] = [];
    let page = 1;
    const encodedPath = encodeURIComponent(groupPath);

    while (true) {
      const params = new URLSearchParams({
        per_page: '100',
        page: String(page),
        visibility: 'public',
        include_subgroups: 'true',
      });

      const data = await gitlabFetch<GitLabProject[]>(
        `/groups/${encodedPath}/projects?${params.toString()}`,
        {},
        customHost
      );

      if (data.length === 0) break;

      projects.push(...data.map(p => ({
        owner: p.namespace.path,
        name: p.path,
        projectPath: p.path_with_namespace,
      })));

      page++;
      if (data.length < 100) break;
    }

    return projects;
  } catch (e: any) {
    if (e.message?.includes('404')) {
      console.log(`[gitlab] Group ${groupPath} not found or not accessible`);
      return [];
    }
    throw e;
  }
}

/**
 * Verify a snippet exists and is owned by the expected user
 * @param snippetId - GitLab snippet ID
 * @param expectedUsername - Expected owner username
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function verifySnippetOwnership(
  snippetId: string,
  expectedUsername: string,
  customHost?: string
): Promise<boolean> {
  try {
    const snippet = await gitlabFetch<{ author: { username: string } }>(
      `/snippets/${snippetId}`,
      {},
      customHost
    );
    return snippet.author.username.toLowerCase() === expectedUsername.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Fetch public snippet content
 * @param snippetId - GitLab snippet ID
 * @param customHost - Optional custom GitLab host (e.g., "gitlab.example.com")
 */
export async function fetchSnippetContent(snippetId: string, customHost?: string): Promise<string | null> {
  try {
    const apiBase = getApiBase(customHost);
    const response = await fetch(`${apiBase}/snippets/${snippetId}/raw`, {
      headers: GITLAB_TOKEN ? { 'PRIVATE-TOKEN': GITLAB_TOKEN } : {},
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}
