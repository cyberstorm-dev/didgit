import { createPublicClient, http, type Address, type Hex, parseAbi } from 'viem';
import { toAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { getRecentCommits, getRecentOwnerPushCommits, matchCommitToGitHubUser, listOrgRepos, listUserRepos, type CommitInfo } from './github';
import { attestCommitWithSession, type SessionConfig } from './attest-with-session';
import { getConfig } from './config';
import { getAttesterPrivKey } from './env';
import { parseRepoGlobsDecodedJson } from './repo-globs';
import { fetchRecentAttestedCommits } from './contributions';
import { resolveRepoGlobs } from './repo-watch';

const ACTIVE = getConfig();
const RESOLVER_ADDRESS = ACTIVE.resolverAddress as Address;
const EAS_ADDRESS = ACTIVE.easAddress as Address;
const IDENTITY_SCHEMA_UID = ACTIVE.identitySchemaUid as Hex;
const CONTRIBUTION_SCHEMA_UID = ACTIVE.contributionSchemaUid as Hex;
const REPO_GLOBS_SCHEMA_UID = ACTIVE.repoGlobsSchemaUid as Hex;
const PERMISSION_SCHEMA_UID = ACTIVE.permissionSchemaUid as Hex;
const EAS_GRAPHQL = ACTIVE.easGraphql;

const resolverAbi = parseAbi([
  'function ownerOf(bytes32 identityHash) view returns (address)',
  'function attestationOf(bytes32 identityHash) view returns (bytes32)'
]);

const easAbi = parseAbi([
  'event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema)'
]);

async function computeKernelAddress(publicClient: any, userEOA: Address) {
  const entryPoint = getEntryPoint('0.7');
  const dummySigner = toAccount({
    address: userEOA,
    async signMessage() { throw new Error('signMessage not supported'); },
    async signTypedData() { throw new Error('signTypedData not supported'); },
    async signTransaction() { throw new Error('signTransaction not supported'); }
  });

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: dummySigner,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  return kernelAccount.address as Address;
}

interface RegisteredUser {
  githubUsername: string;
  walletAddress: Address;         // User's EOA
  kernelAddress: Address;         // User's Kernel smart account
  identityAttestationUid: Hex;
  repoGlobs: string[];            // e.g., ["cyberstorm-dev/*", "cyberstorm-nisto/*"]
}

interface RepoToWatch {
  owner: string;
  name: string;
}

export class AttestationService {
  private publicClient;
  private lastCheckTime: Date;
  private attestedCommits: Set<string>;
  private permissionConfigs: Map<Address, string>; // kernelAddress -> serialized permission
  private recentAttestedCache: { since: number; fetchedAt: number; commits: Set<string> } | null;

  constructor() {
    this.publicClient = createPublicClient({
      chain: ACTIVE.chain,
      transport: http(ACTIVE.rpcUrl)
    });
    this.lastCheckTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Start 24h ago
    this.attestedCommits = new Set();
    this.permissionConfigs = new Map();
    this.recentAttestedCache = null;
  }

  /**
   * Load permission accounts from EAS attestations (on-chain storage)
   */
  async loadPermissionConfigs(): Promise<void> {
    console.log('[service] Fetching session key permissions from EAS...');
    
    const query = `
      query {
        attestations(
          where: { schemaId: { equals: "${PERMISSION_SCHEMA_UID}" }, revoked: { equals: false } }
          orderBy: { timeCreated: desc }
        ) {
          id
          recipient
          decodedDataJson
          timeCreated
        }
      }
    `;

    const response = await fetch(EAS_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const result = await response.json() as any;
    const attestations = result.data?.attestations || [];

    for (const att of attestations) {
      try {
        const data = JSON.parse(att.decodedDataJson);
        // Schema (legacy field name): address userKernel, address verifier, address target, bytes4 selector, bytes serializedPermission
        const userKernel = data[0]?.value?.value?.toLowerCase() as Address;
        const attester = data[1]?.value?.value?.toLowerCase();
        const serializedHex = data[4]?.value?.value as string; // hex-encoded UTF-8
        
        if (userKernel && serializedHex) {
          // Only load permissions for our attester
          const { privateKeyToAccount } = await import('viem/accounts');
          const ourAttester = privateKeyToAccount(getAttesterPrivKey() as `0x${string}`).address.toLowerCase();
          
          if (attester === ourAttester) {
            if (this.permissionConfigs.has(userKernel)) {
              continue;
            }
            // Decode hex to UTF-8 string (the original serialized permission)
            const serialized = Buffer.from(serializedHex.slice(2), 'hex').toString('utf-8');
            this.permissionConfigs.set(userKernel, serialized);
            console.log(`[service] Loaded permission for ${userKernel} (from EAS)`);
          }
        }
      } catch (e) {
        console.error('[service] Failed to parse permission attestation:', e);
      }
    }

    console.log(`[service] Loaded ${this.permissionConfigs.size} permission config(s) from EAS`);
  }

  async getRegisteredUsers(): Promise<RegisteredUser[]> {
    console.log('[service] Fetching registered users from EAS...');
    
    // Query identity attestations
    const identityQuery = `
      query {
        attestations(where: { schemaId: { equals: "${IDENTITY_SCHEMA_UID}" }, revoked: { equals: false } }) {
          id
          recipient
          decodedDataJson
        }
      }
    `;
    
    // Query repo globs attestations
    const repoGlobsQuery = `
      query {
        attestations(where: { schemaId: { equals: "${REPO_GLOBS_SCHEMA_UID}" }, revoked: { equals: false } }) {
          id
          recipient
          refUID
          decodedDataJson
        }
      }
    `;

    try {
      const [identityRes, repoGlobsRes] = await Promise.all([
        fetch(EAS_GRAPHQL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: identityQuery })
        }),
        fetch(EAS_GRAPHQL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: repoGlobsQuery })
        })
      ]);

      const identityData = await identityRes.json() as { data?: { attestations?: any[] } };
      const repoGlobsData = await repoGlobsRes.json() as { data?: { attestations?: any[] } };

      const identities = identityData?.data?.attestations ?? [];
      const repoGlobsAtts = repoGlobsData?.data?.attestations ?? [];

      // Build map of identity UID -> repo globs
      const globsByIdentity = new Map<string, string[]>();
      for (const att of repoGlobsAtts) {
        const globs = parseRepoGlobsDecodedJson(att.decodedDataJson || '');
        if (globs.length > 0 && att.refUID) {
          globsByIdentity.set(att.refUID.toLowerCase(), globs);
        }
      }

      // Build registered users
      const users: RegisteredUser[] = [];
      const seenUsernames = new Set<string>();

      const publicClient = createPublicClient({
        chain: ACTIVE.chain,
        transport: http(ACTIVE.rpcUrl)
      });

      for (const att of identities) {
        try {
          const decoded = JSON.parse(att.decodedDataJson);
          const usernameField = decoded.find((d: any) => d.name === 'username');
          const username = usernameField?.value?.value;
          
          if (!username || seenUsernames.has(username.toLowerCase())) continue;
          seenUsernames.add(username.toLowerCase());

          const repoGlobs = globsByIdentity.get(att.id.toLowerCase()) || [];
          
          // Only include users with repo globs registered
          if (repoGlobs.length === 0) {
            console.log(`[service] Skipping ${username}: no repo globs registered`);
            continue;
          }

          const walletAddress = att.recipient as Address;
          const kernelAddress = await computeKernelAddress(publicClient, walletAddress);

          users.push({
            githubUsername: username,
            walletAddress,
            kernelAddress,
            identityAttestationUid: att.id as Hex,
            repoGlobs
          });

          console.log(`[service] Found user: ${username} with globs: ${repoGlobs.join(', ')}`);
        } catch {}
      }

      return users;
    } catch (e) {
      console.error('[service] Error fetching from EAS:', e);
      return [];
    }
  }

  async getReposToWatch(users: RegisteredUser[], skipWildcardOwners: Set<string>): Promise<RepoToWatch[]> {
    console.log('[service] Resolving repo globs...');

    const globs = users.flatMap((u) => u.repoGlobs);
    const repos = await resolveRepoGlobs({
      globs,
      skipWildcardOwners,
      listOrgRepos,
      listUserRepos
    });

    console.log(`[service] Watching ${repos.length} repos`);
    return repos;
  }

  async processWildcardOwner(owner: string, users: RegisteredUser[], since: Date, recentAttested: Set<string>): Promise<number> {
    console.log(`[service] Processing wildcard ${owner}/* via events...`);
    try {
      const commits = await getRecentOwnerPushCommits(owner, since);
      console.log(`[service] Found ${commits.length} push commits for ${owner} since ${since.toISOString()}`);
      if (commits.length > 0) {
        return await this.processCommits(commits, users, recentAttested);
      }
      if (process.env.ATTEST_FALLBACK_REPO_SCAN === '1') {
        console.log(`[service] No push events for ${owner}; falling back to repo listing (ATTEST_FALLBACK_REPO_SCAN=1)`);
        const orgRepos = await listOrgRepos(owner);
        const userRepos = orgRepos.length === 0 ? await listUserRepos(owner) : orgRepos;
        let total = 0;
        for (const repo of userRepos) {
          total += await this.processRepo(repo, users, since, recentAttested);
        }
        return total;
      }
      return 0;
    } catch (e: any) {
      if (e.status === 404) {
        console.log(`[service] No public events for ${owner}; falling back to repo listing`);
        const orgRepos = await listOrgRepos(owner);
        const userRepos = orgRepos.length === 0 ? await listUserRepos(owner) : orgRepos;
        let total = 0;
        for (const repo of userRepos) {
          total += await this.processRepo(repo, users, since, recentAttested);
        }
        return total;
      }
      throw e;
    }
  }

  async processCommits(commits: CommitInfo[], users: RegisteredUser[], recentAttested: Set<string>): Promise<number> {
    if (commits.length === 0) return 0;

    const newCommits = commits.filter(c => !recentAttested.has(c.sha) && !this.attestedCommits.has(c.sha));
    console.log(`[service] ${newCommits.length} new commits to attest`);

    let attestedCount = 0;
    for (const commit of newCommits) {
      const githubUsername = matchCommitToGitHubUser(commit);
      if (!githubUsername) {
        console.log(`[service] Skipping commit ${commit.sha.slice(0, 8)} - no GitHub username`);
        continue;
      }

      const user = users.find(u => u.githubUsername.toLowerCase() === githubUsername.toLowerCase());
      if (!user) {
        console.log(`[service] Skipping commit ${commit.sha.slice(0, 8)} by ${githubUsername} - not registered`);
        continue;
      }

      console.log(`[service] Attesting commit ${commit.sha.slice(0, 8)} by ${githubUsername}...`);

      const serializedPermission = this.permissionConfigs.get(user.kernelAddress.toLowerCase() as Address);
      if (!serializedPermission) {
        console.log(`[service] ⚠️  No session key for ${user.kernelAddress} - skipping`);
        continue;
      }

      const ATTESTER_PRIVKEY = getAttesterPrivKey() as Hex;
      const BUNDLER_RPC = process.env.BUNDLER_RPC;
      if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC required for session attestation');

      const result = await attestCommitWithSession(
        {
          userWalletAddress: user.kernelAddress,
          identityAttestationUid: user.identityAttestationUid,
          commitHash: commit.sha,
          repoOwner: commit.repo.owner,
          repoName: commit.repo.name,
          author: githubUsername,
          message: commit.message
        },
        {
          serializedAccount: serializedPermission,
          attesterPrivKey: ATTESTER_PRIVKEY,
          bundlerRpc: BUNDLER_RPC
        }
      );

      if (result.success) {
        console.log(`[service] ✓ Attested: ${result.attestationUid}`);
        this.attestedCommits.add(commit.sha);
        attestedCount++;
      } else {
        console.error(`[service] ✗ Failed: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return attestedCount;
  }

  async getRecentAttestedCommitSet(since: Date): Promise<Set<string>> {
    const now = Date.now();
    if (
      this.recentAttestedCache &&
      this.recentAttestedCache.since === since.getTime() &&
      now - this.recentAttestedCache.fetchedAt < 60_000
    ) {
      return this.recentAttestedCache.commits;
    }

    console.log('[service] Checking for existing attestations...');
    const commits = await fetchRecentAttestedCommits({
      fetchFn: fetch,
      graphqlUrl: EAS_GRAPHQL,
      schemaUid: CONTRIBUTION_SCHEMA_UID,
      since
    });

    this.recentAttestedCache = { since: since.getTime(), fetchedAt: now, commits };
    return commits;
  }

  async processRepo(repo: RepoToWatch, users: RegisteredUser[], since: Date, recentAttested: Set<string>): Promise<number> {
    console.log(`[service] Processing ${repo.owner}/${repo.name}...`);
    
    try {
      // Get recent commits since last check
      let commits;
      try {
        commits = await getRecentCommits(repo.owner, repo.name, since);
      } catch (e: any) {
        if (e.status === 404) {
          console.log(`[service] Skipped ${repo.owner}/${repo.name}: not found or private`);
          return 0;
        }
        if (e.status === 403) {
          console.log(`[service] Skipped ${repo.owner}/${repo.name}: access denied`);
          return 0;
        }
        throw e;
      }
      
      console.log(`[service] Found ${commits.length} commits since ${since.toISOString()}`);
      
      if (commits.length === 0) {
        return 0;
      }

      return await this.processCommits(commits, users, recentAttested);
    } catch (e) {
      console.error(`[service] Error processing ${repo.owner}/${repo.name}:`, e);
      return 0;
    }
  }

  async run(): Promise<void> {
    console.log('[service] Starting attestation run...');
    
    try {
      const lookbackDays = Number(process.env.ATTEST_LOOKBACK_DAYS || '7');
      const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

      // Load session key permissions
      await this.loadPermissionConfigs();

      // Get registered users
      const users = await this.getRegisteredUsers();
      console.log(`[service] Found ${users.length} registered users`);

      const useEventsForWildcard = (process.env.GITHUB_USE_EVENTS_FOR_WILDCARD ?? '1') !== '0';
      const wildcardOwners = new Set<string>();
      if (useEventsForWildcard) {
        for (const user of users) {
          for (const glob of user.repoGlobs) {
            const [owner, repoPattern] = glob.split('/');
            if (repoPattern === '*') wildcardOwners.add(owner);
          }
        }
      }

      // Get repos to watch (skip wildcard owners when using events)
      const repos = await this.getReposToWatch(users, wildcardOwners);
      console.log(`[service] Watching ${repos.length} repos`);

      const recentAttested = await this.getRecentAttestedCommitSet(since);

      // Process wildcard owners via events
      for (const owner of wildcardOwners) {
        await this.processWildcardOwner(owner, users, since, recentAttested);
      }

      // Process each repo
      let totalAttested = 0;
      for (const repo of repos) {
        const count = await this.processRepo(repo, users, since, recentAttested);
        totalAttested += count;
      }

      console.log(`[service] Run complete. Attested ${totalAttested} commits.`);

      // Update last check time (for logs only; stateless runs use lookback window)
      this.lastCheckTime = new Date();
    } catch (e) {
      console.error('[service] Error in run:', e);
    }
  }

  async start(intervalMinutes: number = 30): Promise<void> {
    console.log(`[service] Starting service (interval: ${intervalMinutes}min)`);
    
    // Run immediately
    await this.run();

    // Then run on interval
    setInterval(() => {
      this.run().catch(console.error);
    }, intervalMinutes * 60 * 1000);
  }
}
