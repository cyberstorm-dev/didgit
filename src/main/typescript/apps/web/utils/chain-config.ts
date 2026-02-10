export type ChainKey = 'base' | 'arbitrum';

type ChainConfig = {
  name: ChainKey;
  chainId: number;
  easAddress: string;
  schemaUids: {
    identity: string;
    contribution: string;
    permission: string;
    repoGlobs: string;
  };
  explorers: {
    tx: string;
    easAttestation: string;
    easAddress: string;
  };
};

const CHAINS: Record<ChainKey, ChainConfig> = {
  base: {
    name: 'base',
    chainId: 8453,
    easAddress: import.meta.env.VITE_BASE_EAS_ADDRESS ?? '',
    schemaUids: {
      identity: import.meta.env.VITE_BASE_IDENTITY_SCHEMA_UID ?? '',
      contribution: import.meta.env.VITE_BASE_CONTRIBUTION_SCHEMA_UID ?? '',
      permission: import.meta.env.VITE_BASE_PERMISSION_SCHEMA_UID ?? '',
      repoGlobs: import.meta.env.VITE_BASE_REPO_GLOBS_SCHEMA_UID ?? ''
    },
    explorers: {
      tx: 'https://basescan.org/tx',
      easAttestation: 'https://base.easscan.org/attestation/view',
      easAddress: 'https://base.easscan.org/address'
    }
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    easAddress: import.meta.env.VITE_ARBITRUM_EAS_ADDRESS ?? '',
    schemaUids: {
      identity: import.meta.env.VITE_ARBITRUM_IDENTITY_SCHEMA_UID ?? '',
      contribution: import.meta.env.VITE_ARBITRUM_CONTRIBUTION_SCHEMA_UID ?? '',
      permission: import.meta.env.VITE_ARBITRUM_PERMISSION_SCHEMA_UID ?? '',
      repoGlobs: import.meta.env.VITE_ARBITRUM_REPO_GLOBS_SCHEMA_UID ?? ''
    },
    explorers: {
      tx: 'https://arbiscan.io/tx',
      easAttestation: 'https://arbitrum.easscan.org/attestation/view',
      easAddress: 'https://arbitrum.easscan.org/address'
    }
  }
};

export function getChainConfig(chainKey?: string): ChainConfig {
  const key = (chainKey || import.meta.env.VITE_CHAIN || 'base') as ChainKey;
  const config = CHAINS[key];
  if (!config) {
    throw new Error(`Unknown chain: ${key}`);
  }
  return config;
}
