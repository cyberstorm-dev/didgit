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
- Contributions are attested on-chain (agent owns them)
- History is portable and verifiable
- Trust can be delegated and revoked

## Quick Start: Agent Registration

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

Create a Repo Globs attestation to specify which repos to track:

```
Pattern: "yourorg/*" or "yourorg/specific-repo"
```

This is referenced to your identity attestation.

### 5. Set Up Session Key (for automatic attestations)

This is the key step that enables automatic commit attestations without agent involvement:

```bash
cd didgit/backend

# One-time setup (requires agent's private key)
USER_PRIVKEY=0x<agent-wallet-key> \
ATTESTER_PRIVKEY=0x<attester-key> \
BUNDLER_RPC=<zerodev-bundler-url> \
npm run setup-session-key
```

This:
1. Deploys a Kernel smart account for the agent (if needed)
2. Grants the attester permission to call EAS.attest() on behalf of the agent
3. Serializes the permission for runtime use

**After setup, the agent's private key is never needed again.** The attester can attest commits automatically, but the attestations are owned by the agent's Kernel.

### 6. Fund the Kernel

The agent's Kernel pays gas for attestations:

```bash
# Send ETH to the Kernel address (shown in setup output)
cast send 0x<KERNEL_ADDRESS> --value 0.01ether --rpc-url https://mainnet.base.org
```

0.01 ETH covers ~1000+ attestations on Base.

## How Automatic Attestations Work

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Agent commits code                                            │
│         │                                                        │
│         ▼                                                        │
│   Backend detects commit (via GitHub API)                       │
│         │                                                        │
│         ▼                                                        │
│   Backend deserializes agent's permission account               │
│         │                                                        │
│         ▼                                                        │
│   Attester signs UserOp (scoped to EAS.attest only)            │
│         │                                                        │
│         ▼                                                        │
│   Agent's Kernel executes attestation                           │
│         │                                                        │
│         ├─▶ Gas paid from Kernel balance                        │
│         └─▶ Attestation owned by agent's Kernel address         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key properties:**
- Agent doesn't sign anything at runtime
- Agent owns all attestations
- Agent can revoke the attester's permission anytime
- Attester can only call EAS.attest() — no other actions possible

## Security Considerations

### Key Management

- **Never** store agent private keys in code or env vars
- Use HSM, KMS, or secure enclaves
- After session key setup, the agent's private key can be cold-stored
- Have revocation plan ready

### Scope Limits

- Register only necessary repos (not `*/*`)
- Use separate agents for separate trust domains
- Monitor agent activity

### Session Key Security

The session key permission is narrowly scoped:
- Only allows `EAS.attest()` calls
- Only to the specific EAS contract
- Zero value (no ETH transfers)

If the attester key is compromised:
1. Revoke the permission from your Kernel
2. Rotate attester keys
3. Re-run setup with new attester

### Operator Disclosure

Consider adding to your agent's proof gist:

```json
{
  "agent": true,
  "operator": "yourorg",
  "operator_wallet": "0x...",
  "purpose": "Automated code review and fixes"
}
```

This signals to attesters that this is an AI agent.

## Example: Nisto

**Nisto** is an AI agent contributing to cyberstorm.dev projects.

| Field | Value |
|-------|-------|
| GitHub | [cyberstorm-nisto](https://github.com/cyberstorm-nisto) |
| EOA | `0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd` |
| Kernel | `0x2Ce0cE887De4D0043324C76472f386dC5d454e96` |
| Repo Globs | `cyberstorm-dev/*`, `cyberstorm-nisto/*` |

**Identity Attestation:**
- [View on EASScan](https://base.easscan.org/)

**Recent Contributions (attested via session key):**
- Commits automatically attested as Nisto pushes code
- Attestations owned by Nisto's Kernel (`0x2Ce0...`)
- Gas paid from Nisto's Kernel balance

## Multi-Agent Setups

For organizations with multiple agents:

1. **Separate identities** — Each agent gets own GitHub + Kernel
2. **Shared attester** — One attester backend for all agents
3. **Per-agent permissions** — Each `.permission-account.json` is agent-specific
4. **Central monitoring** — Query all agent attestations by Kernel addresses

## Revoking Access

If an agent is compromised or retired:

### 1. Revoke Session Key Permission
The agent's Kernel owner can remove the attester's permission:

```typescript
// Call from agent's EOA
await kernel.uninstallPlugin(permissionValidatorAddress);
```

### 2. Revoke Identity Attestation
Via EAS directly:

```typescript
await eas.revoke({
  schema: IDENTITY_SCHEMA_UID,
  data: { uid: identityAttestationUid }
});
```

### 3. Clear Repo Globs
Revoke the repo globs attestation to stop commit tracking.

## FAQ

**Can an agent attest its own contributions directly?**
Yes, if it holds its private key at runtime. Session keys just enable automatic attestation without key exposure.

**How do humans know it's an agent?**
Convention: include `"agent": true` in proof gist. Future: dedicated schema field.

**Can agents vote in DAOs based on contributions?**
Yes! Contribution attestations enable proof-of-work governance. The attestations are owned by the agent, so they can be used for any on-chain verification.

**What if the Kernel runs out of ETH?**
Attestations fail until funded. Set up monitoring on Kernel balance.

---

*AI agents are first-class citizens in didgit.dev. Build trust through verifiable contribution history.*
