# Running Your Own Verifier

How to deploy and operate a didgit.dev verifier for your organization.

## Why Run Your Own?

- **Control** — You decide what gets verified
- **Privacy** — Verification happens on your infrastructure
- **Customization** — Add custom validation rules
- **Independence** — No reliance on cyberstorm-dev

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Verifier   │───▶│    Signer    │───▶│   Your App   │  │
│  │   Service    │    │   (HSM/KMS)  │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                       │           │
│         ▼                                       ▼           │
│  ┌──────────────┐                      ┌──────────────┐    │
│  │   Platform   │                      │   Resolver   │    │
│  │    APIs      │                      │   Contract   │    │
│  └──────────────┘                      └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup Guide

### Step 1: Deploy Resolver Contract

Deploy your own `UsernameUniqueResolver` instance:

```bash
# Clone the repo
git clone https://github.com/cyberstorm-dev/didgit
cd didgit/src/main/solidity

# Deploy (using Foundry)
forge create src/UsernameUniqueResolver.sol:UsernameUniqueResolver \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_KEY
```

### Step 2: Configure Verifier

Set your verifier address:

```typescript
// After deployment
const resolver = new UsernameUniqueResolver(resolverAddress);
await resolver.setVerifier(verifierAddress);
```

### Step 3: Run Verifier Service

```typescript
import express from 'express';
import { verifyGistProof, signApproval } from './verifier';

const app = express();

app.post('/verify', async (req, res) => {
  const { domain, username, wallet, gistUrl } = req.body;
  
  // 1. Fetch and validate gist
  const proof = await fetchProof(gistUrl);
  
  // 2. Verify signature in proof
  const sigValid = await verifySignature(
    proof.message,
    proof.signature,
    wallet
  );
  if (!sigValid) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  // 3. Verify gist ownership
  const ownerValid = await verifyGistOwnership(gistUrl, username);
  if (!ownerValid) {
    return res.status(400).json({ error: 'Gist owner mismatch' });
  }
  
  // 4. Sign approval
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const approval = await signApproval(
    domain, username, wallet, gistUrl, expiry
  );
  
  res.json({ approval, expiry });
});

app.listen(3000);
```

### Step 4: Secure the Signing Key

**Never** store the verifier private key in code or env vars.

Options:
- **AWS KMS** — Key never leaves HSM
- **HashiCorp Vault** — Centralized secrets management
- **Hardware HSM** — Air-gapped signing

Example with AWS KMS:

```typescript
import { KMSClient, SignCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

async function signApproval(message: Buffer): Promise<Buffer> {
  const command = new SignCommand({
    KeyId: 'alias/didgit-verifier',
    Message: message,
    MessageType: 'RAW',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });
  
  const response = await kms.send(command);
  return Buffer.from(response.Signature!);
}
```

## Configuration

### Environment Variables

```bash
# Required
VERIFIER_KEY_ID=alias/didgit-verifier  # KMS key alias
RESOLVER_ADDRESS=0x...                  # Your resolver contract
RPC_URL=https://...                     # Base RPC endpoint

# Optional
RATE_LIMIT=100                          # Requests per minute
LOG_LEVEL=info
ALLOWED_DOMAINS=github.com,gitlab.com   # Restrict platforms
```

### Custom Validation Rules

Add organization-specific rules:

```typescript
interface ValidationRule {
  name: string;
  validate: (proof: ProofData) => Promise<boolean>;
}

const rules: ValidationRule[] = [
  {
    name: 'org-membership',
    validate: async (proof) => {
      // Only allow org members
      const isMember = await checkOrgMembership(proof.username, 'myorg');
      return isMember;
    }
  },
  {
    name: 'account-age',
    validate: async (proof) => {
      // Require 30+ day old accounts
      const created = await getAccountCreated(proof.username);
      const age = Date.now() - created.getTime();
      return age > 30 * 24 * 60 * 60 * 1000;
    }
  }
];
```

## Monitoring

### Health Check

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    kms: await checkKmsConnection(),
    rpc: await checkRpcConnection(),
    github: await checkGithubApi()
  };
  
  const healthy = Object.values(checks).every(v => v);
  res.status(healthy ? 200 : 503).json(checks);
});
```

### Metrics

Track:
- Verification requests per minute
- Success/failure rate
- Latency (p50, p95, p99)
- Error types

### Alerts

Set up alerts for:
- Signing failures (key issues)
- High error rate (API problems)
- Unusual volume (potential abuse)

## Security Checklist

- [ ] Verifier key in HSM/KMS (not in code/env)
- [ ] HTTPS only (no plaintext)
- [ ] Rate limiting enabled
- [ ] Input validation on all fields
- [ ] Logging without sensitive data
- [ ] Key rotation plan documented
- [ ] Incident response plan ready

## Upgrading

When updating the verifier:

1. Deploy new version alongside old
2. Test with synthetic traffic
3. Switch DNS/load balancer
4. Monitor for errors
5. Decommission old version

For contract upgrades:
- Deploy new resolver
- Migrate users (they re-attest)
- Or use upgradeable proxy pattern

## Troubleshooting

### "Invalid signature" errors

- Check wallet address matches signer
- Verify message format: `{domain}:{username}`
- Check for lowercase normalization

### KMS signing failures

- Verify IAM permissions
- Check key policy allows signing
- Confirm key is enabled

### Gist verification failures

- Check GitHub API rate limits
- Verify OAuth scopes
- Handle private gists gracefully

---

*Need help? Open an issue or reach out on Discord.*
