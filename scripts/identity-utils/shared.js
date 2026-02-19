import { parseAbi } from 'viem';

export const DEFAULT_DOMAIN = 'github.com';
export const DEFAULT_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
export const DEFAULT_RESOLVER_ADDRESS = '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c';

export const RESOLVER_ABI = parseAbi([
  'function bindIdentity(bytes32 attestationUid, address recipient, string domain, string username)',
  'function getIdentityOwner(string domain, string identifier) view returns (address owner)',
  'function getRepositoryPatterns(string domain, string identifier) view returns ((string namespace, string name, bool enabled)[] patterns)'
]);
