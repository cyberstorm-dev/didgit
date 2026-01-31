import { Address, Hex, createPublicClient, http, createWalletClient, custom, encodeAbiParameters, parseAbi, toHex, getAddress, defineChain, type PublicClient, type WalletClient, encodeFunctionData, decodeEventLog } from 'viem';

// Base mainnet chain definition
export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  network: 'base-mainnet',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
    public: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
});

// Base Sepolia chain definition
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
    public: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
});

// Get chain configuration based on chain ID
export function getChainConfig(chainId: number) {
  switch (chainId) {
    case 8453:
      return baseMainnet;
    case 84532:
      return baseSepolia;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}. Supported chains: 8453 (Base), 84532 (Base Sepolia)`);
  }
}

export const EAS_ABI = parseAbi([
  // EAS uses a nested AttestationRequest struct: (bytes32 schema, (address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)',
]);

const EAS_EVENTS_ABI = parseAbi([
  'event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema)'
]);

function extractAttestationUidFromLog(
  log: { address: string; data: Hex; topics: Hex[] },
  easAddress: string,
  schemaUid: Hex
): Hex | undefined {
  // Only consider logs from EAS contract if address provided; otherwise attempt generic
  const addrOk = (log.address ?? '').toLowerCase() === easAddress.toLowerCase();
  try {
    if (addrOk) {
      const parsed = decodeEventLog({ abi: EAS_EVENTS_ABI, data: log.data, topics: log.topics });
      if (parsed.eventName === 'Attested') {
        const uid = (parsed.args as any).uid as Hex;
        if (uid && uid !== '0x' && uid.toLowerCase() !== schemaUid.toLowerCase()) return uid;
      }
    }
  } catch {}
  // Fallback (same contract only): uid is the 3rd indexed param -> topics[3]
  if (addrOk && Array.isArray(log.topics) && log.topics.length >= 4) {
    const uid = log.topics[3] as Hex;
    if (uid && uid !== '0x' && uid.toLowerCase() !== schemaUid.toLowerCase()) return uid;
  }
  // Alternate fallback (some deployments index schema and keep uid non-indexed):
  // If so, uid may be the first word in `data`.
  if (addrOk && typeof log.data === 'string' && log.data.startsWith('0x') && log.data.length >= 66) {
    const head = ('0x' + log.data.slice(2, 66)) as Hex;
    if (head && head !== '0x' && head.toLowerCase() !== schemaUid.toLowerCase()) return head;
  }
  return undefined;
}

export type BindingData = {
  domain: string;
  username: string;
  wallet: Address;
  message: string;
  signature: Hex;
  proof_url: string;
};

export function encodeBindingData(data: BindingData): Hex {
  return encodeAbiParameters(
    [
      { type: 'string', name: 'domain' },
      { type: 'string', name: 'username' },
      { type: 'address', name: 'wallet' },
      { type: 'string', name: 'message' },
      { type: 'bytes', name: 'signature' },
      { type: 'string', name: 'proof_url' },
    ],
    [data.domain, data.username, getAddress(data.wallet), data.message, data.signature, data.proof_url]
  );
}

export type AttestArgs = {
  schemaUid: Hex; // bytes32
  recipient: Address;
  data: Hex;
};

export const EASAddresses = {
  // Legacy function - kept for backward compatibility
  baseSepolia: (cfg: { EAS_ADDRESS?: string }) => {
    if (!cfg.EAS_ADDRESS) throw new Error('VITE_EAS_BASE_SEPOLIA_ADDRESS (or VITE_EAS_ADDRESS) is required for Base Sepolia');
    return { chain: baseSepolia, contract: cfg.EAS_ADDRESS as Address } as const;
  },
  // New generic function that works with any supported chain
  forChain: (chainId: number, cfg: { EAS_ADDRESS?: string }) => {
    if (!cfg.EAS_ADDRESS) throw new Error('VITE_EAS_ADDRESS is required');
    const chain = getChainConfig(chainId);
    return { chain, contract: cfg.EAS_ADDRESS as Address } as const;
  },
};

export async function attestIdentityBinding(
  args: AttestArgs,
  env: { chain: typeof baseSepolia | typeof baseMainnet; contract: Address },
  clients?: { walletClient?: WalletClient; publicClient?: PublicClient; aaClient?: { sendUserOp: (args: { to: Address; data: Hex; value?: bigint }) => Promise<string>; waitForUserOp: (hash: string) => Promise<any> } }
): Promise<{ txHash: Hex; attestationUid?: Hex }> {
  const isAddr = (v: any) => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
  if (!isAddr(env.contract)) throw new Error(`EAS contract address invalid: ${String(env.contract)}`);
  if (!isAddr(args.recipient)) throw new Error(`Recipient address invalid: ${String(args.recipient)}`);
  const publicClient = clients?.publicClient ?? createPublicClient({ chain: env.chain, transport: http(env.chain.rpcUrls.default.http[0]) });
  // Sanity check: ensure EAS contract code exists at the provided address
  try {
    const code = await publicClient.getCode({ address: env.contract });
    if (!code || code === '0x') {
      throw new Error(`No contract code found at EAS address ${env.contract}. Check VITE_EAS_BASE_SEPOLIA_ADDRESS.`);
    }
  } catch (e) {
    // Surface a helpful error if RPC fails or address has no code
    if (e instanceof Error) throw e;
    throw new Error('Failed to resolve EAS contract code');
  }

  // AA path
  if (clients?.aaClient) {
    const calldata = encodeFunctionData({
      abi: EAS_ABI,
      functionName: 'attest',
      args: [
        {
          schema: args.schemaUid,
          data: {
            recipient: args.recipient,
            expirationTime: BigInt(0),
            revocable: true,
            refUID: toHex(0, { size: 32 }),
            data: args.data,
            value: BigInt(0),
          },
        },
      ],
    });
    const uoHash = await clients.aaClient.sendUserOp({ to: env.contract, data: calldata as Hex, value: 0n });
    const receipt: any = await clients.aaClient.waitForUserOp(uoHash);
    const txHash = (receipt?.receipt?.transactionHash ?? receipt?.transactionHash ?? receipt?.hash ?? uoHash) as Hex;
    // Fetch tx receipt from RPC to decode logs reliably
    let attestationUid: Hex | undefined = undefined;
    try {
      const onchainReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });
      for (const log of onchainReceipt.logs) {
        const uid = extractAttestationUidFromLog(
          { address: log.address as string, data: log.data as Hex, topics: log.topics as Hex[] },
          env.contract as string,
          args.schemaUid
        );
        if (uid) { attestationUid = uid; break; }
      }
    } catch {}
    return { txHash, attestationUid };
  }

  // EOA path (not used in MVP)
  const walletClient = clients?.walletClient ?? (window.ethereum ? createWalletClient({ chain: env.chain, transport: custom(window.ethereum) }) : null);
  if (!walletClient) throw new Error('No wallet client available');
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: env.contract,
    abi: EAS_ABI,
    functionName: 'attest',
    account,
    args: [
      {
        schema: args.schemaUid,
        data: {
          recipient: args.recipient,
          expirationTime: BigInt(0),
          revocable: true,
          refUID: toHex(0, { size: 32 }),
          data: args.data,
          value: BigInt(0),
        },
      },
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  let attestationUid: Hex | undefined = undefined;
  for (const log of receipt.logs) {
    const uid = extractAttestationUidFromLog(
      { address: log.address as string, data: log.data as Hex, topics: log.topics as Hex[] },
      env.contract as string,
      args.schemaUid
    );
    if (uid) { attestationUid = uid; break; }
  }
  return { txHash: hash, attestationUid };
}
