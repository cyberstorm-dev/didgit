import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Web3AuthNoModal } from '@web3auth/no-modal';
import { WALLET_ADAPTERS, CHAIN_NAMESPACES } from '@web3auth/base';
import { AuthAdapter } from '@web3auth/auth-adapter';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';

type State = {
  web3auth: Web3Auth | null;
  provider: any;
  eoaAddress: string | null;
  ready: boolean;
  connect: (opts?: { loginProvider?: 'google' | 'github' | 'email_passwordless' }) => Promise<void>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<State | undefined>(undefined);

export const Web3AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const initRef = useRef<Promise<void> | null>(null);

  const adapterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const clientId = (import.meta as any).env.VITE_WEB3AUTH_CLIENT_ID as string | undefined;
      const web3AuthNetwork = (import.meta as any).env.VITE_WEB3AUTH_NETWORK ?? 'testnet';
      if (!clientId) { setReady(true); return; }
      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.EIP155,
        chainId: '0x14A34', // Base Sepolia 84532
        rpcTarget: 'https://sepolia.base.org',
        displayName: 'Base Sepolia',
        ticker: 'ETH',
        tickerName: 'Ether',
      };
      const pkProvider = new EthereumPrivateKeyProvider({ config: { chainConfig } });
      const w3a = new Web3AuthNoModal({
        clientId,
        web3AuthNetwork,
        chainConfig,
        privateKeyProvider: pkProvider,
        // Avoid dynamic imports for injected connectors in dev
        multiInjectedProviderDiscovery: false,
      } as any);
      // Configure Auth adapter with EVM private key provider
      const authAdapter = new AuthAdapter({ privateKeyProvider: pkProvider });
      (w3a as any).configureAdapter(authAdapter);
      adapterKeyRef.current = WALLET_ADAPTERS.AUTH;
      // Start initialization; store promise so connect can await
      initRef.current = w3a.init();
      await initRef.current;
      setWeb3auth(w3a);
      setProvider(w3a.provider);
      try {
        if (w3a.connected) {
          const addr = await getAddressFromProvider(w3a.provider);
          setEoaAddress(addr);
        }
      } catch {}
      setReady(true);
    };
    void init();
  }, []);

  const connect = useCallback(async (opts?: { loginProvider?: 'google' | 'github' | 'email_passwordless' }) => {
    if (!web3auth) throw new Error('Web3Auth not ready');
    const loginProvider = opts?.loginProvider ?? 'github';
    // ensure init attempt has completed
    try { await initRef.current; } catch {}
    const adapterKey = adapterKeyRef.current;
    if (!adapterKey) throw new Error('Web3Auth auth adapter missing');
    const prov = await (web3auth as any).connectTo(adapterKey, { loginProvider });
    setProvider(prov);
    const addr = await getAddressFromProvider(prov);
    setEoaAddress(addr);
  }, [web3auth]);

  const disconnect = useCallback(async () => {
    if (!web3auth) return;
    await web3auth.logout();
    setProvider(null);
    setEoaAddress(null);
  }, [web3auth]);

  const value = useMemo<State>(() => ({ web3auth, provider, eoaAddress, ready, connect, disconnect }), [web3auth, provider, eoaAddress, ready, connect, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useWeb3Auth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWeb3Auth must be used within Web3AuthProvider');
  return ctx;
}

async function getAddressFromProvider(prov: any): Promise<string | null> {
  if (!prov) return null;
  try {
    const accounts: string[] = await prov.request({ method: 'eth_accounts' });
    if (accounts?.length) return accounts[0];
    const req: string[] = await prov.request({ method: 'eth_requestAccounts' });
    return req?.[0] ?? null;
  } catch {
    return null;
  }
}
