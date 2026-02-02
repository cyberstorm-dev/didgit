import { createPublicClient, http, type Address, type Hex, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getRecentCommits, matchCommitToGitHubUser, type CommitInfo } from './github';
import { attestCommit } from './attest';

const RESOLVER_ADDRESS = '0xf20e5d52acf8fc64f5b456580efa3d8e4dcf16c7' as Address;
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af' as Hex;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;

const resolverAbi = parseAbi([
  'function ownerOf(bytes32 identityHash) view returns (address)',
  'function attestationOf(bytes32 identityHash) view returns (bytes32)'
]);

const easAbi = parseAbi([
  'event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema)'
]);

interface RegisteredUser {
  githubUsername: string;
  walletAddress: Address;
  identityAttestationUid: Hex;
}

interface RepoToWatch {
  owner: string;
  name: string;
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
    // Query EAS for Identity attestations
    // This is a simplified approach - in production, would use EAS GraphQL API
    // For now, return hardcoded test data
    
    console.log('[service] Fetching registered users...');
    
    // TODO: Query EAS via GraphQL or events
    // For testing, return known user
    return [
      {
        githubUsername: 'cyberstorm-nisto',
        walletAddress: '0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd' as Address,
        identityAttestationUid: '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex
      }
    ];
  }

  async getReposToWatch(users: RegisteredUser[]): Promise<RepoToWatch[]> {
    // Query resolver for each user's repo patterns
    // For MVP, hardcode known repos
    
    console.log('[service] Getting repos to watch...');
    
    return [
      { owner: 'cyberstorm-dev', name: 'didgit' },
      { owner: 'cyberstorm-nisto', name: 'nisto-backlog' }
    ];
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
    console.log(`[service] Processing ${repo.owner}/${repo.name}...`);
    
    try {
      // Get recent commits since last check
      const commits = await getRecentCommits(repo.owner, repo.name, this.lastCheckTime);
      
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
        // Match commit to registered user
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

        // Attest the commit
        const result = await attestCommit({
          userWalletAddress: user.walletAddress,
          identityAttestationUid: user.identityAttestationUid,
          commitHash: commit.sha,
          repoOwner: repo.owner,
          repoName: repo.name
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
