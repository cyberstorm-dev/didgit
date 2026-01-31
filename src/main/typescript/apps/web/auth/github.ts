import { z } from 'zod';

export const ghEnvSchema = z.object({
  VITE_GITHUB_CLIENT_ID: z.string().min(1),
  VITE_GITHUB_REDIRECT_URI: z.string().url().optional(),
  VITE_GITHUB_TOKEN_PROXY: z.string().url().optional(),
});

export function ghConfig() {
  const env = ghEnvSchema.safeParse(import.meta.env);
  if (!env.success) {
    return { clientId: undefined, redirectUri: undefined } as const;
  }
  return {
    clientId: env.data.VITE_GITHUB_CLIENT_ID,
    redirectUri: env.data.VITE_GITHUB_REDIRECT_URI ?? `${window.location.origin}`,
    tokenProxy: env.data.VITE_GITHUB_TOKEN_PROXY,
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
});
const TokenError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

export type GitHubToken = z.infer<typeof TokenResp>;

export async function exchangeCodeForToken(params: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GitHubToken> {
  const { tokenProxy } = ghConfig() as any;
  const url = tokenProxy ?? `${window.location.origin}/api/github/token`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });
  if (!resp.ok) {
    // Try to surface useful GitHub error details if present
    try {
      const j = await resp.json();
      const err = TokenError.safeParse(j);
      if (err.success) {
        const msg = `${err.data.error}${err.data.error_description ? `: ${err.data.error_description}` : ''}`;
        throw new Error(`GitHub token exchange failed: ${resp.status} ${msg}`);
      }
    } catch {}
    throw new Error(`GitHub token exchange failed: ${resp.status}`);
  }
  const json = await resp.json();
  const maybeErr = TokenError.safeParse(json);
  if (maybeErr.success) {
    const msg = `${maybeErr.data.error}${maybeErr.data.error_description ? `: ${maybeErr.data.error_description}` : ''}`;
    throw new Error(msg);
  }
  const parsed = TokenResp.safeParse(json);
  if (!parsed.success) {
    throw new Error('Unexpected token response');
  }
  return parsed.data;
}

const UserResp = z.object({ login: z.string(), id: z.number(), avatar_url: z.string().url().optional() });
export type GitHubUser = z.infer<typeof UserResp>;

export async function fetchGitHubUser(token: GitHubToken): Promise<GitHubUser> {
  const resp = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json' },
  });
  if (!resp.ok) throw new Error('Failed to load user');
  const json = await resp.json();
  const parsed = UserResp.safeParse(json);
  if (!parsed.success) throw new Error('Unexpected user payload');
  return parsed.data;
}

export async function createPublicGist(token: GitHubToken, params: { description?: string; filename: string; content: string }): Promise<{ html_url: string }>
{
  const resp = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
    body: JSON.stringify({
      description: params.description ?? 'GitHub activity attestation proof',
      public: true,
      files: { [params.filename]: { content: params.content } },
    }),
  });
  if (!resp.ok) throw new Error('Failed to create gist');
  const json = await resp.json();
  return { html_url: json.html_url as string };
}
