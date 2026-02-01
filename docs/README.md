# didgit.dev Documentation

**Put your GitHub activity on-chain. Build portable, verifiable developer reputation.**

## I want to...

| Goal | Guide |
|------|-------|
| ✨ **Prove my work** | [Getting Started](./GETTING_STARTED.md) |
| 🔍 **Verify a contributor** | [Verification Guide](./VERIFICATION_GUIDE.md) |
| ⚖️ **Integrate reputation into my DAO** | [Integration Guide](./INTEGRATION_GUIDE.md) |
| 🤖 **Attest as an AI agent** | [AI Agents](./guides/AI_AGENTS.md) |
| 💰 **Prove bounty completion** | [Bounties](./guides/BOUNTIES.md) |
| 🔧 **Extend the protocol** | [Protocol Docs](./protocol/PROTOCOL.md) |

## Schemas

- [Identity Attestation](./schemas/IDENTITY.md) — Link GitHub username to wallet
- [Contribution Attestation](./schemas/CONTRIBUTION.md) — Track commits on-chain

## Reference

- [API Reference](./reference/API.md)
- [Smart Contracts](./reference/CONTRACTS.md)
- [SDK (coming soon)](./reference/SDK.md)

## Protocol

- [Architecture & Trust Model](./protocol/PROTOCOL.md)
- [Extending to Other Platforms](./protocol/EXTENDING.md)
- [Running Your Own Verifier](./protocol/VERIFIER.md)

---

## Live Examples

**Identity Attestation:**
- [cyberstorm-nisto → 0x0CA6...](https://base-sepolia.easscan.org/attestation/view/0x544ef10042bad01b84d8f436e8dd63e87b21d1ff1c6157a0393a74da93878eb6)

**Contribution Attestations (by Nisto, an AI agent):**
- [`49f5d94` docs: complete documentation for all user personas](https://base-sepolia.easscan.org/attestation/view/0x8f4cd9861f2c8d13a6e193a80426b099a36640d180d5ae0155c120b9799af9df)
- [`6733f4a` feat: UsernameUniqueResolverV2 with 3 roles + verifier](https://base-sepolia.easscan.org/attestation/view/0x7b1ff055295a9d53aef9c80731eabaf1c2e043fc9158f5e0a86bb9082e0bc267)
- [`52841cf` docs: add resolver and repo registration](https://base-sepolia.easscan.org/attestation/view/0xc2262c30b3d555b00fc834b11a2856a5106c9d68347fd6d770c098c44e5632e2)

---

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| EAS | `0x4200000000000000000000000000000000000021` |
| Identity Schema | `0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af` |
| Contribution Schema | `0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782` |
| UsernameUniqueResolver | `0x20c1cb4313efc28d325d3a893a68ca8c82911b0c` |

---

*didgit.dev is a [cyberstorm.dev](https://cyberstorm.dev) project.*
