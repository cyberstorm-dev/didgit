# didgit.dev Onboarding Skill

Help humans (or yourself) create a verified GitHub ↔ wallet identity attestation.

**Repo:** [github.com/cyberstorm-dev/didgit](https://github.com/cyberstorm-dev/didgit)
**Network:** Base Sepolia (testnet) — mainnet coming soon
**Time:** ~5 minutes

---

## Overview

didgit.dev creates on-chain proof linking a GitHub username to a wallet address. This is useful for:
- Proving you control both accounts
- Building portable developer reputation
- Accessing gated services that verify identity

**The dapp (didgit.dev) has UX friction.** This skill bypasses it entirely using direct API calls.

---

## For Agents: Self-Registration

If you have a GitHub account and wallet access, you can attest your own identity.

### Prerequisites

- GitHub account with API access (OAuth token or PAT with `gist` scope)
- Wallet with private key access (for signing)
- ~$0.01 ETH on Base Sepolia for gas

### Step 1: Prepare Your Identity Claim

```bash
GITHUB_USERNAME="your-github-username"  # lowercase
WALLET_ADDRESS="0xYourWalletAddress"
MESSAGE="github.com:${GITHUB_USERNAME}"
```

### Step 2: Sign the Message

Sign the message with your wallet's private key. The signature proves you control the wallet.

```javascript
// Using ethers.js
const message = "github.com:your-username";
const signature = await wallet.signMessage(message);
```

Or via cast (Foundry):
```bash
cast wallet sign --private-key $PRIVATE_KEY "$MESSAGE"
```

### Step 3: Create Proof Gist

Create a public gist containing your proof:

```bash
curl -X POST https://api.github.com/gists \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "didgit.dev identity proof",
    "public": true,
    "files": {
      "didgit-proof.json": {
        "content": "{\"domain\":\"github.com\",\"username\":\"YOUR_USERNAME\",\"wallet\":\"0xYOUR_WALLET\",\"message\":\"github.com:YOUR_USERNAME\",\"signature\":\"0xYOUR_SIGNATURE\",\"chain_id\":84532,\"schema_uid\":\"0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af\"}"
      }
    }
  }'
```

Save the gist URL from the response.

### Step 4: Submit Attestation

Submit to EAS on Base Sepolia:

```bash
# Schema UID: 0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af
# Resolver: 0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7
# EAS Contract (Base Sepolia): 0x4200000000000000000000000000000000000021
```

Or use the helper script in the repo:
```bash
cd didgit
pnpm run attest:identity -- \
  --username $GITHUB_USERNAME \
  --wallet $WALLET_ADDRESS \
  --signature $SIGNATURE \
  --proof-url $GIST_URL
```

### Step 5: Verify

Check your attestation on EAS explorer:
- https://base-sepolia.easscan.org/address/YOUR_WALLET_ADDRESS

---

## For Agents: Helping Your Human

If your human wants to attest their identity, guide them through this flow.

### What They Need

1. **A wallet** — If they don't have one:
   - Coinbase Wallet (easiest for Base)
   - MetaMask + add Base network
   - Any EVM wallet works

2. **Base Sepolia ETH** — For gas (~$0.01):
   - Faucet: https://www.coinbase.com/faucets/base-sepolia-faucet

3. **GitHub account** — They probably have this already

### Guided Flow

**Step 1: Get their wallet address**
```
You: "What's your wallet address? I need it to create the identity link."
Human: "0x..."
```

**Step 2: Have them sign a message**
```
You: "Open your wallet and sign this exact message: 'github.com:their-username'
      Don't send a transaction — just sign the message. Send me the signature."
Human: "0x..." (the signature)
```

**Step 3: Get their GitHub token** (or do OAuth)
```
You: "I need to create a public gist on your GitHub to prove you authorized this.
      Either:
      a) Give me a Personal Access Token with 'gist' scope, or
      b) Authorize via OAuth at [link]"
```

**Step 4: You do the rest**
- Create the proof gist via GitHub API
- Submit the EAS attestation
- Confirm success

**Step 5: Celebrate**
```
You: "Done! Your GitHub (their-username) is now linked to your wallet (0x...).
      View it here: https://base-sepolia.easscan.org/attestation/..."
```

---

## Troubleshooting

### "Username already registered"
The resolver enforces one-to-one mapping. If the username is taken:
- Check if they already registered with a different wallet
- Old attestations can be revoked, then re-register

### "Insufficient funds"
They need Base Sepolia ETH. Use the faucet:
https://www.coinbase.com/faucets/base-sepolia-faucet

### "Invalid signature"
- Message must be exactly `github.com:username` (lowercase username)
- They must sign with the wallet they're linking
- Use `personal_sign`, not `eth_sign`

### "Resolver rejected"
The UsernameUniqueResolver checks:
- Username not already taken
- Wallet not already linked to another username
- Attester == recipient (self-attestation only)

---

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| EAS | `0x4200000000000000000000000000000000000021` |
| Schema Registry | `0x4200000000000000000000000000000000000020` |
| UsernameUniqueResolver | `0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7` |
| Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` |

---

## Why This Matters

Identity is the primitive. Without verified identity:
- Agents can't build reputation
- Contributions can't be attributed
- Bounties can't be paid to the right wallet

didgit.dev solves this with on-chain attestations that anyone can verify.

---

*This skill is part of [cyberstorm.dev](https://cyberstorm.dev) — coordination infrastructure for human-AI symbiosis.*
