/**
 * HTTP API for commit attestation
 * POST /api/attest-commit - Request attestation for a specific commit
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createPublicClient, http, verifyMessage, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getCommit, matchCommitToGitHubUser, type CommitInfo } from './github';
import { attestCommitWithKernel } from './attest-with-kernel';
import { KernelRegistry } from './kernel-registry';

const PORT = process.env.PORT || 3001;
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af' as Hex;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';

// Singleton kernel registry instance
const kernelRegistry = new KernelRegistry();

// Rate limiting: multi-window tracking per identity
interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitRecord {
  minute: RateLimitWindow;
  hour: RateLimitWindow;
  day: RateLimitWindow;
}

const LIMITS = {
  minute: { window: 60 * 1000, max: 10 },
  hour: { window: 60 * 60 * 1000, max: 100 },
  day: { window: 24 * 60 * 60 * 1000, max: 500 }
} as const;

type LimitPeriod = keyof typeof LIMITS;

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired rate limit entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap) {
    // Remove if all windows have expired
    if (now > record.minute.resetAt && now > record.hour.resetAt && now > record.day.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, LIMITS.minute.window);

interface RegisteredIdentity {
  githubUsername: string;
  walletAddress: Address;
  kernelAddress: Address;
  identityAttestationUid: Hex;
}

interface EASAttestation {
  id: string;
  recipient: string;
  decodedDataJson: string;
}

interface DecodedField {
  name: string;
  value: { value: string };
}

// GitHub username/org name validation: alphanumeric, hyphens, max 39 chars
const GITHUB_NAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

// Repository name validation: alphanumeric, hyphens, underscores, dots
const REPO_NAME_REGEX = /^[a-zA-Z0-9._-]{1,100}$/;

// Look up identity by GitHub username
async function getIdentityByUsername(username: string): Promise<RegisteredIdentity | null> {
  const query = `
    query GetIdentity($schemaId: String!, $username: String!) {
      attestations(
        where: { 
          schemaId: { equals: $schemaId }, 
          revoked: { equals: false },
          decodedDataJson: { contains: $username }
        }
        orderBy: { time: desc }
        take: 1
      ) {
        id
        recipient
        decodedDataJson
      }
    }
  `;

  try {
    const res = await fetch(EAS_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query, 
        variables: { schemaId: IDENTITY_SCHEMA_UID, username: username.toLowerCase() } 
      })
    });

    const data = await res.json() as { data?: { attestations?: EASAttestation[] } };
    const attestations = data?.data?.attestations ?? [];

    for (const att of attestations) {
      try {
        const decoded: DecodedField[] = JSON.parse(att.decodedDataJson);
        const usernameField = decoded.find((d) => d.name === 'username');
        if (usernameField?.value?.value?.toLowerCase() === username.toLowerCase()) {
          const walletAddress = att.recipient as Address;
          
          // Look up Kernel address from registry
          const kernelAddress = await kernelRegistry.getKernelForEOA(walletAddress);
          if (!kernelAddress) {
            console.warn(`[api] No Kernel found for EOA ${walletAddress} (user: ${username})`);
            return null;
          }
          
          return {
            githubUsername: usernameField.value.value,
            walletAddress,
            kernelAddress,
            identityAttestationUid: att.id as Hex
          };
        }
      } catch (parseErr) {
        console.debug(`[api] Failed to parse attestation ${att.id}:`, parseErr);
      }
    }

    return null;
  } catch (e) {
    console.error('[api] Error looking up identity:', e);
    return null;
  }
}

// Rate limit check with multi-window support
interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
}

function checkRateLimit(identityKey: string): RateLimitResult {
  const now = Date.now();
  let record = rateLimitMap.get(identityKey);

  if (!record) {
    record = {
      minute: { count: 0, resetAt: now + LIMITS.minute.window },
      hour: { count: 0, resetAt: now + LIMITS.hour.window },
      day: { count: 0, resetAt: now + LIMITS.day.window }
    };
    rateLimitMap.set(identityKey, record);
  }

  // Reset expired windows
  for (const period of Object.keys(LIMITS) as LimitPeriod[]) {
    if (now > record[period].resetAt) {
      record[period] = { count: 0, resetAt: now + LIMITS[period].window };
    }
  }

  // Check all limits
  for (const period of Object.keys(LIMITS) as LimitPeriod[]) {
    if (record[period].count >= LIMITS[period].max) {
      return {
        allowed: false,
        retryAfter: Math.ceil((record[period].resetAt - now) / 1000),
        reason: `${period} limit exceeded (${LIMITS[period].max}/${period})`
      };
    }
  }

  // Increment all counters
  record.minute.count++;
  record.hour.count++;
  record.day.count++;

  return { allowed: true };
}

// Signature verification for authenticated requests
async function verifyAttestRequest(
  req: { commitHash: string; repoOwner: string; repoName: string; signature: Hex; timestamp: number },
  identity: RegisteredIdentity
): Promise<boolean> {
  const message = `didgit:attest-commit:${req.commitHash}:${req.repoOwner}/${req.repoName}:${req.timestamp}`;
  const now = Math.floor(Date.now() / 1000);
  
  // 5 minute window
  if (Math.abs(now - req.timestamp) > 300) {
    return false;
  }

  try {
    const valid = await verifyMessage({
      address: identity.walletAddress,
      message,
      signature: req.signature
    });
    return valid;
  } catch {
    return false;
  }
}

export function createApiServer() {
  const app = express();

  // CORS configuration - MUST set CORS_ORIGINS in production
  // Default: restrictive (same-origin only) unless explicitly configured
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  if (corsOrigins && corsOrigins.length > 0) {
    app.use(cors({ origin: corsOrigins }));
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins only in development
    console.warn('[api] ⚠️ CORS_ORIGINS not set - allowing all origins (dev mode)');
    app.use(cors());
  } else {
    // Production default: same-origin only
    console.warn('[api] ⚠️ CORS_ORIGINS not set - restricting to same-origin');
    app.use(cors({ origin: false }));
  }
  
  // Limit request body size to prevent DoS
  app.use(express.json({ limit: '10kb' }));

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'didgit-attestation-api' });
  });

  // Attest a commit
  app.post('/api/attest-commit', async (req: Request, res: Response) => {
    const { commitHash, repoOwner, repoName, signature, timestamp } = req.body;

    // Validate input
    if (!commitHash || !repoOwner || !repoName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: commitHash, repoOwner, repoName'
      });
    }

    if (!/^[a-f0-9]{40}$/i.test(commitHash)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commit hash format (expected 40 hex characters)'
      });
    }

    if (!GITHUB_NAME_REGEX.test(repoOwner)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid repoOwner format (must be valid GitHub username/org)'
      });
    }

    if (!REPO_NAME_REGEX.test(repoName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid repoName format (alphanumeric, hyphens, underscores, dots only)'
      });
    }

    console.log(`[api] Attest request: ${repoOwner}/${repoName}@${commitHash.slice(0, 8)}`);

    try {
      // Step 1: Fetch commit from GitHub
      let commit: CommitInfo | null;
      try {
        commit = await getCommit(repoOwner, repoName, commitHash);
      } catch (e: any) {
        if (e.status === 404) {
          return res.status(404).json({
            success: false,
            error: `Commit not found: ${repoOwner}/${repoName}@${commitHash.slice(0, 8)}`
          });
        }
        throw e;
      }

      if (!commit) {
        return res.status(404).json({
          success: false,
          error: `Commit not found: ${repoOwner}/${repoName}@${commitHash.slice(0, 8)}`
        });
      }

      // Step 2: Extract GitHub username from commit
      const githubUsername = matchCommitToGitHubUser(commit);
      if (!githubUsername) {
        return res.status(400).json({
          success: false,
          error: 'Could not determine GitHub username from commit author'
        });
      }

      // Step 3: Look up registered identity
      const identity = await getIdentityByUsername(githubUsername);
      if (!identity) {
        return res.status(403).json({
          success: false,
          error: `User "${githubUsername}" does not have a registered identity on didgit.dev`
        });
      }

      // Step 4: Mandatory signature verification
      if (!signature || !timestamp) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required: signature and timestamp must be provided'
        });
      }

      if (typeof timestamp !== 'number' || !Number.isInteger(timestamp)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timestamp format (must be integer Unix timestamp)'
        });
      }

      const authValid = await verifyAttestRequest({
        commitHash,
        repoOwner,
        repoName,
        signature: signature as Hex,
        timestamp: timestamp
      }, identity);

      if (!authValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature or expired timestamp'
        });
      }

      // Step 5: Check rate limit
      const rateLimitKey = identity.walletAddress.toLowerCase();
      const rateCheck = checkRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return res.status(429)
          .header('Retry-After', String(rateCheck.retryAfter))
          .json({
            success: false,
            error: `Rate limit exceeded: ${rateCheck.reason}`,
            retryAfter: rateCheck.retryAfter
          });
      }

      // Step 6: Create attestation
      console.log(`[api] Attesting commit by ${githubUsername}...`);
      
      const result = await attestCommitWithKernel({
        user: {
          kernelAddress: identity.kernelAddress,
          userEOA: identity.walletAddress
        },
        identityAttestationUid: identity.identityAttestationUid,
        commitHash: commit.sha,
        repoOwner,
        repoName,
        author: githubUsername,
        message: commit.message
      });

      if (result.success) {
        console.log(`[api] ✓ Attested: ${result.attestationUid}`);
        return res.json({
          success: true,
          attestationUid: result.attestationUid,
          txHash: result.txHash,
          commit: {
            sha: commit.sha,
            author: githubUsername,
            message: commit.message.slice(0, 100)
          }
        });
      } else {
        console.error(`[api] ✗ Failed: ${result.error}`);
        return res.status(500).json({
          success: false,
          error: result.error || 'Attestation failed'
        });
      }

    } catch (e: any) {
      console.error('[api] Error:', e);
      return res.status(500).json({
        success: false,
        error: e.message || 'Internal server error'
      });
    }
  });

  // Get attestations for a user
  app.get('/api/attestations/:githubUsername', async (req: Request, res: Response) => {
    const githubUsername = req.params.githubUsername as string;
    const limitParam = (req.query.limit as string) || '50';
    const offsetParam = (req.query.offset as string) || '0';

    // Validate GitHub username format
    if (!githubUsername || !GITHUB_NAME_REGEX.test(githubUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username format'
      });
    }

    const parsedLimit = Math.min(parseInt(limitParam, 10) || 50, 100);
    const parsedOffset = parseInt(offsetParam, 10) || 0;

    try {
      const identity = await getIdentityByUsername(githubUsername);
      if (!identity) {
        return res.status(404).json({
          success: false,
          error: `No registered identity for "${githubUsername}"`
        });
      }

      const query = `
        query GetContributions($schemaId: String!, $recipient: String!, $take: Int!, $skip: Int!) {
          attestations(
            where: {
              schemaId: { equals: $schemaId },
              recipient: { equals: $recipient },
              revoked: { equals: false }
            }
            orderBy: { time: desc }
            take: $take
            skip: $skip
          ) {
            id
            time
            txid
            decodedDataJson
          }
        }
      `;

      const easRes = await fetch(EAS_GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: {
            schemaId: CONTRIBUTION_SCHEMA_UID,
            recipient: identity.walletAddress,
            take: parsedLimit,
            skip: parsedOffset
          }
        })
      });

      interface ContributionAttestation {
        id: string;
        time: number;
        txid: string;
        decodedDataJson: string;
      }

      const data = await easRes.json() as { data?: { attestations?: ContributionAttestation[] } };
      const attestations = data?.data?.attestations ?? [];

      const formatted = attestations.map((att) => {
        try {
          const decoded: DecodedField[] = JSON.parse(att.decodedDataJson);
          return {
            id: att.id,
            timestamp: att.time,
            txHash: att.txid,
            repo: decoded.find((d) => d.name === 'repo')?.value?.value,
            commitHash: decoded.find((d) => d.name === 'commitHash')?.value?.value,
            author: decoded.find((d) => d.name === 'author')?.value?.value,
            message: decoded.find((d) => d.name === 'message')?.value?.value
          };
        } catch {
          return { id: att.id, timestamp: att.time, txHash: att.txid };
        }
      });

      return res.json({
        success: true,
        githubUsername,
        wallet: identity.walletAddress,
        attestations: formatted,
        pagination: { limit: parsedLimit, offset: parsedOffset }
      });

    } catch (e: any) {
      console.error('[api] Error fetching attestations:', e);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch attestations'
      });
    }
  });

  return app;
}

export function startApiServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = createApiServer();
    app.listen(PORT, () => {
      console.log(`[api] HTTP API listening on port ${PORT}`);
      resolve();
    });
  });
}
