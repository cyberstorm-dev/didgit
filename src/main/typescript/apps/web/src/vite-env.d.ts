/// <reference types="vite/client" />

type ViteEnvString = string | undefined;

interface ImportMetaEnv {
  readonly VITE_CHAIN?: string;
  readonly VITE_BASE_EAS_ADDRESS?: ViteEnvString;
  readonly VITE_ARBITRUM_EAS_ADDRESS?: ViteEnvString;
  readonly VITE_BASE_IDENTITY_SCHEMA_UID?: ViteEnvString;
  readonly VITE_ARBITRUM_IDENTITY_SCHEMA_UID?: ViteEnvString;
  readonly VITE_BASE_CONTRIBUTION_SCHEMA_UID?: ViteEnvString;
  readonly VITE_ARBITRUM_CONTRIBUTION_SCHEMA_UID?: ViteEnvString;
  readonly VITE_BASE_PERMISSION_SCHEMA_UID?: ViteEnvString;
  readonly VITE_ARBITRUM_PERMISSION_SCHEMA_UID?: ViteEnvString;
  readonly VITE_BASE_REPO_GLOBS_SCHEMA_UID?: ViteEnvString;
  readonly VITE_ARBITRUM_REPO_GLOBS_SCHEMA_UID?: ViteEnvString;
  readonly VITE_RESOLVER_ADDRESS?: ViteEnvString;
  readonly VITE_EAS_SCHEMA_UID?: ViteEnvString;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export {};
