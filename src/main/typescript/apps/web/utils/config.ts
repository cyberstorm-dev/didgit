import { z } from 'zod';

const envSchema = z.object({
  // Chain configuration
  VITE_CHAIN_ID: z.string().optional(),
  // Generic EAS configuration (preferred)
  VITE_EAS_SCHEMA_UID: z.string().startsWith('0x').length(66).optional(),
  VITE_EAS_ADDRESS: z.string().optional(),
  // Legacy chain-specific config (backwards compatibility)
  VITE_EAS_BASE_SEPOLIA_SCHEMA_UID: z.string().startsWith('0x').length(66).optional(),
  VITE_EAS_BASE_SEPOLIA_ADDRESS: z.string().optional(),
  VITE_ZERODEV_PROJECT_ID: z.string().optional(),
  VITE_ZERODEV_BUNDLER_RPC: z.string().url().optional(),
  VITE_RESOLVER_ADDRESS: z.string().optional(),
  VITE_STANDALONE_ATTESTOR_ADDRESS: z.string().optional(),
});

export function appConfig() {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    return {
      CHAIN_ID: parseInt((import.meta as any).env.VITE_CHAIN_ID ?? '8453'), // Default to Base mainnet
      EAS_SCHEMA_UID: '0x7e4a502d6e04b8ff7a80ac8b852c8b53199fe297ddf092a63fffb2a5a062b1b7',
      EAS_ADDRESS: (import.meta as any).env.VITE_EAS_ADDRESS ?? (import.meta as any).env.VITE_EAS_BASE_SEPOLIA_ADDRESS ?? undefined,
      ZERODEV_PROJECT_ID: (import.meta as any).env.VITE_ZERODEV_PROJECT_ID ?? undefined,
    } as const;
  }

  const CHAIN_ID = parseInt(parsed.data.VITE_CHAIN_ID ?? '8453'); // Default to Base mainnet
  const EAS_SCHEMA_UID = parsed.data.VITE_EAS_SCHEMA_UID ?? parsed.data.VITE_EAS_BASE_SEPOLIA_SCHEMA_UID ?? '0x7e4a502d6e04b8ff7a80ac8b852c8b53199fe297ddf092a63fffb2a5a062b1b7';
  let EAS_ADDRESS = parsed.data.VITE_EAS_ADDRESS ?? parsed.data.VITE_EAS_BASE_SEPOLIA_ADDRESS;
  if (EAS_ADDRESS && (EAS_ADDRESS.trim().toLowerCase() === 'undefined' || EAS_ADDRESS.trim() === '')) {
    EAS_ADDRESS = undefined as any;
  }
  return {
    CHAIN_ID,
    EAS_SCHEMA_UID,
    EAS_ADDRESS,
    ZERODEV_PROJECT_ID: parsed.data.VITE_ZERODEV_PROJECT_ID,
    ZERODEV_BUNDLER_RPC: parsed.data.VITE_ZERODEV_BUNDLER_RPC,
    RESOLVER_ADDRESS: parsed.data.VITE_RESOLVER_ADDRESS,
    STANDALONE_ATTESTOR_ADDRESS: parsed.data.VITE_STANDALONE_ATTESTOR_ADDRESS,
  } as const;
}
