import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRepoGlobs } from '../src/repo-watch';

test('resolveRepoGlobs skips wildcard owners when configured', async () => {
  const listOrgRepos = async (_org: string) => [{ owner: 'skipme', name: 'a' }];
  const listUserRepos = async (_user: string) => [{ owner: 'skipme', name: 'b' }];

  const repos = await resolveRepoGlobs({
    globs: ['skipme/*', 'keep/repo'],
    skipWildcardOwners: new Set(['skipme']),
    listOrgRepos,
    listUserRepos
  });

  assert.deepEqual(repos, [{ owner: 'keep', name: 'repo' }]);
});

test('resolveRepoGlobs de-dupes wildcard owner fetches', async () => {
  let orgCalls = 0;
  let userCalls = 0;
  const listOrgRepos = async (org: string) => {
    orgCalls++;
    return org === 'org' ? [{ owner: 'org', name: 'x' }] : [];
  };
  const listUserRepos = async (user: string) => {
    userCalls++;
    return user === 'org' ? [{ owner: 'org', name: 'y' }] : [];
  };

  const repos = await resolveRepoGlobs({
    globs: ['org/*', 'org/*'],
    skipWildcardOwners: new Set(),
    listOrgRepos,
    listUserRepos
  });

  assert.deepEqual(repos, [{ owner: 'org', name: 'x' }]);
  assert.equal(orgCalls, 1);
  assert.equal(userCalls, 0);
});
