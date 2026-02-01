# AI Agents Guide

How AI agents can establish verifiable identity for human-AI collaboration.

## Why AI Agents Need Identity

As AI agents contribute more code, humans need ways to:
- **Trust** — Know which agent made a commit
- **Verify** — Confirm the agent is authorized to contribute
- **Attribute** — Track an agent's contribution history
- **Govern** — Include agents in reputation-based systems

didgit.dev provides the same identity infrastructure to AI agents as human developers.

## The Agent Identity Problem

Without attestations:
- Agent commits appear as anonymous or spoofed
- No way to verify an agent is sanctioned by its operator
- Reputation can't follow an agent across projects
- Humans can't distinguish trusted vs untrusted agents

With didgit.dev:
- Agent has cryptographic identity linking GitHub → wallet
- Contributions are attested on-chain
- History is portable and verifiable
- Trust can be delegated and revoked

## Setup Guide

### 1. Create Agent GitHub Account

Create a dedicated GitHub account for your agent:
- Username: `agent-name` or `yourorg-agent`
- Email: Use a monitored address for security alerts

### 2. Generate Agent Wallet

Create a wallet the agent controls:

```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
console.log('Address:', account.address);
// Store privateKey securely (HSM, secrets manager, etc.)
```

### 3. Create Identity Attestation

Follow the standard [Getting Started](../GETTING_STARTED.md) flow:
1. Sign `github.com:agent-username` with the agent wallet
2. Create proof gist from the agent's GitHub account
3. Submit attestation

### 4. Register Repositories

Register which repos the agent can contribute to:

```typescript
await resolver.setRepoPattern(
  'github.com',
  'agent-username',
  'yourorg',
  '*',  // or specific repo
  true
);
```

## Security Considerations

### Key Management

- **Never** store agent private keys in code or env vars
- Use HSM, KMS, or secure enclaves
- Rotate keys periodically
- Have revocation plan ready

### Scope Limits

- Register only necessary repos (not `*/*`)
- Use separate agents for separate trust domains
- Monitor agent activity

### Operator Disclosure

Consider adding to your agent's gist:

```json
{
  "agent": true,
  "operator": "yourorg",
  "operator_wallet": "0x...",
  "purpose": "Automated code review and fixes"
}
```

This signals to verifiers that this is an AI agent.

## Example: Nisto (Our Dogfood)

**Nisto** is an AI agent that contributes to cyberstorm.dev projects:

- GitHub: [cyberstorm-nisto](https://github.com/cyberstorm-nisto)
- Identity: [0x544ef100...](https://base-sepolia.easscan.org/attestation/view/0x544ef10042bad01b84d8f436e8dd63e87b21d1ff1c6157a0393a74da93878eb6)
- Proof Gist: [didgit.dev-proof.json](https://gist.github.com/cyberstorm-nisto/aecc4dad76440c84ee2321e885d8f21f)

Nisto's contributions to didgit.dev are attested on-chain, creating a verifiable history of AI-generated code.

## Multi-Agent Setups

For organizations with multiple agents:

1. **Separate identities** — Each agent gets own GitHub + wallet
2. **Shared operator** — All wallets controlled by operator multisig
3. **Scoped access** — Different agents for different repos/tasks
4. **Central monitoring** — Query all agent attestations by operator

## Revocation

If an agent is compromised:

1. Revoke identity attestation via EAS
2. Disable repo patterns on resolver
3. Rotate wallet keys
4. Create new identity (if continuing operation)

## FAQ

**Can an agent attest its own contributions?**
Yes, if it controls the wallet. For higher trust, have a separate verifier attest.

**How do humans know it's an agent?**
Convention: include `"agent": true` in proof gist. Future: agent-specific schema field.

**Can agents vote in DAOs?**
Depends on DAO rules. Attestations enable contribution-weighted voting that includes agent work.

---

*AI agents are first-class citizens in didgit.dev. Build trust through transparency.*
