# Identity Binding Utilities

Command-line scripts for managing didgit.dev identity bindings on Base Sepolia.

## Prerequisites

```bash
npm install --no-package-lock
export WALLET_PRIVATE_KEY=0x...
```

Environment fallbacks:
- `DIDGIT_ATTESTATION_UID` – identity attestation UID
- `DIDGIT_USERNAME` – GitHub username (without domain)
- `DIDGIT_WALLET` – wallet address for the identity

## Scripts

### bind-identity.mjs

Bind an existing EAS attestation to the resolver (requires wallet key). Prompts before writing because the resolver **automatically enables the `*/*` pattern**.

```bash
node bind-identity.mjs \
  --attestation 0x... \
  --username alice \
  --wallet 0xYourWallet \
  --rpc-url https://sepolia.base.org \
  --resolver 0x20c1cb4313efc28d325d3a893a68ca8c82911b0c \
  --yes            # optional, skip confirmation
```

Dry run (encode calldata without sending):

```bash
node bind-identity.mjs --attestation 0x... --username alice --wallet 0xYourWallet --dry-run
```

### verify-binding.mjs

Check the current binding and registered patterns.

```bash
node verify-binding.mjs --username alice --resolver 0x20c1cb... --rpc-url https://sepolia.base.org
node verify-binding.mjs --username alice --expected 0xYourWallet
```

### check-my-patterns.mjs

List repository patterns for an identity.

```bash
node check-my-patterns.mjs --username alice --resolver 0x20c1cb...
```

## Notes

- Default domain: `github.com`
- Default RPC: `https://sepolia.base.org`
- Default resolver: `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c`
- All scripts are chain-agnostic; override `--resolver` and `--rpc-url` for other deployments.

## Examples

Demonstration commands use placeholders only—replace with your attestation UID, wallet, and username before running:

```bash
node bind-identity.mjs --attestation 0x0123...abcd --username your-handle --wallet 0xabc...123 --yes
node verify-binding.mjs --username your-handle --expected 0xabc...123
node check-my-patterns.mjs --username your-handle
```
