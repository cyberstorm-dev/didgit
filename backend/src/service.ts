import { createPublicClient, http, type Address, type Hex, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getRecentCommits as getGithubRecentCommits, matchCommitToGitHubUser, listOrgRepos as listGithubOrgRepos, listUserRepos as listGithubUserRepos, type CommitInfo } from './github';
import { getRecentCommits as getGiteaRecentCommits, matchCommitToGiteaUser, listOrgRepos as listGiteaOrgRepos, listUserRepos as listGiteaUserRepos } from './gitea';
import { attestCommitWithKernel, type UserKernelInfo } from './attest-with-kernel';

const RESOLVER_ADDRESS = '0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7' as Address;
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af' as Hex;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const REPO_GLOBS_SCHEMA_UID = '0x79cb78c31678d34847273f605290b2ab56db29a057fdad8facdcc492b9cf2e74' as Hex;
const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';

const resolverAbi = parseAbi([
  'function ownerOf(bytes32 identityHash) view returns (address)',
  'function attestationOf(bytes32 identityHash) view returns (bytes32)'
]);

const easAbi = parseAbi([
  'event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema)'
]);

interface RegisteredUser {
  username: string;               // Platform username (GitHub, Codeberg, etc.)
  domain: string;                 // Platform domain (github.com, codeberg.org, or self-hosted)
  walletAddress: Address;         // User's EOA
  kernelAddress: Address;         // User's Kernel smart account
  identityAttestationUid: Hex;
  repoGlobs: string[];            // e.g., ["cyberstorm-dev/*", "cyberstorm-nisto/*"]
}

interface RepoToWatch {
  owner: string;
  name: string;
  domain: string;                 // Platform domain for API calls
}

/**
 * Determine if a domain is GitHub
 */
function isGitHub(domain: string): boolean {
  return domain.toLowerCase() === 'github.com';
}

/**
 * Determine if a domain is GitLab (for future support)
 */
function isGitLab(domain: string): boolean {
  return domain.toLowerCase() === 'gitlab.com';
}

/**
 * Determine if a domain is Gitea/Codeberg (anything not GitHub/GitLab)
 */
function isGitea(domain: string): boolean {
  return !isGitHub(domain) && !isGitLab(domain);
}

/**
 * Get the custom host for Gitea API calls (null for codeberg.org as it's the default)
 */
function getGiteaHost(domain: string): string | undefined {
  if (domain.toLowerCase() === 'codeberg.org') {
    return undefined; // Use default
  }
  return domain;
}

export class AttestationService {
  private publicClient;
  private lastCheckTime: Date;
  private attestedCommits: Set<string>;

  constructor() {
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0])
    });
    this.lastCheckTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Start 24h ago
    this.attestedCommits = new Set();
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

      const identityData = await identityRes.json();
      const repoGlobsData = await repoGlobsRes.json();

      const identities = identityData?.data?.attestations ?? [];
      const repoGlobsAtts = repoGlobsData?.data?.attestations ?? [];

      // Build map of identity UID -> repo globs
      const globsByIdentity = new Map<string, string[]>();
      for (const att of repoGlobsAtts) {
        try {
          const decoded = JSON.parse(att.decodedDataJson);
          const globsField = decoded.find((d: any) => d.name === 'repoGlobs');
          if (globsField?.value?.value && att.refUID) {
            const globs = globsField.value.value.split(',').map((g: string) => g.trim());
            globsByIdentity.set(att.refUID.toLowerCase(), globs);
          }
        } catch {}
      }

      // Build registered users
      const users: RegisteredUser[] = [];
      const seenIdentities = new Set<string>(); // Use domain:username as key

      for (const att of identities) {
        try {
          const decoded = JSON.parse(att.decodedDataJson);
          const usernameField = decoded.find((d: any) => d.name === 'username');
          const domainField = decoded.find((d: any) => d.name === 'domain');
          
          const username = usernameField?.value?.value;
          // Default to github.com for backwards compatibility with older attestations
          const domain = domainField?.value?.value || 'github.com';
          
          if (!username) continue;
          
          const identityKey = `${domain.toLowerCase()}:${username.toLowerCase()}`;
          if (seenIdentities.has(identityKey)) continue;
          seenIdentities.add(identityKey);

          const repoGlobs = globsByIdentity.get(att.id.toLowerCase()) || [];
          
          // Only include users with repo globs registered
          if (repoGlobs.length === 0) {
            console.log(`[service] Skipping ${domain}:${username}: no repo globs registered`);
            continue;
          }

          users.push({
            username,
            domain,
            walletAddress: att.recipient as Address,
            kernelAddress: '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as Address, // TODO: lookup from registry
            identityAttestationUid: att.id as Hex,
            repoGlobs
          });

          console.log(`[service] Found user: ${domain}:${username} with globs: ${repoGlobs.join(', ')}`);
        } catch {}
      }

      return users;
    } catch (e) {
      console.error('[service] Error fetching from EAS:', e);
      return [];
    }
  }

  async getReposToWatch(users: RegisteredUser[]): Promise<RepoToWatch[]> {
    console.log('[service] Resolving repo globs...');
    
    const repos: RepoToWatch[] = [];
    const seen = new Set<string>();
    
    for (const user of users) {
      const { domain } = user;
      
      for (const glob of user.repoGlobs) {
        // Parse glob: "owner/*" or "owner/repo"
        const [owner, repoPattern] = glob.split('/');
        
        if (repoPattern === '*') {
          // Wildcard: fetch all repos for org/user
          console.log(`[service] Fetching repos for ${domain}:${owner}/*`);
          
          let fetchedRepos: { owner: string; name: string }[] = [];
          
          if (isGitHub(domain)) {
            // Try as org first, then as user
            fetchedRepos = await listGithubOrgRepos(owner);
            if (fetchedRepos.length === 0) {
              fetchedRepos = await listGithubUserRepos(owner);
            }
          } else if (isGitea(domain)) {
            // Gitea/Codeberg: try as org first, then as user
            const customHost = getGiteaHost(domain);
            fetchedRepos = await listGiteaOrgRepos(owner, customHost);
            if (fetchedRepos.length === 0) {
              fetchedRepos = await listGiteaUserRepos(owner, customHost);
            }
          } else {
            console.log(`[service] Unsupported platform: ${domain}`);
            continue;
          }
          
          for (const repo of fetchedRepos) {
            const key = `${domain}:${repo.owner}/${repo.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              repos.push({ owner: repo.owner, name: repo.name, domain });
            }
          }
        } else {
          // Specific repo
          const key = `${domain}:${owner}/${repoPattern}`;
          if (!seen.has(key)) {
            seen.add(key);
            repos.push({ owner, name: repoPattern, domain });
          }
        }
      }
    }
    
    console.log(`[service] Watching ${repos.length} repos`);
    return repos;
  }

  async checkCommitsAlreadyAttested(commitShas: string[]): Promise<Set<string>> {
    // Query EAS for Contribution attestations
    // Check which of these commits have already been attested
    
    console.log('[service] Checking for existing attestations...');
    
    const attested = new Set<string>();
    
    // TODO: Query EAS GraphQL API
    // For now, just return empty set (all commits are new)
    
    return attested;
  }

  async processRepo(repo: RepoToWatch, users: RegisteredUser[]): Promise<number> {
    console.log(`[service] Processing ${repo.domain}:${repo.owner}/${repo.name}...`);
    
    try {
      // Get recent commits since last check using platform-specific API
      let commits: CommitInfo[];
      try {
        if (isGitHub(repo.domain)) {
          commits = await getGithubRecentCommits(repo.owner, repo.name, this.lastCheckTime);
        } else if (isGitea(repo.domain)) {
          const customHost = getGiteaHost(repo.domain);
          commits = await getGiteaRecentCommits(repo.owner, repo.name, this.lastCheckTime, customHost);
        } else {
          console.log(`[service] Unsupported platform: ${repo.domain}`);
          return 0;
        }
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
      
      console.log(`[service] Found ${commits.length} commits since ${this.lastCheckTime.toISOString()}`);
      
      if (commits.length === 0) {
        return 0;
      }

      // Filter out already attested commits
      const alreadyAttested = await this.checkCommitsAlreadyAttested(commits.map(c => c.sha));
      const newCommits = commits.filter(c => !alreadyAttested.has(c.sha) && !this.attestedCommits.has(c.sha));
      
      console.log(`[service] ${newCommits.length} new commits to attest`);

      let attestedCount = 0;

      for (const commit of newCommits) {
        // Match commit to registered user using platform-specific matcher
        let platformUsername: string | null;
        if (isGitHub(repo.domain)) {
          platformUsername = matchCommitToGitHubUser(commit);
        } else if (isGitea(repo.domain)) {
          platformUsername = matchCommitToGiteaUser(commit);
        } else {
          platformUsername = null;
        }
        
        if (!platformUsername) {
          console.log(`[service] Skipping commit ${commit.sha.slice(0, 8)} - no platform username`);
          continue;
        }

        // Find user matching both username AND domain
        const user = users.find(
          u => u.username.toLowerCase() === platformUsername!.toLowerCase() &&
               u.domain.toLowerCase() === repo.domain.toLowerCase()
        );
        
        if (!user) {
          console.log(`[service] Skipping commit ${commit.sha.slice(0, 8)} by ${repo.domain}:${platformUsername} - not registered`);
          continue;
        }

        console.log(`[service] Attesting commit ${commit.sha.slice(0, 8)} by ${repo.domain}:${platformUsername}...`);

        // Attest the commit via user's Kernel (permission-based)
        // Use platform username for consistency in leaderboards
        const result = await attestCommitWithKernel({
          user: {
            kernelAddress: user.kernelAddress,
            userEOA: user.walletAddress
          },
          identityAttestationUid: user.identityAttestationUid,
          commitHash: commit.sha,
          repoOwner: repo.owner,
          repoName: repo.name,
          author: platformUsername, // Use platform username, not git author name
          message: commit.message
        });

        if (result.success) {
          console.log(`[service] ✓ Attested: ${result.attestationUid}`);
          this.attestedCommits.add(commit.sha);
          attestedCount++;
        } else {
          console.error(`[service] ✗ Failed: ${result.error}`);
        }

        // Rate limit: wait 2s between attestations
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return attestedCount;
    } catch (e) {
      console.error(`[service] Error processing ${repo.owner}/${repo.name}:`, e);
      return 0;
    }
  }

  async run(): Promise<void> {
    console.log('[service] Starting attestation run...');
    
    try {
      // Get registered users
      const users = await this.getRegisteredUsers();
      console.log(`[service] Found ${users.length} registered users`);

      // Get repos to watch
      const repos = await this.getReposToWatch(users);
      console.log(`[service] Watching ${repos.length} repos`);

      // Process each repo
      let totalAttested = 0;
      for (const repo of repos) {
        const count = await this.processRepo(repo, users);
        totalAttested += count;
      }

      console.log(`[service] Run complete. Attested ${totalAttested} commits.`);

      // Update last check time
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
