/**
 * Shared types for git platform adapters (GitHub, Gitea, etc.)
 */

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
