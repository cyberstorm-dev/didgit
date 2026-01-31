import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { createCodeChallenge, exchangeCodeForToken, fetchGitHubUser, ghConfig, GitHubToken, GitHubUser } from './github';

type State = {
  token: GitHubToken | null;
  user: GitHubUser | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<State | undefined>(undefined);

export const GithubAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cfg = ghConfig();
  const [token, setToken] = useState<GitHubToken | null>(null);
  const [ghUser, setGhUser] = useState<GitHubUser | null>(null);
  const [connecting, setConnecting] = useState(false);

  // handle OAuth callback
  useEffect(() => {
    const origin = window.location.origin;
    // Listen for popup messages carrying code/state
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const data = ev.data as any;
      if (!data || data.type !== 'GH_OAUTH') return;
      const code = data.code as string | undefined;
      const state = data.state as string | undefined;
      const stored = sessionStorage.getItem('gh_oauth_state');
      const codeVerifier = sessionStorage.getItem('gh_pkce_verifier');
      if (!code || !state || !stored || state !== stored || !codeVerifier || !cfg.clientId) return;
      (async () => {
        try {
          setConnecting(true);
          const tok = await exchangeCodeForToken({ clientId: cfg.clientId, code, redirectUri: cfg.redirectUri ?? origin, codeVerifier });
          setToken(tok);
          const u = await fetchGitHubUser(tok);
          setGhUser(u);
        } finally {
          sessionStorage.removeItem('gh_oauth_state');
          sessionStorage.removeItem('gh_pkce_verifier');
          setConnecting(false);
        }
      })();
    };
    window.addEventListener('message', onMessage);

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const stored = sessionStorage.getItem('gh_oauth_state');
    const codeVerifier = sessionStorage.getItem('gh_pkce_verifier');
    const inPopup = !!window.opener;
    if (inPopup && code && state) {
      // Forward code/state to opener for token exchange, then self-close
      try {
        window.opener?.postMessage({ type: 'GH_OAUTH', code, state }, origin);
      } finally {
        window.close();
      }
      return () => window.removeEventListener('message', onMessage);
    }
    if (code && state && stored && state === stored && codeVerifier && cfg.clientId) {
      (async () => {
        try {
          setConnecting(true);
          const tok = await exchangeCodeForToken({ clientId: cfg.clientId, code, redirectUri: cfg.redirectUri ?? origin, codeVerifier });
          setToken(tok);
          const u = await fetchGitHubUser(tok);
          setGhUser(u);
        } catch {
          // ignore
        } finally {
          // cleanup url
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          sessionStorage.removeItem('gh_oauth_state');
          sessionStorage.removeItem('gh_pkce_verifier');
          setConnecting(false);
        }
      })();
    }
    return () => window.removeEventListener('message', onMessage);
  }, [cfg.clientId, cfg.redirectUri]);

  const connect = useCallback(async () => {
    if (!cfg.clientId) throw new Error('VITE_GITHUB_CLIENT_ID is not set');
    const state = Math.random().toString(36).slice(2);
    const verifier = crypto.getRandomValues(new Uint8Array(32)).reduce((acc, x) => acc + ('0' + (x & 0xff).toString(16)).slice(-2), '');
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem('gh_oauth_state', state);
    sessionStorage.setItem('gh_pkce_verifier', verifier);
    const redirectUri = cfg.redirectUri ?? `${window.location.origin}`;
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      login: '',
      scope: 'read:user gist',
      state,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      allow_signup: 'true',
    });
    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    const w = 500, h = 650;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2.5;
    window.open(url, 'github_oauth', `width=${w},height=${h},left=${left},top=${top}`);
  }, [cfg.clientId, cfg.redirectUri]);

  const disconnect = useCallback(() => {
    setGhUser(null);
    setToken(null);
  }, []);

  const value = useMemo<State>(() => ({ token, user: ghUser, connecting, connect, disconnect }), [token, ghUser, connecting, connect, disconnect]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useGithubAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGithubAuth must be used within GithubAuthProvider');
  return ctx;
}
