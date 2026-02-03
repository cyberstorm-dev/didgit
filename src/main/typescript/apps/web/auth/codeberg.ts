import { z } from 'zod';

const DEFAULT_HOST = 'codeberg.org';

export const cbEnvSchema = z.object({
  VITE_CODEBERG_CLIENT_ID: z.string().min(1),
  VITE_CODEBERG_CLIENT_SECRET: z.string().min(1).optional(),
  VITE_CODEBERG_REDIRECT_URI: z.string().url().optional(),
  VITE_CODEBERG_TOKEN_PROXY: z.string().url().optional(),
});

export function cbConfig() {
  const env = cbEnvSchema.safeParse(import.meta.env);
  if (!env.success) {
    return { clientId: undefined, redirectUri: undefined } as const;
  }
  return {
    clientId: env.data.VITE_CODEBERG_CLIENT_ID,
    clientSecret: env.data.VITE_CODEBERG_CLIENT_SECRET,
    redirectUri: env.data.VITE_CODEBERG_REDIRECT_URI ?? `${window.location.origin}`,
    tokenProxy: env.data.VITE_CODEBERG_TOKEN_PROXY,
  } as const;
}

/**
 * Get the base URL for a Gitea instance
 */
export function getGiteaBaseUrl(customHost?: string): string {
  const host = customHost || DEFAULT_HOST;
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${cleanHost}`;
}

/**
 * Get the API base URL for a Gitea instance
 */
export function getGiteaApiUrl(customHost?: string): string {
  return `${getGiteaBaseUrl(customHost)}/api/v1`;
}

/**
 * Get the domain identifier for attestations
 */
export function getGiteaDomain(customHost?: string): string {
  const host = customHost || DEFAULT_HOST;
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
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
});

const TokenError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

export type CodebergToken = z.infer<typeof TokenResp>;

/**
 * Exchange OAuth code for access token
 * 
 * Note: Gitea OAuth2 uses standard OAuth2 token endpoint.
 * For Codeberg/Gitea, PKCE is supported but not always required.
 */
export async function exchangeCodeForToken(params: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  customHost?: string;
}): Promise<CodebergToken> {
  const { tokenProxy } = cbConfig();
  const baseUrl = getGiteaBaseUrl(params.customHost);
  
  // Use proxy if available, otherwise direct request
  const url = tokenProxy ?? `${baseUrl}/login/oauth/access_token`;
  
  const body: Record<string, string> = {
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  };
  
  // Add PKCE verifier if provided
  if (params.codeVerifier) {
    body.code_verifier = params.codeVerifier;
  }
  
  // Add client secret if using proxy
  const cfg = cbConfig();
  if (cfg.clientSecret && tokenProxy) {
    body.client_secret = cfg.clientSecret;
  }
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!resp.ok) {
    try {
      const j = await resp.json();
      const err = TokenError.safeParse(j);
      if (err.success) {
        const msg = `${err.data.error}${err.data.error_description ? `: ${err.data.error_description}` : ''}`;
        throw new Error(`Codeberg token exchange failed: ${resp.status} ${msg}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('token exchange')) throw e;
    }
    throw new Error(`Codeberg token exchange failed: ${resp.status}`);
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

const UserResp = z.object({
  id: z.number(),
  login: z.string(),
  full_name: z.string().optional(),
  email: z.string().optional(),
  avatar_url: z.string().url().optional(),
  html_url: z.string().url().optional(),
});

export type CodebergUser = z.infer<typeof UserResp>;

/**
 * Fetch the authenticated user's profile
 */
export async function fetchCodebergUser(
  token: CodebergToken,
  customHost?: string
): Promise<CodebergUser> {
  const apiUrl = getGiteaApiUrl(customHost);
  
  const resp = await fetch(`${apiUrl}/user`, {
    headers: {
      'Authorization': `token ${token.access_token}`,
      'Accept': 'application/json',
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Failed to load Codeberg user: ${resp.status}`);
  }
  
  const json = await resp.json();
  const parsed = UserResp.safeParse(json);
  
  if (!parsed.success) {
    throw new Error('Unexpected user payload from Codeberg');
  }
  
  return parsed.data;
}

export interface GistFile {
  filename: string;
  content: string;
}

export interface CreateGistParams {
  description?: string;
  files: GistFile[];
  public?: boolean;
}

const GistResp = z.object({
  id: z.string(),
  html_url: z.string().url(),
  url: z.string().url(),
  description: z.string().optional(),
  public: z.boolean(),
  owner: z.object({
    login: z.string(),
  }),
});

export type CodebergGist = z.infer<typeof GistResp>;

/**
 * Create a public gist (snippet)
 * 
 * Note: Gitea uses the same /gists endpoint as GitHub
 */
export async function createPublicGist(
  token: CodebergToken,
  params: CreateGistParams,
  customHost?: string
): Promise<{ html_url: string; id: string }> {
  const apiUrl = getGiteaApiUrl(customHost);
  
  // Convert files array to Gitea gist format
  const files: Record<string, { content: string }> = {};
  for (const file of params.files) {
    files[file.filename] = { content: file.content };
  }
  
  const resp = await fetch(`${apiUrl}/gists`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      description: params.description ?? 'Codeberg identity attestation proof',
      public: params.public ?? true,
      files,
    }),
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create gist: ${resp.status} ${text}`);
  }
  
  const json = await resp.json();
  const parsed = GistResp.safeParse(json);
  
  if (!parsed.success) {
    // Try to extract essential fields
    if (json.html_url && json.id) {
      return { html_url: json.html_url, id: json.id };
    }
    throw new Error('Unexpected gist response from Codeberg');
  }
  
  return { html_url: parsed.data.html_url, id: parsed.data.id };
}

/**
 * Fetch a gist by ID
 */
export async function fetchGist(
  gistId: string,
  token?: CodebergToken,
  customHost?: string
): Promise<CodebergGist | null> {
  const apiUrl = getGiteaApiUrl(customHost);
  
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `token ${token.access_token}`;
  }
  
  const resp = await fetch(`${apiUrl}/gists/${gistId}`, { headers });
  
  if (!resp.ok) {
    return null;
  }
  
  const json = await resp.json();
  const parsed = GistResp.safeParse(json);
  
  return parsed.success ? parsed.data : null;
}

/**
 * Verify that a gist is owned by a specific user
 */
export async function verifyGistOwnership(
  gistId: string,
  expectedUsername: string,
  token?: CodebergToken,
  customHost?: string
): Promise<boolean> {
  const gist = await fetchGist(gistId, token, customHost);
  
  if (!gist) {
    return false;
  }
  
  return gist.owner.login.toLowerCase() === expectedUsername.toLowerCase();
}

/**
 * Build the OAuth authorization URL for Codeberg/Gitea
 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  customHost?: string;
  scopes?: string[];
}): string {
  const baseUrl = getGiteaBaseUrl(params.customHost);
  const url = new URL(`${baseUrl}/login/oauth/authorize`);
  
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', params.state);
  
  // Default scopes: read user info and write gists
  const scopes = params.scopes ?? ['read:user', 'write:misc'];
  url.searchParams.set('scope', scopes.join(' '));
  
  // Add PKCE challenge if provided
  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  
  return url.toString();
}
