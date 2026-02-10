# Smart Contract Reference

Contract addresses, ABIs, and deployment information.

## Network Addresses

### Base Sepolia (Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| EAS | `0x4200000000000000000000000000000000000021` | [View](https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000021) |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | [View](https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000020) |
| UsernameUniqueResolver | `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c` | [View](https://sepolia.basescan.org/address/0x20c1cb4313efc28d325d3a893a68ca8c82911b0c) |

### Base Mainnet

| Contract | Address | Explorer |
|----------|---------|----------|
| EAS | `0x4200000000000000000000000000000000000021` | [View](https://basescan.org/address/0x4200000000000000000000000000000000000021) |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | [View](https://basescan.org/address/0x4200000000000000000000000000000000000020) |
| UsernameUniqueResolverV2 | *Coming soon* | — |

**Base Mainnet Roles (V2)**

| Role | Address |
|------|---------|
| Owner | `0xd04FC7D728AA0052dFB2A9C2D1251fdbe59a4f0b` |
| Attester (role name: `verifier`) | `0xD1c0CC69E0D8fF131D2775E2B541df1541092E3a` |
| Treasury | `0xB7ec37267f8a6Bb08124653CE500B916d284Dae2` |

## Schema UIDs

### Identity Schema

**Base Mainnet UID:** `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af`

```
string domain, string username, address wallet, string message, bytes signature, string proof_url
```

[View on EAS Explorer](https://base.easscan.org/schema/view/0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af)

### Contribution Schema

**Base Mainnet UID:** `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782`

```
string repo, string commitHash, string author, string message, uint64 timestamp, bytes32 identityUid
```

[View on EAS Explorer](https://base.easscan.org/schema/view/0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782)

> [!IMPORTANT]
> Mainnet schema UIDs are chain-specific and will differ from Base Sepolia. Update this doc once mainnet schemas are registered.

## UsernameUniqueResolver ABI

```json
[
  {
    "type": "function",
    "name": "bindIdentity",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "username", "type": "string" },
      { "name": "wallet", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
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
  },
  {
    "type": "function",
    "name": "isRepositoryEnabled",
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "domain", "type": "string" },
      { "name": "identifier", "type": "string" },
      { "name": "namespace", "type": "string" },
      { "name": "name", "type": "string" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getIdentity",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "username", "type": "string" }
    ],
    "outputs": [{ "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUsername",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "wallet", "type": "address" }
    ],
    "outputs": [{ "type": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "IdentityBound",
    "inputs": [
      { "name": "domain", "type": "string", "indexed": false },
      { "name": "username", "type": "string", "indexed": false },
      { "name": "wallet", "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event",
    "name": "RepoPatternSet",
    "inputs": [
      { "name": "owner", "type": "address", "indexed": true },
      { "name": "domain", "type": "string", "indexed": false },
      { "name": "pattern", "type": "string", "indexed": false },
      { "name": "enabled", "type": "bool", "indexed": false }
    ]
  }
]
```

## Usage Examples

### Read Identity

```typescript
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

const wallet = await client.readContract({
  address: '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c',
  abi: resolverAbi,
  functionName: 'getIdentity',
  args: ['github.com', 'cyberstorm-nisto']
});
// Returns: 0x0CA6A71045C26087F8dCe6d3F93437f31B81C138
```

### Check Repo Enabled

```typescript
const enabled = await client.readContract({
  address: '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c',
  abi: resolverAbi,
  functionName: 'isRepositoryEnabled',
  args: [
    '0x0CA6A71045C26087F8dCe6d3F93437f31B81C138', // owner
    'github.com',                                   // domain
    'cyberstorm-nisto',                             // identifier
    'cyberstorm-dev',                               // namespace
    'didgit'                                        // name
  ]
});
// Returns: true
```

### Register Repo Pattern

```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http()
});

await walletClient.writeContract({
  address: '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c',
  abi: resolverAbi,
  functionName: 'setRepoPattern',
  args: ['github.com', 'myusername', 'myorg', '*', true]
});
```

## EAS Integration

### Create Attestation

```typescript
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';

const eas = new EAS('0x4200000000000000000000000000000000000021');
eas.connect(signer);

const schemaEncoder = new SchemaEncoder(
  'string domain, string username, address wallet, string message, bytes signature, string proof_url'
);

const encodedData = schemaEncoder.encodeData([
  { name: 'domain', value: 'github.com', type: 'string' },
  { name: 'username', value: 'myusername', type: 'string' },
  { name: 'wallet', value: '0x...', type: 'address' },
  { name: 'message', value: 'github.com:myusername', type: 'string' },
  { name: 'signature', value: '0x...', type: 'bytes' },
  { name: 'proof_url', value: 'https://gist.github.com/...', type: 'string' }
]);

const tx = await eas.attest({
  schema: IDENTITY_SCHEMA_UID,
  data: {
    recipient: '0x...',
    data: encodedData
  }
});

const attestationUid = await tx.wait();
```

## Gas Estimates

| Operation | Estimated Gas | ~Cost (Base) |
|-----------|---------------|--------------|
| bindIdentity | 80,000 | ~$0.02 |
| setRepoPattern | 50,000 | ~$0.01 |
| EAS attest (identity) | 150,000 | ~$0.04 |
| EAS attest (contribution) | 120,000 | ~$0.03 |

*Costs vary with gas prices. Base typically has very low fees.*

---

*Full contract source: [UsernameUniqueResolver.sol](https://github.com/cyberstorm-dev/didgit/blob/main/src/main/solidity/src/UsernameUniqueResolver.sol)*
