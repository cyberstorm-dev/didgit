import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  cbConfig,
  CodebergToken,
  CodebergUser,
  createCodeChallenge,
  exchangeCodeForToken,
  fetchCodebergUser,
  buildAuthUrl,
  getGiteaDomain,
} from './codeberg';

type State = {
  token: CodebergToken | null;
  user: CodebergUser | null;
  connecting: boolean;
  customHost: string | null;
  domain: string;
  connect: (customHost?: string) => Promise<void>;
  disconnect: () => void;
  setCustomHost: (host: string | null) => void;
};

const Ctx = createContext<State | undefined>(undefined);

const STORAGE_KEY_STATE = 'cb_oauth_state';
const STORAGE_KEY_VERIFIER = 'cb_pkce_verifier';
const STORAGE_KEY_HOST = 'cb_custom_host';

export const CodebergAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cfg = cbConfig();
  const [token, setToken] = useState<CodebergToken | null>(null);
  const [cbUser, setCbUser] = useState<CodebergUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [customHost, setCustomHostState] = useState<string | null>(() => {
    // Initialize from sessionStorage
    return sessionStorage.getItem(STORAGE_KEY_HOST);
  });

  // Compute domain from customHost
  const domain = useMemo(() => getGiteaDomain(customHost || undefined), [customHost]);

  const setCustomHost = useCallback((host: string | null) => {
    setCustomHostState(host);
    if (host) {
      sessionStorage.setItem(STORAGE_KEY_HOST, host);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_HOST);
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const origin = window.location.origin;
    
    // Listen for popup messages carrying code/state
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const data = ev.data as any;
      if (!data || data.type !== 'CB_OAUTH') return;
      
      const code = data.code as string | undefined;
      const state = data.state as string | undefined;
      const stored = sessionStorage.getItem(STORAGE_KEY_STATE);
      const codeVerifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
      const hostFromStorage = sessionStorage.getItem(STORAGE_KEY_HOST);
      
      if (!code || !state || !stored || state !== stored || !cfg.clientId) return;
      
      (async () => {
        try {
          setConnecting(true);
          const tok = await exchangeCodeForToken({
            clientId: cfg.clientId!,
            code,
            redirectUri: cfg.redirectUri ?? origin,
            codeVerifier: codeVerifier || undefined,
            customHost: hostFromStorage || undefined,
          });
          setToken(tok);
          const u = await fetchCodebergUser(tok, hostFromStorage || undefined);
          setCbUser(u);
        } catch (e) {
          console.error('[codeberg] OAuth callback error:', e);
        } finally {
          sessionStorage.removeItem(STORAGE_KEY_STATE);
          sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
          setConnecting(false);
        }
      })();
    };
    
    window.addEventListener('message', onMessage);

    // Check if we're in the popup or main window with OAuth params
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const stored = sessionStorage.getItem(STORAGE_KEY_STATE);
    const codeVerifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
    const hostFromStorage = sessionStorage.getItem(STORAGE_KEY_HOST);
    const inPopup = !!window.opener;
    
    if (inPopup && code && state) {
      // Forward code/state to opener for token exchange, then self-close
      try {
        window.opener?.postMessage({ type: 'CB_OAUTH', code, state }, origin);
      } finally {
        window.close();
      }
      return () => window.removeEventListener('message', onMessage);
    }
    
    // Handle direct callback (non-popup flow)
    if (code && state && stored && state === stored && cfg.clientId) {
      (async () => {
        try {
          setConnecting(true);
          const tok = await exchangeCodeForToken({
            clientId: cfg.clientId!,
            code,
            redirectUri: cfg.redirectUri ?? origin,
            codeVerifier: codeVerifier || undefined,
            customHost: hostFromStorage || undefined,
          });
          setToken(tok);
          const u = await fetchCodebergUser(tok, hostFromStorage || undefined);
          setCbUser(u);
        } catch (e) {
          console.error('[codeberg] OAuth error:', e);
        } finally {
          // Cleanup URL
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          sessionStorage.removeItem(STORAGE_KEY_STATE);
          sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
          setConnecting(false);
        }
      })();
    }
    
    return () => window.removeEventListener('message', onMessage);
  }, [cfg.clientId, cfg.redirectUri]);

  const connect = useCallback(async (host?: string) => {
    if (!cfg.clientId) {
      throw new Error('VITE_CODEBERG_CLIENT_ID is not set');
    }
    
    // Use provided host or current customHost
    const targetHost = host ?? customHost ?? undefined;
    
    // Store host for callback
    if (targetHost) {
      sessionStorage.setItem(STORAGE_KEY_HOST, targetHost);
      setCustomHostState(targetHost);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_HOST);
    }
    
    // Generate PKCE values
    const state = Math.random().toString(36).slice(2);
    const verifier = crypto.getRandomValues(new Uint8Array(32))
      .reduce((acc, x) => acc + ('0' + (x & 0xff).toString(16)).slice(-2), '');
    const challenge = await createCodeChallenge(verifier);
    
    sessionStorage.setItem(STORAGE_KEY_STATE, state);
    sessionStorage.setItem(STORAGE_KEY_VERIFIER, verifier);
    
    const redirectUri = cfg.redirectUri ?? `${window.location.origin}`;
    
    const authUrl = buildAuthUrl({
      clientId: cfg.clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
      customHost: targetHost,
    });
    
    // Open popup
    const w = 500, h = 650;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2.5;
    window.open(authUrl, 'codeberg_oauth', `width=${w},height=${h},left=${left},top=${top}`);
  }, [cfg.clientId, cfg.redirectUri, customHost]);

  const disconnect = useCallback(() => {
    setCbUser(null);
    setToken(null);
  }, []);

  const value = useMemo<State>(() => ({
    token,
    user: cbUser,
    connecting,
    customHost,
    domain,
    connect,
    disconnect,
    setCustomHost,
  }), [token, cbUser, connecting, customHost, domain, connect, disconnect, setCustomHost]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCodebergAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useCodebergAuth must be used within CodebergAuthProvider');
  }
  return ctx;
}
