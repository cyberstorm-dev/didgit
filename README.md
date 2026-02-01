# didgit.dev

**Put your GitHub activity on-chain. Build portable, verifiable developer reputation.**

[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)](https://base-sepolia.easscan.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## What is didgit.dev?

didgit.dev creates cryptographic proof linking your GitHub identity to your wallet, then attests your contributions on-chain via [EAS](https://attest.sh/). Your reputation becomes portable, verifiable, and yours.

**No more "trust me, I contributed."** Just proof.

---

## I want to...

| Goal | Start Here |
|------|------------|
| ✨ **Prove my work** | [Getting Started →](./docs/GETTING_STARTED.md) |
| 🔍 **Verify a contributor** | [Verification Guide →](./docs/VERIFICATION_GUIDE.md) |
| ⚖️ **Integrate into my DAO** | [Integration Guide →](./docs/INTEGRATION_GUIDE.md) |
| 🤖 **Attest as an AI agent** | [AI Agents →](./docs/guides/AI_AGENTS.md) |
| 💰 **Prove bounty completion** | [Bounties →](./docs/guides/BOUNTIES.md) |
| 🔧 **Extend the protocol** | [Protocol Docs →](./docs/protocol/PROTOCOL.md) |

---

## Live Examples

**Identity Attestation:**
- [cyberstorm-nisto → 0x0CA6...](https://base-sepolia.easscan.org/attestation/view/0x544ef10042bad01b84d8f436e8dd63e87b21d1ff1c6157a0393a74da93878eb6)

**Contribution Attestations (by Nisto, an AI agent):**
- [`49f5d94` docs: complete documentation](https://base-sepolia.easscan.org/attestation/view/0x8f4cd9861f2c8d13a6e193a80426b099a36640d180d5ae0155c120b9799af9df)
- [`6733f4a` feat: ResolverV2 with verifier](https://base-sepolia.easscan.org/attestation/view/0x7b1ff055295a9d53aef9c80731eabaf1c2e043fc9158f5e0a86bb9082e0bc267)

---

## How It Works

```
1. Connect wallet + GitHub
2. Sign "github.com:username" with your wallet
3. Create public proof gist
4. Submit on-chain attestation
5. Register repos → contributions tracked automatically
```

Each commit to registered repos gets attested on-chain, building your verifiable history.

---

## Quick Links

- **App:** [didgit.dev](https://didgit.dev) *(coming soon)*
- **Docs:** [docs/](./docs/)
- **Explorer:** [base-sepolia.easscan.org](https://base-sepolia.easscan.org/)

---

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| EAS | `0x4200000000000000000000000000000000000021` |
| UsernameUniqueResolver | `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c` |
| Identity Schema | `0x6ba0509...` |
| Contribution Schema | `0x7425c71...` |

---

## Contributing

We're looking for help with:
- [GitLab support](https://github.com/cyberstorm-dev/didgit/issues/3)
- [Codeberg support](https://github.com/cyberstorm-dev/didgit/issues/4)

See [EXTENDING.md](./docs/protocol/EXTENDING.md) for implementation guide.

---

## License

MIT

---

*didgit.dev is a [cyberstorm.dev](https://cyberstorm.dev) project.*
