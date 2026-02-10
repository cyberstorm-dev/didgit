import { base, arbitrum } from 'viem/chains';

export type ChainKey = 'base' | 'arbitrum';

type ChainConfig = {
  name: ChainKey;
  chain: typeof base | typeof arbitrum;
  chainId: number;
  rpcUrl: string;
  easAddress: string;
  schemaRegistryAddress: string;
  resolverAddress: string;
  identitySchemaUid: string;
  contributionSchemaUid: string;
  repoGlobsSchemaUid: string;
  permissionSchemaUid: string;
  faucetUrl?: string;
  easGraphql: string;
  explorers: {
    tx: string;
    easAttestation: string;
    easAddress: string;
  };
};

function envOrThrow(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getBaseConfig(): ChainConfig {
  return {
    name: 'base',
    chain: base,
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    easAddress: envOrThrow('BASE_EAS_ADDRESS', process.env.BASE_EAS_ADDRESS),
    schemaRegistryAddress: envOrThrow('BASE_SCHEMA_REGISTRY_ADDRESS', process.env.BASE_SCHEMA_REGISTRY_ADDRESS),
    resolverAddress: envOrThrow('BASE_RESOLVER_ADDRESS', process.env.BASE_RESOLVER_ADDRESS),
    identitySchemaUid: envOrThrow('BASE_IDENTITY_SCHEMA_UID', process.env.BASE_IDENTITY_SCHEMA_UID),
    contributionSchemaUid: envOrThrow('BASE_CONTRIBUTION_SCHEMA_UID', process.env.BASE_CONTRIBUTION_SCHEMA_UID),
    repoGlobsSchemaUid: envOrThrow('BASE_REPO_GLOBS_SCHEMA_UID', process.env.BASE_REPO_GLOBS_SCHEMA_UID),
    permissionSchemaUid: envOrThrow('BASE_PERMISSION_SCHEMA_UID', process.env.BASE_PERMISSION_SCHEMA_UID),
    easGraphql: 'https://base.easscan.org/graphql',
    explorers: {
      tx: 'https://basescan.org/tx',
      easAttestation: 'https://base.easscan.org/attestation/view',
      easAddress: 'https://base.easscan.org/address'
    }
  };
}

function getArbitrumConfig(): ChainConfig {
  return {
    name: 'arbitrum',
    chain: arbitrum,
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
    easAddress: envOrThrow('ARBITRUM_EAS_ADDRESS', process.env.ARBITRUM_EAS_ADDRESS),
    schemaRegistryAddress: envOrThrow('ARBITRUM_SCHEMA_REGISTRY_ADDRESS', process.env.ARBITRUM_SCHEMA_REGISTRY_ADDRESS),
    resolverAddress: envOrThrow('ARBITRUM_RESOLVER_ADDRESS', process.env.ARBITRUM_RESOLVER_ADDRESS),
    identitySchemaUid: envOrThrow('ARBITRUM_IDENTITY_SCHEMA_UID', process.env.ARBITRUM_IDENTITY_SCHEMA_UID),
    contributionSchemaUid: envOrThrow('ARBITRUM_CONTRIBUTION_SCHEMA_UID', process.env.ARBITRUM_CONTRIBUTION_SCHEMA_UID),
    repoGlobsSchemaUid: envOrThrow('ARBITRUM_REPO_GLOBS_SCHEMA_UID', process.env.ARBITRUM_REPO_GLOBS_SCHEMA_UID),
    permissionSchemaUid: envOrThrow('ARBITRUM_PERMISSION_SCHEMA_UID', process.env.ARBITRUM_PERMISSION_SCHEMA_UID),
    easGraphql: 'https://arbitrum.easscan.org/graphql',
    explorers: {
      tx: 'https://arbiscan.io/tx',
      easAttestation: 'https://arbitrum.easscan.org/attestation/view',
      easAddress: 'https://arbitrum.easscan.org/address'
    }
  };
}

export const CONFIG = {
  minBalanceEth: {
    eoaForIdentity: 0.001,
    kernelForAttestations: 0.01
  },
  maxKernelTopUpEth: 0.1
} as const;

export function getChainConfig(chainKey?: string) {
  const key = (chainKey || process.env.CHAIN || process.env.DIDGIT_CHAIN || 'base') as ChainKey;
  if (key === 'base') {
    const chain = getBaseConfig();
    return { ...chain, minBalanceEth: CONFIG.minBalanceEth, maxKernelTopUpEth: CONFIG.maxKernelTopUpEth };
  }
  if (key === 'arbitrum') {
    const chain = getArbitrumConfig();
    return { ...chain, minBalanceEth: CONFIG.minBalanceEth, maxKernelTopUpEth: CONFIG.maxKernelTopUpEth };
  }
  throw new Error(`Unknown CHAIN: ${key}`);
}

export function getConfig(chainKey?: string) {
  return getChainConfig(chainKey);
}
