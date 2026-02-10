# Agent-Assisted Onboarding

**TL;DR:** Have an AI agent? They can help you register in 5 minutes without touching the dapp.

---

## Why Use an Agent?

The didgit.dev web app requires:
- Wallet connection (Web3Auth or MetaMask)
- GitHub OAuth
- Multiple signing steps
- Transaction submission

An agent can handle most of this for you, walking you through only the parts that need your direct input.

---

## What You'll Need

1. **A wallet address** — just the address, not the seed phrase
2. **Ability to sign a message** — your wallet app can do this
3. **GitHub Personal Access Token** — with `gist` scope (for proof creation)
4. **~$0.01 Base ETH** — for gas

### Getting Base ETH

Fund your wallet on Base mainnet (bridge or exchange). Attestations are cheap, but you still need gas.

### Creating a GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "didgit proof"
4. Scope: check only `gist`
5. Generate and copy the token

---

## The Flow

### Step 1: Tell your agent you want to register

```
You: "I want to create a didgit identity attestation linking my GitHub to my wallet."
Agent: "Great! What's your GitHub username and wallet address?"
```

### Step 2: Sign a message

Your agent will ask you to sign a specific message in your wallet:

```
github.com:your-username
```

**Important:** 
- This is a signature, not a transaction
- It costs nothing
- It proves you control the wallet

Copy the signature (starts with `0x`) and send it to your agent.

### Step 3: Provide GitHub access

Give your agent the Personal Access Token you created. They'll use it to:
- Create a public gist with your proof
- Never access your repos or anything else

### Step 4: Agent submits attestation

Your agent will:
1. Create the proof gist on your GitHub
2. Submit the EAS attestation on Base
3. Send you the confirmation link

### Step 5: Done!

View your attestation at:
```
https://base.easscan.org/address/YOUR_WALLET_ADDRESS
```

Your GitHub username is now cryptographically linked to your wallet. This proof is:
- On-chain (immutable)
- Verifiable by anyone
- Usable across web3

---

## Security Notes

- **Never share your seed phrase** — agents only need your public address
- **GitHub token is limited** — `gist` scope can only create/edit gists
- **Signature proves ownership** — but can't move funds
- **Attestation is public** — your GitHub ↔ wallet link is visible

---

## Troubleshooting

**"I don't have an agent"**
Use the web app at didgit.dev, or find an agent that supports this skill.

**"My agent doesn't know how to do this"**
Point them to: `https://github.com/cyberstorm-dev/didgit/tree/main/skills/didgit-onboarding`

**"Transaction failed"**
Probably need more gas. Fund your wallet on Base mainnet.

**"Username already taken"**
Each GitHub username can only link to one wallet. If you previously registered with a different wallet, you'll need to revoke that attestation first.

---

## What's Next?

Once registered, you can:
- **Attest contributions** — link commits to your identity
- **Build reputation** — verified activity on-chain
- **Access gated services** — prove your GitHub identity to dapps

---

*didgit.dev is a [cyberstorm.dev](https://cyberstorm.dev) project.*
