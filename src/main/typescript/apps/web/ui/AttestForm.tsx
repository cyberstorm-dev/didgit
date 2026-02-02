import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { useWallet } from '../wallet/WalletContext';
import { useGithubAuth } from '../auth/useGithub';
import { appConfig } from '../utils/config';
import { attestIdentityBinding, encodeBindingData, EASAddresses, getChainConfig } from '../utils/eas';
import { Hex, verifyMessage, createPublicClient, http } from 'viem';
import { UsernameUniqueResolverABI } from '@didgit/abi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert } from '../components/ui/alert';

const formSchema = z.object({
  github_username: z.string().min(1).max(39),
});

export const AttestForm: React.FC = () => {
  const { address, smartAddress, signMessage, connected, getWalletClient, getSmartWalletClient, canAttest, isContract, balanceWei, refreshOnchain, ensureAa, lastError } = useWallet();
  const { user, token } = useGithubAuth();
  const cfg = useMemo(() => appConfig(), []);
  const easReady = !!cfg.EAS_ADDRESS;
  const isMainnet = cfg.CHAIN_ID === 8453;
  const blockExplorerUrl = isMainnet ? 'https://basescan.org' : 'https://sepolia.basescan.org';
  const easExplorerUrl = isMainnet ? 'https://base.easscan.org' : 'https://base-sepolia.easscan.org';
  const [form, setForm] = useState({ github_username: '' });
  const [gistUrl, setGistUrl] = useState<string | null>(null);
  const [signature, setSignature] = useState<Hex | null>(null);
  const [busySign, setBusySign] = useState(false);
  const [busyGist, setBusyGist] = useState(false);
  const [busyAttest, setBusyAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [attestationUid, setAttestationUid] = useState<Hex | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Pre-fill username from GitHub auth and force lowercase
  React.useEffect(() => {
    if (user?.login) {
      setForm((f) => ({ ...f, github_username: user.login.toLowerCase() }));
    }
  }, [user?.login]);

  const doSign = async () => {
    setError(null);
    if (!connected || !address) return setError('Connect wallet first');
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.errors[0]?.message ?? 'Invalid input');
    try {
      setBusySign(true);
      const msg = `github.com:${parsed.data.github_username}`;
      const sig = await signMessage({ message: msg });
      // verify matches connected wallet
      const ok = await verifyMessage({ message: msg, signature: sig, address });
      if (!ok) throw new Error('Signature does not match connected wallet');
      setSignature(sig);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to sign');
    } finally {
      setBusySign(false);
    }
  };

  // UsernameUniqueResolver ABI (just the setRepoPattern function)
  const UsernameUniqueResolverABI = [
    {
      "type": "function",
      "name": "setRepoPattern",
      "inputs": [
        { "name": "domain", "type": "string" },
        { "name": "username", "type": "string" },
        { "name": "namespace", "type": "string" },
        { "name": "name", "type": "string" },
        { "name": "enabled", "type": "bool" }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    }
  ] as const;

  const setDefaultRepoPattern = async (username: string, walletClient: any) => {
    const resolverAddress = cfg.RESOLVER_ADDRESS as `0x${string}` | undefined;
    if (!resolverAddress) {
      throw new Error('Resolver address not configured');
    }

    // Set default */* pattern (all repositories enabled)
    await walletClient.writeContract({
      address: resolverAddress,
      abi: UsernameUniqueResolverABI,
      functionName: 'setRepoPattern',
      args: ['github.com', username, '*', '*', true],
      gas: BigInt(200000),
    });
  };

  const doAttest = async () => {
    setError(null);
    setTxHash(null);
    setAttestationUid(null);
    if (!connected || !address) return setError('Connect wallet first');
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.errors[0]?.message ?? 'Invalid input');
    if (!signature) return setError('Sign your GitHub username first');
    if (!gistUrl) return setError('Create a proof gist first');
    if (!easReady) return setError('EAS contract address not configured (set VITE_EAS_ADDRESS)');

    // Check if identity already exists in resolver (prevent duplicates - Issue #9)
    const resolverAddress = cfg.RESOLVER_ADDRESS as `0x${string}` | undefined;
    if (resolverAddress) {
      try {
        const publicClient = createPublicClient({
          chain: getChainConfig(cfg.CHAIN_ID),
          transport: http()
        });
        const existingOwner = await publicClient.readContract({
          address: resolverAddress,
          abi: UsernameUniqueResolverABI,
          functionName: 'getIdentityOwner',
          args: ['github.com', parsed.data.github_username]
        }) as `0x${string}`;
        
        if (existingOwner && existingOwner !== '0x0000000000000000000000000000000000000000') {
          // Identity exists - check if it's this wallet
          if (existingOwner.toLowerCase() !== address?.toLowerCase()) {
            return setError(`Username "${parsed.data.github_username}" is already registered to a different wallet (${existingOwner.slice(0, 6)}...${existingOwner.slice(-4)}). Each username can only be linked to one wallet.`);
          }
          // Same wallet - warn but allow (might be re-attesting)
          console.warn('Identity already registered to this wallet, proceeding with re-attestation');
        }
      } catch (e) {
        // If resolver check fails, log but don't block (resolver might not be deployed)
        console.warn('Could not check resolver for existing identity:', e);
      }
    }

    // Resolve account address (EIP-7702 may reuse EOA address)
    const accountAddress = smartAddress ?? address;
    if (!accountAddress) return setError('No account address available');
    // Validate EAS config
    let easEnv: ReturnType<typeof EASAddresses.forChain> | null = null;
    try {
      easEnv = EASAddresses.forChain(cfg.CHAIN_ID, cfg);
    } catch (e) {
      return setError((e as Error).message ?? 'EAS configuration missing');
    }
    // Extra guard: ensure EAS contract/address shapes are valid
    const addrPattern = /^0x[0-9a-fA-F]{40}$/;
    if (!addrPattern.test(accountAddress)) return setError('Resolved account address is invalid');
    if (!addrPattern.test(easEnv.contract as string)) return setError('EAS contract address is invalid');

    const data = {
      domain: 'github.com',
      username: parsed.data.github_username,
      wallet: address!, // Use EOA address instead of smart address
      message: `github.com:${parsed.data.github_username}`,
      signature: signature,
      proof_url: gistUrl,
    };

    try {
      setBusyAttest(true);
      let encoded: Hex;
      try {
        encoded = encodeBindingData(data);
      } catch (e) {
        return setError('Invalid account address for binding');
      }
      // Ensure AA client is initialized (EIP-7702 may have no code deployed)
      const ok = await ensureAa();
      const aaClient = ok ? await getSmartWalletClient() : null;
      if (!aaClient || !(smartAddress ?? address)) throw new Error(lastError ?? 'AA smart wallet not ready');
      const res = await attestIdentityBinding(
        {
          schemaUid: cfg.EAS_SCHEMA_UID,
          data: encoded,
          recipient: address!, // Use EOA address as recipient too
        },
        easEnv!,
        { aaClient }
      );
      setTxHash(res.txHash);
      if (res.attestationUid) {
        setAttestationUid(res.attestationUid);

        // Auto-set default */* pattern after successful attestation
        try {
          await setDefaultRepoPattern(parsed.data.github_username, aaClient);
        } catch (e) {
          // Don't fail the whole attestation if pattern setting fails
          console.warn('Failed to set default repository pattern:', e);
        }
      }
    } catch (e) {
      const ctx = {
        eoaAddress: address ?? null,
        easContract: ((): string | null => { try { return EASAddresses.forChain(cfg.CHAIN_ID, cfg).contract as unknown as string; } catch { return null; } })(),
        hasAaClient: !!(await getSmartWalletClient()),
        hasSig: !!signature,
        hasGist: !!gistUrl,
      };
      setError(`${(e as Error).message}\ncontext=${JSON.stringify(ctx)}`);
    } finally {
      setBusyAttest(false);
    }
  };

  const createGist = async () => {
    setError(null);
    if (!token) return setError('Connect GitHub first');
    try {
      setBusyGist(true);
      // Create JSON proof content
      const proofData = {
        domain: 'github.com',
        username: form.github_username,
        wallet: address ?? '',
        message: `github.com:${form.github_username}`,
        signature: signature ?? '<sign in app>',
        chain_id: cfg.CHAIN_ID,
        schema_uid: cfg.EAS_SCHEMA_UID,
      };
      const content = JSON.stringify(proofData, null, 2);
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
        body: JSON.stringify({
          description: 'GitHub activity attestation proof',
          public: true,
          files: { ['didgit.dev-proof.json']: { content } },
        }),
      });
      if (!res.ok) throw new Error('Failed to create gist');
      const json = await res.json();
      if (json.html_url) setGistUrl(json.html_url as string);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyGist(false);
    }
  };

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Create GitHub Identity Attestation</h3>
      <div className="max-w-2xl space-y-3">
        <div>
          <label className="text-sm text-gray-600">GitHub Username (will sign "github.com:username")</label>
          <Input name="github_username" value={form.github_username} onChange={onChange} placeholder="Connect GitHub first" disabled readOnly />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button onClick={doSign} disabled={busySign || !address || !form.github_username}>
            {busySign ? 'Signing…' : `Sign "github.com:${form.github_username}"`}
          </Button>
          {!gistUrl ? (
            <Button onClick={createGist} disabled={!token || busyGist} variant="outline">
              {busyGist ? 'Creating Gist…' : 'Create didgit.dev-proof.json'}
            </Button>
          ) : (
            <Button variant="outline" disabled>didgit.dev-proof.json Created</Button>
          )}
          <Button onClick={doAttest} disabled={!signature || !gistUrl || busyAttest || !easReady || !(smartAddress || address)} variant="secondary">
            {busyAttest ? 'Submitting…' : 'Submit Attestation'}
          </Button>
        </div>
        {smartAddress && balanceWei !== null && balanceWei === 0n && (
          <Alert>
            AA wallet has 0 balance on {isMainnet ? 'Base' : 'Base Sepolia'}. Fund it, then <button className="underline" onClick={() => refreshOnchain()}>refresh</button>.
          </Alert>
        )}
        {!easReady && (
          <Alert>EAS contract address is not set. Add VITE_EAS_ADDRESS to .env and reload.</Alert>
        )}
        {isContract && balanceWei !== null && balanceWei === 0n && (
          <Alert>AA wallet has 0 balance. Fund it to proceed.</Alert>
        )}
        {/* Readiness checks moved into Wallet card for clearer UX */}
        {gistUrl && (
          <div className="text-sm">Proof Gist: <a className="text-blue-600 underline" href={gistUrl} target="_blank" rel="noreferrer">{gistUrl}</a></div>
        )}
        {signature && (
          <div className="text-xs text-gray-500">Signature: <code>{signature}</code></div>
        )}
        {txHash && (
          <div className="space-y-1">
            <div>
              Tx: <a className="text-blue-600 underline" href={`${blockExplorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a>
            </div>
            {attestationUid && (
              <div>
                Attestation: <a className="text-blue-600 underline" href={`${easExplorerUrl}/attestation/view/${attestationUid}`} target="_blank" rel="noreferrer">{attestationUid}</a>
              </div>
            )}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </section>
  );
};
