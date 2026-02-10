type RepoToWatch = { owner: string; name: string };

type ResolveRepoGlobsArgs = {
  globs: string[];
  skipWildcardOwners: Set<string>;
  listOrgRepos: (org: string) => Promise<RepoToWatch[]>;
  listUserRepos: (user: string) => Promise<RepoToWatch[]>;
};

export async function resolveRepoGlobs(args: ResolveRepoGlobsArgs): Promise<RepoToWatch[]> {
  const repos: RepoToWatch[] = [];
  const seenRepos = new Set<string>();
  const seenOwners = new Set<string>();

  for (const glob of args.globs) {
    if (glob.startsWith('*/')) {
      console.log(`[repo-watch] Skipping unsupported glob: ${glob} (no */ prefix allowed)`);
      continue;
    }
    const [owner, repoPattern] = glob.split('/');
    if (!owner || !repoPattern) continue;

    if (repoPattern === '*') {
      if (args.skipWildcardOwners.has(owner)) {
        continue;
      }
      if (seenOwners.has(owner)) {
        continue;
      }
      seenOwners.add(owner);

      let orgRepos = await args.listOrgRepos(owner);
      if (orgRepos.length === 0) {
        orgRepos = await args.listUserRepos(owner);
      }
      for (const repo of orgRepos) {
        const key = `${repo.owner}/${repo.name}`;
        if (!seenRepos.has(key)) {
          seenRepos.add(key);
          repos.push(repo);
        }
      }
    } else {
      const key = `${owner}/${repoPattern}`;
      if (!seenRepos.has(key)) {
        seenRepos.add(key);
        repos.push({ owner, name: repoPattern });
      }
    }
  }

  return repos;
}
