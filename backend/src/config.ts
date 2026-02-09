import { baseSepolia } from 'viem/chains';

export type ChainKey = 'base-sepolia';

const CHAINS: Record<ChainKey, {
  chain: typeof baseSepolia;
  chainId: number;
  rpcUrl: string;
  easAddress: string;
  schemaRegistryAddress: string;
  identitySchemaUid: string;
  repoGlobsSchemaUid: string;
  permissionSchemaUid: string;
  faucetUrl: string;
  explorers: {
    basescanTx: string;
    easAttestation: string;
    easAddress: string;
  };
}> = {
  'base-sepolia': {
    chain: baseSepolia,
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    easAddress: '0x4200000000000000000000000000000000000021',
    schemaRegistryAddress: '0x4200000000000000000000000000000000000020',
    identitySchemaUid: '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af',
    repoGlobsSchemaUid: '0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74',
    permissionSchemaUid: '0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6',
    faucetUrl: 'https://www.coinbase.com/faucets/base-sepolia-faucet',
    explorers: {
      basescanTx: 'https://sepolia.basescan.org/tx',
      easAttestation: 'https://base-sepolia.easscan.org/attestation/view',
      easAddress: 'https://base-sepolia.easscan.org/address'
    }
  }
};

export const CONFIG = {
  minBalanceEth: {
    eoaForIdentity: 0.001,
    kernelForAttestations: 0.01
  },
  maxKernelTopUpEth: 0.1
} as const;

export function getConfig(chainKey?: string) {
  const key = (chainKey || process.env.DIDGIT_CHAIN || 'base-sepolia') as ChainKey;
  const chain = CHAINS[key];
  if (!chain) {
    throw new Error(`Unknown DIDGIT_CHAIN: ${key}`);
  }
  return {
    ...chain,
    minBalanceEth: CONFIG.minBalanceEth,
    maxKernelTopUpEth: CONFIG.maxKernelTopUpEth
  };
}
