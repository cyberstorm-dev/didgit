// UsernameUniqueResolver ABI and types for repository pattern management
export const UsernameUniqueResolverABI = [
  {
    "type": "function",
    "name": "setRepositoryPattern",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "identifier", "type": "string" },
      { "name": "namespace", "type": "string" },
      { "name": "name", "type": "string" },
      { "name": "enabled", "type": "bool" }
    ],
    "outputs": [
      { "name": "success", "type": "bool" },
      { "name": "error", "type": "string" },
      { "name": "transaction_hash", "type": "string" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isRepoPatternEnabled",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "username", "type": "string" },
      { "name": "namespace", "type": "string" },
      { "name": "name", "type": "string" }
    ],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRepositoryPatterns",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "identifier", "type": "string" }
    ],
    "outputs": [
      {
        "name": "patterns",
        "type": "tuple[]",
        "components": [
          { "name": "namespace", "type": "string" },
          { "name": "name", "type": "string" },
          { "name": "enabled", "type": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "identityExists",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "username", "type": "string" }
    ],
    "outputs": [{ "name": "exists", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getIdentityOwner",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "username", "type": "string" }
    ],
    "outputs": [{ "name": "owner", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "RepoPatternSet",
    "inputs": [
      { "name": "domain", "type": "string", "indexed": true },
      { "name": "usernameLower", "type": "string", "indexed": true },
      { "name": "namespace", "type": "string", "indexed": false },
      { "name": "name", "type": "string", "indexed": false },
      { "name": "enabled", "type": "bool", "indexed": false }
    ]
  }
] as const;

// TypeScript types for repository patterns
export interface RepositoryPattern {
  namespace: string;
  name: string;
  enabled: boolean;
}

export interface RepoPatternForm {
  domain: string;
  username: string;
  namespace: string;
  name: string;
  enabled: boolean;
}

// Validation functions
export function validateDomain(domain: string): boolean {
  return domain.length > 0 && domain.length <= 100;
}

export function validateUsername(username: string): boolean {
  return username.length > 0 && username.length <= 39;
}

export function validateNamespace(namespace: string): boolean {
  return namespace.length > 0 && namespace.length <= 39;
}

export function validateRepoName(name: string): boolean {
  return name.length > 0 && name.length <= 100;
}