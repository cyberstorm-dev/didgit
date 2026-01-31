import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address, Hex, createWalletClient, custom, createPublicClient, http, type WalletClient } from 'viem';
import { getChainConfig } from '../utils/eas';
import { useWeb3Auth } from '../web3auth/Web3AuthProvider';
import { createZeroDevClient, type ZeroDevAA } from '../aa/zerodev';
import { appConfig } from '../utils/config';

type SignMessageArgs = { message: string };

export function useWallet() {
  const { provider, eoaAddress, connect: w3aConnect, disconnect: w3aDisconnect } = useWeb3Auth();
  const cfg = useMemo(() => appConfig(), []);
  const chain = useMemo(() => getChainConfig(cfg.CHAIN_ID), [cfg.CHAIN_ID]);
  const [signerAddress, setSignerAddress] = useState<Address | null>(null); // EOA signer (Web3Auth)
  const [smartAddress, setSmartAddress] = useState<Address | null>(null); // AA smart account
  const [isContract, setIsContract] = useState<boolean>(false);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [aa, setAa] = useState<ZeroDevAA | null>(null);
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [busyOpen, setBusyOpen] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);
  const connected = !!signerAddress;
  // Require AA smart account (EIP-7702 may have no code at address)
  const canAttest = !!aa && !!smartAddress;

  const connectSmart = useCallback(async () => {
    setLastError(null);
    // Ensure we have a signer available: prefer injected; if not, fall back to Web3Auth SSO
    try {
      const injected = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
      if (injected) {
        try { await injected.request?.({ method: 'eth_requestAccounts' }); } catch {}
      } else {
        await w3aConnect({ loginProvider: 'github' });
      }
    } catch {}
    // Initialize ZeroDev AA client
    try {
      setProvisioning(true);
      const cfg = appConfig();
      if (!cfg.ZERODEV_BUNDLER_RPC) {
        throw new Error('VITE_ZERODEV_BUNDLER_RPC is not set');
      }
      const prov = await getProvider();
      // Set signer address from active provider
      try {
        const wc = createWalletClient({ chain: chain, transport: custom(prov) });
        const [acct] = await wc.getAddresses();
        if (acct) setSignerAddress(acct as Address);
      } catch {}
      const client = await createZeroDevClient(prov, cfg.ZERODEV_PROJECT_ID ?? '');
      setAa(client);
      const addr = await client.getAddress();
      setSmartAddress(addr);
      // refresh balance and code
      const pc = createPublicClient({ chain: chain, transport: http(chain.rpcUrls.default.http[0]) });
      const [code, bal] = await Promise.all([
        pc.getCode({ address: addr }),
        pc.getBalance({ address: addr }),
      ]);
      setIsContract(!!code && code !== '0x');
      setBalanceWei(bal);
    } catch (e) {
      setLastError((e as Error).message ?? 'Failed to create smart wallet');
    } finally {
      setProvisioning(false);
    }
  }, [w3aConnect, provider]);

  const disconnect = useCallback(async () => {
    try { await w3aDisconnect(); } catch {}
    setSignerAddress(null);
    setSmartAddress(null);
    setAa(null);
    setIsContract(false);
    setBalanceWei(null);
  }, [w3aDisconnect]);

  const getProvider = useCallback(async (): Promise<any> => {
    // Prefer injected provider (MetaMask/OKX/etc.) if present
    const injected = (typeof window !== 'undefined' && (window as any).ethereum) ? (window as any).ethereum : null;
    if (injected) return injected;
    if (!provider) throw new Error('Web3Auth provider unavailable');
    return provider;
  }, [provider]);

  const getWalletClient = useCallback(async (): Promise<WalletClient> => {
    const provider = await getProvider();
    return createWalletClient({ chain: chain, transport: custom(provider) });
  }, [getProvider, chain]);

  // Refresh on-chain info for AA smart account
  const refreshOnchain = useCallback(async () => {
    const target = smartAddress;
    if (!target) {
      setIsContract(false);
      setBalanceWei(null);
      return;
    }
    const pc = createPublicClient({ chain: chain, transport: http(chain.rpcUrls.default.http[0]) });
    const [code, bal] = await Promise.all([
      pc.getCode({ address: target }),
      pc.getBalance({ address: target }),
    ]);
    const isCtr = !!code && code !== '0x';
    setIsContract(isCtr);
    setBalanceWei(bal);
  }, [smartAddress, chain]);

  const getSmartWalletClient = useCallback(async (): Promise<ZeroDevAA | null> => {
    if (aa) return aa;
    try {
      const cfg = appConfig();
      if (!cfg.ZERODEV_BUNDLER_RPC) return null;
      const prov = await getProvider();
      const client = await createZeroDevClient(prov, cfg.ZERODEV_PROJECT_ID ?? '');
      setAa(client);
      // Prime smart address if missing
      if (!smartAddress) {
        const addr = await client.getAddress();
        setSmartAddress(addr);
      }
      return client;
    } catch (e) {
      setLastError((e as Error).message ?? 'Failed to initialize AA client');
      return null;
    }
  }, [aa, getProvider, smartAddress]);

  const ensureAa = useCallback(async (): Promise<boolean> => {
    const client = await getSmartWalletClient();
    return !!client;
  }, [getSmartWalletClient]);

  const createSmartWallet = useCallback(async () => {
    await w3aConnect();
  }, [w3aConnect]);

  const openWallet = useCallback(async () => {
    setLastError(null);
    try {
      setBusyOpen(true);
      const cfg = appConfig();
      if (!cfg.ZERODEV_BUNDLER_RPC) {
        throw new Error('VITE_ZERODEV_BUNDLER_RPC is not set');
      }
      // If already have AA client, just refresh state
      let client = aa;
      if (!client) {
        const prov = await getProvider();
        // Update signer address from provider when opening wallet
        try {
          const wc = createWalletClient({ chain: chain, transport: custom(prov) });
          const [acct] = await wc.getAddresses();
          if (acct) setSignerAddress(acct as Address);
        } catch {}
        client = await createZeroDevClient(prov, cfg.ZERODEV_PROJECT_ID ?? '');
        setAa(client);
      }
      const addr = await client.getAddress();
      setSmartAddress(addr);
      // refresh on-chain state
      const pc = createPublicClient({ chain: chain, transport: http(chain.rpcUrls.default.http[0]) });
      const [code, bal] = await Promise.all([
        pc.getCode({ address: addr }),
        pc.getBalance({ address: addr }),
      ]);
      setIsContract(!!code && code !== '0x');
      setBalanceWei(bal);
    } catch (e) {
      setLastError((e as Error).message ?? 'Failed to open smart wallet');
    } finally {
      setBusyOpen(false);
    }
  }, [aa, provider]);

  // initializeAa deprecated in EP 0.6 sudo-only flow
  const testEp = useCallback(async (ep: '0.6' | '0.7') => {
    setDiag('Testing…');
    try {
      const cfg = appConfig();
      if (!cfg.ZERODEV_BUNDLER_RPC) {
        setDiag('FAIL: VITE_ZERODEV_BUNDLER_RPC is not set');
        return;
      }
      // Ensure AA client exists to access debugTryEp
      let client = aa;
      if (!client) {
        const prov = await getProvider();
        client = await createZeroDevClient(prov, cfg.ZERODEV_PROJECT_ID ?? '');
        setAa(client);
      }
      const res = await client.debugTryEp(ep);
      setDiag(`${res.ok ? 'OK' : 'FAIL'}: ${res.message}`);
    } catch (e) {
      setDiag(`FAIL: ${(e as Error).message ?? 'unknown error'}`);
    }
  }, [aa, getProvider]);

  const signMessage = useCallback(async ({ message }: SignMessageArgs): Promise<Hex> => {
    const prov = await getProvider();
    const wallet = createWalletClient({ chain: chain, transport: custom(prov) });

    let addresses;
    try {
      addresses = await wallet.getAddresses();
    } catch (e) {
      throw new Error('Failed to get wallet addresses. Please make sure your wallet is connected.');
    }

    if (!addresses || addresses.length === 0) {
      throw new Error('No wallet account available for signing. Please connect your wallet.');
    }

    const [acct] = addresses;
    if (!acct) throw new Error('No wallet account available for signing');

    const sig = await wallet.signMessage({ account: acct, message });
    return sig as Hex;
  }, [getProvider]);

  // No network switching required for Privy AA writes

  const onAccountsChanged = (_: string[]) => {};
  const onChainChanged = (_: string | number) => {};

  useEffect(() => {
    // Always prefer the active provider's selected account; fallback to Web3Auth address
    (async () => {
      try {
        const prov = await getProvider();
        const wc = createWalletClient({ chain: chain, transport: custom(prov) });
        const [acct] = await wc.getAddresses();
        if (acct) { setSignerAddress(acct as Address); return; }
      } catch {}
      if (eoaAddress) setSignerAddress(eoaAddress as Address);
    })();
  }, [eoaAddress, getProvider]);

  useEffect(() => {
    void refreshOnchain();
  }, [smartAddress, refreshOnchain]);

  // Listen for external wallet disconnection
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Wallet disconnected externally
        setSignerAddress(null);
        setSmartAddress(null);
        setAa(null);
        setIsContract(false);
        setBalanceWei(null);
      }
    };

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  return {
    connected,
    address: signerAddress as Address | null,
    smartAddress: smartAddress as Address | null,
    connect: connectSmart,
    disconnect,
    signMessage,
    getWalletClient,
    getSmartWalletClient,
    refreshOnchain,
    isContract,
    balanceWei,
    canAttest,
    createSmartWallet,
    provisioning,
    busyOpen,
    openWallet,
    wallets: [],
    privyUser: null,
    lastError,
    ensureAa,
    diag,
    testEp,
  } as const;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
