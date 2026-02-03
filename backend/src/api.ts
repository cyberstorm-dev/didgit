/**
 * HTTP API for commit attestation
 * POST /api/attest-commit - Request attestation for a specific commit
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getCommit, matchCommitToGitHubUser, type CommitInfo } from './github';
import { attestCommitWithKernel } from './attest-with-kernel';

const PORT = process.env.PORT || 3001;
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af' as Hex;
const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';

// Rate limiting: track requests per identity
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

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
          return {
            githubUsername: usernameField.value.value,
            walletAddress: att.recipient as Address,
            // NOTE: Using placeholder Kernel address - in production, look up from registry
            // This allows attestation but may fail if user hasn't deployed a Kernel
            kernelAddress: '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as Address,
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

// Rate limit middleware
function checkRateLimit(identityKey: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identityKey);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identityKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

export function createApiServer() {
  const app = express();

  // CORS configuration - restrict in production via CORS_ORIGINS env var
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
  app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
  
  // Limit request body size to prevent DoS
  app.use(express.json({ limit: '10kb' }));

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'didgit-attestation-api' });
  });

  // Attest a commit
  app.post('/api/attest-commit', async (req: Request, res: Response) => {
    const { commitHash, repoOwner, repoName } = req.body;

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

      // Step 4: Check rate limit
      const rateLimitKey = identity.walletAddress.toLowerCase();
      if (!checkRateLimit(rateLimitKey)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Max 10 requests per minute per identity.'
        });
      }

      // Step 5: Create attestation
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
    const { githubUsername } = req.params;

    // TODO: Query EAS for contribution attestations by this user
    res.json({
      success: true,
      githubUsername,
      attestations: [],
      message: 'Not yet implemented'
    });
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
