import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { useWallet } from '../wallet/WalletContext';
import { useGithubAuth } from '../auth/useGithub';
import { useGitlabAuth } from '../auth/useGitlab';
import { createPublicSnippet } from '../auth/gitlab';
import { appConfig } from '../utils/config';
import { attestIdentityBinding, encodeBindingData, EASAddresses } from '../utils/eas';
import { Hex, verifyMessage } from 'viem';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert } from '../components/ui/alert';

type Platform = 'github' | 'gitlab';

const formSchema = z.object({
  username: z.string().min(1).max(39),
});

export const AttestForm: React.FC = () => {
  const { address, smartAddress, signMessage, connected, getWalletClient, getSmartWalletClient, canAttest, isContract, balanceWei, refreshOnchain, ensureAa, lastError } = useWallet();
  const github = useGithubAuth();
  const gitlab = useGitlabAuth();
  const cfg = useMemo(() => appConfig(), []);
  const easReady = !!cfg.EAS_ADDRESS;
  const isMainnet = cfg.CHAIN_ID === 8453;
  const blockExplorerUrl = isMainnet ? 'https://basescan.org' : 'https://sepolia.basescan.org';
  const easExplorerUrl = isMainnet ? 'https://base.easscan.org' : 'https://base-sepolia.easscan.org';
  
  // Platform selection
  const [platform, setPlatform] = useState<Platform>('github');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  
  // Determine domain based on platform and custom domain setting
  // Prefer the host from the auth context (where user actually authenticated)
  const effectiveGitlabHost = gitlab.customHost || (useCustomDomain && customDomain.trim() ? customDomain.trim() : null);
  const domain = platform === 'github' 
    ? 'github.com' 
    : (effectiveGitlabHost || 'gitlab.com');
  
  // Get current auth state based on platform
  const currentAuth = platform === 'github' ? github : gitlab;
  const currentUser = platform === 'github' ? github.user : gitlab.user;
  const currentToken = platform === 'github' ? github.token : gitlab.token;
  const currentUsername = platform === 'github' ? github.user?.login : gitlab.user?.username;
  
  const [form, setForm] = useState({ username: '' });
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [signature, setSignature] = useState<Hex | null>(null);
  const [busySign, setBusySign] = useState(false);
  const [busyProof, setBusyProof] = useState(false);
  const [busyAttest, setBusyAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [attestationUid, setAttestationUid] = useState<Hex | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Pre-fill username from auth and force lowercase
  React.useEffect(() => {
    const username = currentUsername;
    if (username) {
      setForm((f) => ({ ...f, username: username.toLowerCase() }));
    }
  }, [currentUsername]);

  // Reset state when platform changes
  React.useEffect(() => {
    setProofUrl(null);
    setSignature(null);
    setTxHash(null);
    setAttestationUid(null);
    setError(null);
    setUseCustomDomain(false);
    setCustomDomain('');
    // Update username from new platform's auth
    const username = platform === 'github' ? github.user?.login : gitlab.user?.username;
    if (username) {
      setForm({ username: username.toLowerCase() });
    } else {
      setForm({ username: '' });
    }
  }, [platform, github.user?.login, gitlab.user?.username]);

  const doSign = async () => {
    setError(null);
    if (!connected || !address) return setError('Connect wallet first');
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.errors[0]?.message ?? 'Invalid input');
    try {
      setBusySign(true);
      const msg = `${domain}:${parsed.data.username}`;
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
      args: [domain, username, '*', '*', true],
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
    if (!signature) return setError(`Sign your ${platform === 'github' ? 'GitHub' : 'GitLab'} username first`);
    if (!proofUrl) return setError(`Create a proof ${platform === 'github' ? 'gist' : 'snippet'} first`);
    if (!easReady) return setError('EAS contract address not configured (set VITE_EAS_ADDRESS)');

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
      domain,
      username: parsed.data.username,
      wallet: address!, // Use EOA address instead of smart address
      message: `${domain}:${parsed.data.username}`,
      signature: signature,
      proof_url: proofUrl,
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
          await setDefaultRepoPattern(parsed.data.username, aaClient);
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
        hasProof: !!proofUrl,
      };
      setError(`${(e as Error).message}\ncontext=${JSON.stringify(ctx)}`);
    } finally {
      setBusyAttest(false);
    }
  };

  const createProof = async () => {
    setError(null);
    if (!currentToken) return setError(`Connect ${platform === 'github' ? 'GitHub' : 'GitLab'} first`);
    
    try {
      setBusyProof(true);
      // Create JSON proof content
      const proofData = {
        domain,
        username: form.username,
        wallet: address ?? '',
        message: `${domain}:${form.username}`,
        signature: signature ?? '<sign in app>',
        chain_id: cfg.CHAIN_ID,
        schema_uid: cfg.EAS_SCHEMA_UID,
      };
      const content = JSON.stringify(proofData, null, 2);

      if (platform === 'github' && github.token) {
        // Create GitHub Gist
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${github.token.access_token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({
            description: 'GitHub activity attestation proof',
            public: true,
            files: { ['didgit.dev-proof.json']: { content } },
          }),
        });
        if (!res.ok) throw new Error('Failed to create gist');
        const json = await res.json();
        if (json.html_url) setProofUrl(json.html_url as string);
      } else if (platform === 'gitlab' && gitlab.token) {
        // Create GitLab Snippet
        // Use the host from auth context (where user authenticated) or fallback to manual entry
        const result = await createPublicSnippet(gitlab.token, {
          title: 'didgit.dev identity proof',
          description: 'GitLab identity attestation proof for didgit.dev',
          filename: 'didgit.dev-proof.json',
          content,
        }, effectiveGitlabHost || undefined);
        setProofUrl(result.web_url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyProof(false);
    }
  };

  const platformName = platform === 'github' ? 'GitHub' : 'GitLab';
  const proofTypeName = platform === 'github' ? 'Gist' : 'Snippet';

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Create Identity Attestation</h3>
      
      {/* Platform Selector */}
      <div className="mb-4">
        <label className="text-sm text-gray-600 block mb-1">Platform</label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-md w-fit">
          <button
            onClick={() => setPlatform('github')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              platform === 'github'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            GitHub
          </button>
          <button
            onClick={() => setPlatform('gitlab')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              platform === 'gitlab'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            GitLab
          </button>
        </div>
      </div>

      {/* Self-hosted GitLab info */}
      {platform === 'gitlab' && (
        <div className="mb-4 space-y-2">
          {gitlab.customHost ? (
            <p className="text-sm text-gray-600">
              Connected to self-hosted instance: <code className="bg-gray-100 px-1 rounded">{gitlab.customHost}</code>
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomDomain}
                  onChange={(e) => setUseCustomDomain(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Self-hosted GitLab instance (override)
              </label>
              {useCustomDomain && (
                <Input
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="gitlab.example.com"
                  className="max-w-xs"
                />
              )}
            </>
          )}
          <p className="text-xs text-gray-500">
            Domain: <code className="bg-gray-100 px-1 rounded">{domain}</code>
          </p>
        </div>
      )}

      {/* Connection Status */}
      {!currentUser && (
        <Alert className="mb-4">
          Connect {platformName} first using the connection panel above.
        </Alert>
      )}

      <div className="max-w-2xl space-y-3">
        <div>
          <label className="text-sm text-gray-600">{platformName} Username (will sign "{domain}:username")</label>
          <Input
            name="username"
            value={form.username}
            onChange={onChange}
            placeholder={`Connect ${platformName} first`}
            disabled
            readOnly
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button onClick={doSign} disabled={busySign || !address || !form.username}>
            {busySign ? 'Signing…' : `Sign "${domain}:${form.username}"`}
          </Button>
          {!proofUrl ? (
            <Button onClick={createProof} disabled={!currentToken || busyProof} variant="outline">
              {busyProof ? `Creating ${proofTypeName}…` : `Create didgit.dev-proof.json`}
            </Button>
          ) : (
            <Button variant="outline" disabled>didgit.dev-proof.json Created</Button>
          )}
          <Button
            onClick={doAttest}
            disabled={!signature || !proofUrl || busyAttest || !easReady || !(smartAddress || address)}
            variant="secondary"
          >
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
        {proofUrl && (
          <div className="text-sm">
            Proof {proofTypeName}: <a className="text-blue-600 underline" href={proofUrl} target="_blank" rel="noreferrer">{proofUrl}</a>
          </div>
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
