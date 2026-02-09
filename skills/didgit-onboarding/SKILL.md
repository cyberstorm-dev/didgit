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

- GitHub account with API access: OAuth token or PAT with `gist` scope (`YOUR_GITHUB_TOKEN`), or be logged into GitHub if using the UI.
- Wallet with private key access (hex, 0x-prefixed) for signing the identity message.
- ~$0.01 ETH on Base Sepolia for gas.

### Step 1: Prepare Your Identity Claim

```bash
GITHUB_USERNAME="your-github-username"  # lowercase
WALLET_ADDRESS="0xYourWalletAddress"
MESSAGE="github.com:${GITHUB_USERNAME}"
```

### Step 2: Sign the Message

Sign the exact message with your wallet. Use a hex private key **with 0x prefix**. Capture the signature as `$SIGNATURE` for later.

Using cast (Foundry):
```bash
export PRIVATE_KEY=0xYourWalletPrivateKey   # MUST include 0x prefix
export SIGNATURE=$(cast wallet sign --private-key $PRIVATE_KEY "$MESSAGE")
echo "$SIGNATURE"
```

Using ethers.js (Node):
```javascript
import { Wallet } from "ethers";
const message = "github.com:your-username";
const wallet = new Wallet("0xYourWalletPrivateKey"); // 0x-prefixed
const signature = await wallet.signMessage(message);
console.log(signature); // set this as SIGNATURE for next steps
```

### Step 3: Create Proof Gist

Prereq: `YOUR_GITHUB_TOKEN` (PAT with `gist` scope) or be logged into GitHub and paste manually. Capture the gist URL as `$GIST_URL` for later.

If using GitHub UI, create a public gist named `didgit-proof.json` with this content (edit fields) and copy the gist URL:
```json
{
  "domain": "github.com",
  "username": "YOUR_USERNAME",
  "wallet": "0xYOUR_WALLET",
  "message": "github.com:YOUR_USERNAME",
  "signature": "0xYOUR_SIGNATURE",
  "chain_id": 84532,
  "schema_uid": "0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af"
}
```

If using curl + token:
```bash
GIST_JSON='{"domain":"github.com","username":"YOUR_USERNAME","wallet":"0xYOUR_WALLET","message":"github.com:YOUR_USERNAME","signature":"0xYOUR_SIGNATURE","chain_id":84532,"schema_uid":"0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af"}'
RESPONSE=$(curl -s -X POST https://api.github.com/gists \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"description\":\"didgit.dev identity proof\",\"public\":true,\"files\":{\"didgit-proof.json\":{\"content\":\"${GIST_JSON//\"/\\\"}\"}}}")
export GIST_URL=$(echo "$RESPONSE" | jq -r '.html_url')
echo "$GIST_URL"
```

Save and export `GIST_URL` from the response.

### Step 4: Submit Attestation (script in repo)

From `didgit/backend` (deps already installed), set envs or pass flags:

```bash
cd didgit/backend

# Env form (0x-prefixed keys)
PRIVATE_KEY=0x<YOUR_WALLET_KEY> \
GITHUB_USERNAME=$GITHUB_USERNAME \
WALLET_ADDRESS=$WALLET_ADDRESS \
SIGNATURE=$SIGNATURE \
GIST_URL=$GIST_URL \
pnpm run attest:identity

# Or flags override envs
pnpm run attest:identity -- \
  --private-key 0x<YOUR_WALLET_KEY> \
  --username $GITHUB_USERNAME \
  --wallet $WALLET_ADDRESS \
  --signature $SIGNATURE \
  --proof-url $GIST_URL
```

Script location: `backend/src/attest-identity.ts`
Fields (schema order): domain, username, wallet, message, signature, proof_url.
After run, capture `UID` from output.

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

## Enabling Automatic Commit Attestations

After identity registration, set up a **session key** so your commits are attested automatically:

### What's a Session Key?

A scoped permission that lets the didgit verifier create attestations on your behalf:
- **You own** all attestations (from your Kernel address)
- **You pay** gas (from your Kernel balance)
- **You revoke** anytime (remove the permission)
- **Verifier can only** call EAS.attest() — nothing else

### Setup (One-Time, current flow)

> Current helper is one-step and temporarily needs the verifier signing key to serialize the permission. External users should delete the verifier key from `.env` after setup. A two-step flow (no verifier key locally) is planned.

```bash
cd didgit/backend

cat > .env <<'EOF'
VERIFIER_PRIVKEY=0xfcb525413bd7c69608771c60e923c7dcb283caa07559f5bbfcffb86ed2bbd637
GITHUB_TOKEN=<your_github_token>
BUNDLER_RPC=https://rpc.zerodev.app/api/v3/aa40f236-4eff-41e1-8737-ab95ab7e1850/chain/84532
USER_PRIVKEY=0x<YOUR_EOA_PRIVKEY>
EOF

npx tsx src/setup-permission.ts
```

What it does:
1) Derives your Kernel from your EOA
2) Builds a permission scoped to `EAS.attest()` and signs it with the verifier key
3) Attests the permission to EAS **as you** (attester = your EOA)
4) Prints your Kernel address and permission attestation UID

After you run it: remove `VERIFIER_PRIVKEY` from `.env` if desired.

### Fund Your Kernel

The setup prints your Kernel address. Fund it on Base Sepolia:

```bash
# ~0.01 ETH covers 1000+ attestations
cast send 0x<YOUR_KERNEL> --value 0.01ether --rpc-url https://sepolia.base.org
```

### Register Your Repos

Attest Repo Globs defining which repos to track (e.g., `yourorg/*`). The verifier will only attest commits matching your globs.

### After Setup

- Your EOA key is not needed again; the verifier uses the on-chain permission
- Attestations are from your Kernel; you can revoke via EAS anytime
- Gas is paid from your Kernel balance

### Planned improvement

A two-step flow that avoids sharing the verifier key with users:
1) User derives Kernel address and submits it.
2) Service signs the permission blob with the verifier key.
3) User attests the blob with their EOA key only.

Docs and CLI will be updated when this is live.

---

## Why This Matters

Identity is the primitive. Without verified identity:
- Agents can't build reputation
- Contributions can't be attributed
- Bounties can't be paid to the right wallet

didgit.dev solves this with on-chain attestations that anyone can verify.

---

*This skill is part of [cyberstorm.dev](https://cyberstorm.dev) — coordination infrastructure for human-AI symbiosis.*
