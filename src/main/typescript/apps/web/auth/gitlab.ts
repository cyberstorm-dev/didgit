import { z } from 'zod';

export const glEnvSchema = z.object({
  VITE_GITLAB_CLIENT_ID: z.string().min(1),
  VITE_GITLAB_REDIRECT_URI: z.string().url().optional(),
  VITE_GITLAB_TOKEN_PROXY: z.string().url().optional(),
});

export function glConfig() {
  const env = glEnvSchema.safeParse(import.meta.env);
  if (!env.success) {
    return { clientId: undefined, redirectUri: undefined, tokenProxy: undefined } as const;
  }
  return {
    clientId: env.data.VITE_GITLAB_CLIENT_ID,
    redirectUri: env.data.VITE_GITLAB_REDIRECT_URI ?? `${window.location.origin}`,
    tokenProxy: env.data.VITE_GITLAB_TOKEN_PROXY,
  } as const;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const TokenResp = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  created_at: z.number().optional(),
});

const TokenError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export type GitLabToken = z.infer<typeof TokenResp>;

export async function exchangeCodeForToken(params: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GitLabToken> {
  const { tokenProxy } = glConfig() as any;
  const url = tokenProxy ?? `${window.location.origin}/api/gitlab/token`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
      grant_type: 'authorization_code',
    }),
  });

  if (!resp.ok) {
    try {
      const j = await resp.json();
      const err = TokenError.safeParse(j);
      if (err.success) {
        const msg = `${err.data.error}${err.data.error_description ? `: ${err.data.error_description}` : ''}`;
        throw new Error(`GitLab token exchange failed: ${resp.status} ${msg}`);
      }
    } catch {}
    throw new Error(`GitLab token exchange failed: ${resp.status}`);
  }

  const json = await resp.json();
  const maybeErr = TokenError.safeParse(json);
  if (maybeErr.success && maybeErr.data.error) {
    const msg = `${maybeErr.data.error}${maybeErr.data.error_description ? `: ${maybeErr.data.error_description}` : ''}`;
    throw new Error(msg);
  }

  const parsed = TokenResp.safeParse(json);
  if (!parsed.success) {
    throw new Error('Unexpected token response');
  }
  return parsed.data;
}

const UserResp = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  avatar_url: z.string().url().nullable().optional(),
  web_url: z.string().url().optional(),
});

export type GitLabUser = z.infer<typeof UserResp>;

const DEFAULT_GITLAB_HOST = 'gitlab.com';

/**
 * Build the API base URL for a GitLab instance
 * @param customHost - Custom GitLab host (e.g., "gitlab.example.com"), defaults to gitlab.com
 */
function getApiBase(customHost?: string): string {
  const host = customHost || DEFAULT_GITLAB_HOST;
  return `https://${host}/api/v4`;
}

export async function fetchGitLabUser(token: GitLabToken, customHost?: string): Promise<GitLabUser> {
  const apiBase = getApiBase(customHost);
  const resp = await fetch(`${apiBase}/user`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/json',
    },
  });
  
  if (!resp.ok) throw new Error('Failed to load GitLab user');
  
  const json = await resp.json();
  const parsed = UserResp.safeParse(json);
  if (!parsed.success) throw new Error('Unexpected user payload');
  return parsed.data;
}

export interface SnippetParams {
  title?: string;
  description?: string;
  filename: string;
  content: string;
}

export async function createPublicSnippet(
  token: GitLabToken,
  params: SnippetParams,
  customHost?: string
): Promise<{ web_url: string; id: number }> {
  const apiBase = getApiBase(customHost);
  const resp = await fetch(`${apiBase}/snippets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: params.title ?? 'didgit.dev identity proof',
      description: params.description ?? 'GitLab identity attestation proof for didgit.dev',
      visibility: 'public',
      files: [
        {
          file_path: params.filename,
          content: params.content,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create GitLab snippet: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  return { web_url: json.web_url as string, id: json.id as number };
}
