import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createCodeChallenge, exchangeCodeForToken, fetchGitLabUser, glConfig, GitLabToken, GitLabUser } from './gitlab';

const DEFAULT_GITLAB_HOST = 'gitlab.com';

type State = {
  token: GitLabToken | null;
  user: GitLabUser | null;
  connecting: boolean;
  customHost: string | null;
  connect: (customHost?: string) => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<State | undefined>(undefined);

export const GitlabAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cfg = glConfig();
  const [token, setToken] = useState<GitLabToken | null>(null);
  const [glUser, setGlUser] = useState<GitLabUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [customHost, setCustomHost] = useState<string | null>(null);

  // Handle OAuth callback
  useEffect(() => {
    const origin = window.location.origin;

    // Listen for popup messages carrying code/state
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const data = ev.data as any;
      if (!data || data.type !== 'GL_OAUTH') return;

      const code = data.code as string | undefined;
      const state = data.state as string | undefined;
      const stored = sessionStorage.getItem('gl_oauth_state');
      const codeVerifier = sessionStorage.getItem('gl_pkce_verifier');
      const storedHost = sessionStorage.getItem('gl_custom_host');

      if (!code || !state || !stored || state !== stored || !codeVerifier || !cfg.clientId) return;

      (async () => {
        try {
          setConnecting(true);
          const hostForApi = storedHost || undefined;
          setCustomHost(storedHost);
          const tok = await exchangeCodeForToken({
            clientId: cfg.clientId,
            code,
            redirectUri: cfg.redirectUri ?? origin,
            codeVerifier,
          });
          setToken(tok);
          const u = await fetchGitLabUser(tok, hostForApi);
          setGlUser(u);
        } finally {
          sessionStorage.removeItem('gl_oauth_state');
          sessionStorage.removeItem('gl_pkce_verifier');
          sessionStorage.removeItem('gl_custom_host');
          setConnecting(false);
        }
      })();
    };

    window.addEventListener('message', onMessage);

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const stored = sessionStorage.getItem('gl_oauth_state');
    const codeVerifier = sessionStorage.getItem('gl_pkce_verifier');
    const storedHost = sessionStorage.getItem('gl_custom_host');
    const inPopup = !!window.opener;

    if (inPopup && code && state) {
      // Forward code/state to opener for token exchange, then self-close
      try {
        window.opener?.postMessage({ type: 'GL_OAUTH', code, state }, origin);
      } finally {
        window.close();
      }
      return () => window.removeEventListener('message', onMessage);
    }

    if (code && state && stored && state === stored && codeVerifier && cfg.clientId) {
      (async () => {
        try {
          setConnecting(true);
          const hostForApi = storedHost || undefined;
          setCustomHost(storedHost);
          const tok = await exchangeCodeForToken({
            clientId: cfg.clientId,
            code,
            redirectUri: cfg.redirectUri ?? origin,
            codeVerifier,
          });
          setToken(tok);
          const u = await fetchGitLabUser(tok, hostForApi);
          setGlUser(u);
        } catch {
          // ignore
        } finally {
          // Cleanup URL
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          sessionStorage.removeItem('gl_oauth_state');
          sessionStorage.removeItem('gl_pkce_verifier');
          sessionStorage.removeItem('gl_custom_host');
          setConnecting(false);
        }
      })();
    }

    return () => window.removeEventListener('message', onMessage);
  }, [cfg.clientId, cfg.redirectUri]);

  const connect = useCallback(async (hostOverride?: string) => {
    if (!cfg.clientId) throw new Error('VITE_GITLAB_CLIENT_ID is not set');

    const state = Math.random().toString(36).slice(2);
    const verifier = crypto.getRandomValues(new Uint8Array(32))
      .reduce((acc, x) => acc + ('0' + (x & 0xff).toString(16)).slice(-2), '');
    const challenge = await createCodeChallenge(verifier);

    sessionStorage.setItem('gl_oauth_state', state);
    sessionStorage.setItem('gl_pkce_verifier', verifier);
    
    // Store custom host for use after OAuth callback
    const host = hostOverride || DEFAULT_GITLAB_HOST;
    if (hostOverride) {
      sessionStorage.setItem('gl_custom_host', hostOverride);
    } else {
      sessionStorage.removeItem('gl_custom_host');
    }

    const redirectUri = cfg.redirectUri ?? `${window.location.origin}`;
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'read_user api', // api scope needed for snippets
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const oauthUrl = `https://${host}/oauth/authorize?${params.toString()}`;
    const w = 500, h = 650;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2.5;
    window.open(oauthUrl, 'gitlab_oauth', `width=${w},height=${h},left=${left},top=${top}`);
  }, [cfg.clientId, cfg.redirectUri]);

  const disconnect = useCallback(() => {
    setGlUser(null);
    setToken(null);
    setCustomHost(null);
  }, []);

  const value = useMemo<State>(
    () => ({ token, user: glUser, connecting, customHost, connect, disconnect }),
    [token, glUser, connecting, customHost, connect, disconnect]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useGitlabAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGitlabAuth must be used within GitlabAuthProvider');
  return ctx;
}
