export const STANDALONE_ATTESTOR_ABI = [
  { type: 'event', name: 'IdentityRegistered', inputs: [
    { name: 'registrant', type: 'address', indexed: true },
    { name: 'domain', type: 'string', indexed: false },
    { name: 'identifier', type: 'string', indexed: false },
    { name: 'identityIndex', type: 'uint256', indexed: true },
  ]},
  { type: 'event', name: 'RepositoryPatternSet', inputs: [
    { name: 'registrant', type: 'address', indexed: true },
    { name: 'domain', type: 'string', indexed: false },
    { name: 'identifier', type: 'string', indexed: false },
    { name: 'namespace', type: 'string', indexed: false },
    { name: 'name', type: 'string', indexed: false },
    { name: 'enabled', type: 'bool', indexed: false },
  ]},
  { type: 'function', name: 'registerIdentity', stateMutability: 'nonpayable', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
  ], outputs: [] },
  { type: 'function', name: 'setRepositoryPattern', stateMutability: 'nonpayable', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
    { name: 'namespace', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'enabled', type: 'bool' },
  ], outputs: [] },
  { type: 'function', name: 'getIdentities', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'string' },
    { name: 'limit', type: 'uint32' },
    { name: 'offset', type: 'uint32' },
  ], outputs: [
    { name: 'identities', type: 'tuple[]', components: [
      { name: 'domain', type: 'string' },
      { name: 'identifier', type: 'string' },
      { name: 'registrant', type: 'string' },
      { name: 'proof_url', type: 'string' },
      { name: 'attestor', type: 'string' },
      { name: 'registrant_signature', type: 'bytes' },
      { name: 'attestor_signature', type: 'bytes' },
      { name: 'repositories', type: 'tuple[]', components: [
        { name: 'namespace', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'repository_type', type: 'uint8' },
        { name: 'enabled', type: 'bool' },
      ]},
      { name: 'eas_attestation', type: 'tuple', components: [
        { name: 'id', type: 'string' },
        { name: 'schema_id', type: 'string' },
        { name: 'attester', type: 'string' },
        { name: 'recipient', type: 'string' },
        { name: 'time', type: 'uint64' },
        { name: 'expiration_time', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'revoked', type: 'bool' },
        { name: 'data', type: 'string' },
        { name: 'txid', type: 'string' },
        { name: 'time_created', type: 'uint64' },
        { name: 'revocation_time', type: 'uint64' },
        { name: 'ref_uid', type: 'string' },
        { name: 'ipfs_hash', type: 'string' },
        { name: 'is_offchain', type: 'bool' },
      ]},
    ]},
    { name: 'total_count', type: 'uint32' },
  ]},
  { type: 'function', name: 'getRepositoryPatterns', stateMutability: 'view', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
  ], outputs: [ { name: 'patterns', type: 'string[]' } ] },
  { type: 'function', name: 'isRepositoryPatternEnabled', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'address' },
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
    { name: 'namespace', type: 'string' },
    { name: 'name', type: 'string' },
  ], outputs: [ { name: 'enabled', type: 'bool' } ] },
  { type: 'function', name: 'getIdentityCount', stateMutability: 'view', inputs: [
    { name: 'user', type: 'address' },
  ], outputs: [ { name: 'count', type: 'uint256' } ] },
  { type: 'function', name: 'getIdentityOwner', stateMutability: 'view', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
  ], outputs: [ { name: 'owner', type: 'address' } ] },
  { type: 'error', name: 'IdentityAlreadyExists', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
  ]},
  { type: 'error', name: 'IdentityNotFound', inputs: [
    { name: 'domain', type: 'string' },
    { name: 'identifier', type: 'string' },
  ]},
  { type: 'error', name: 'UnauthorizedAccess', inputs: [
    { name: 'caller', type: 'address' },
    { name: 'owner', type: 'address' },
  ]},
  { type: 'error', name: 'InvalidDomain', inputs: [ { name: 'domain', type: 'string' } ] },
  { type: 'error', name: 'InvalidIdentifier', inputs: [ { name: 'identifier', type: 'string' } ] },
] as const;

