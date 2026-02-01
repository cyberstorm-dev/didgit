# Getting Started with didgit.dev

Put your GitHub activity on-chain. Build portable, verifiable developer reputation.

## What You'll Get

1. **Identity Attestation** — cryptographic proof linking your GitHub username to your wallet
2. **Contribution Attestations** — on-chain records of your commits, PRs, and activity
3. **Portable Reputation** — take your verified history anywhere in web3

## Prerequisites

- A GitHub account
- A wallet (we'll create one for you if needed via Web3Auth)
- ~5 minutes

---

## Step 1: Connect Your Wallet

Go to [didgit.dev](https://didgit.dev) and click **Connect Wallet**.

We use [Web3Auth](https://web3auth.io/) for seamless onboarding:
- Sign in with Google, GitHub, or email
- A smart wallet is created automatically (no seed phrase needed)
- Works on Base (low fees, fast transactions)

Already have a wallet? Connect with MetaMask, WalletConnect, or any EIP-1193 provider.

## Step 2: Connect GitHub

Click **Connect GitHub** and authorize the didgit.dev app.

We request minimal permissions:
- `read:user` — verify your username
- `gist` — create your proof gist (public, you control it)

We never access your private repos or commit on your behalf.

## Step 3: Sign Your Identity

Your wallet will prompt you to sign a message:

```
github.com:your-username
```

This signature proves you control both:
- The GitHub account (via OAuth)
- The wallet (via cryptographic signature)

No transaction, no gas — just a signature.

## Step 4: Create Your Proof Gist

Click **Create Proof Gist**. This creates a public gist on your GitHub containing:

```json
{
  "domain": "github.com",
  "username": "your-username",
  "wallet": "0xYourWalletAddress",
  "message": "github.com:your-username",
  "signature": "0x...",
  "chain_id": 8453,
  "schema_uid": "0x6ba0509..."
}
```

This gist serves as:
- Public proof anyone can verify
- Backup if EAS is unavailable
- Your claim to this identity

## Step 5: Submit Attestation

Click **Submit Attestation**. This creates an on-chain record via [EAS](https://attest.sh/) (Ethereum Attestation Service) on Base.

The attestation includes:
- Your GitHub username
- Your wallet address
- Your signature
- Link to your proof gist

**Cost:** ~$0.01-0.05 in ETH (gas fees on Base are low)

## Step 6: Register Your Repositories

After your identity is attested, register which repos should be tracked.

Options:
- `*/*` — all your public repos (recommended to start)
- `your-org/*` — all repos in a specific org
- `your-org/specific-repo` — just one repo

Only registered repos will have commits attested. This prevents accidental exposure of private work.

## Step 7: Start Building Reputation

That's it! As you commit to registered repos, your contributions are attested on-chain.

Each contribution attestation includes:
- Repository name
- Commit hash
- Commit message
- Timestamp
- Link to your identity attestation

View your attestations at [base.easscan.org](https://base.easscan.org/).

---

## What's Next?

### For Developers
- Keep committing — your reputation grows automatically
- Add more repos as you contribute to new projects
- Share your attestation profile with potential collaborators

### For Projects
- Verify contributor history before granting access
- Build trust with on-chain proof of work
- Create bounties with verifiable completion criteria

### For DAOs
- Gate roles by contribution history
- Weight votes by verified activity
- Build meritocratic governance

---

## FAQ

**Is my code stored on-chain?**
No. Only metadata (repo name, commit hash, message) is attested. Your code stays on GitHub.

**What about private repos?**
Only repos you explicitly register are tracked. Private repos are never exposed.

**Can I revoke my attestations?**
Yes. EAS supports revocation. You can revoke any attestation you created.

**What chain is this on?**
Base (Coinbase L2). Low fees, high speed, Ethereum security.

**Is this decentralized?**
The attestations are fully on-chain via EAS. The verification service is currently centralized but can be decentralized via multi-verifier schemes.

---

## Need Help?

- [GitHub Issues](https://github.com/cyberstorm-dev/didgit/issues)
- [Discord](https://discord.gg/cyberstorm)
- [Twitter](https://twitter.com/didgit_dev)

---

*didgit.dev is a [cyberstorm.dev](https://cyberstorm.dev) project.*
