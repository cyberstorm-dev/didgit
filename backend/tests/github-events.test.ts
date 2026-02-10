import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePushEventsToCommits } from '../src/github';

test('parsePushEventsToCommits maps push events to commit infos', () => {
  const events = [
    {
      type: 'PushEvent',
      created_at: '2026-02-09T00:00:00Z',
      actor: { login: 'allenday' },
      repo: { name: 'allenday/myrepo' },
      payload: {
        commits: [
          { sha: 'aaa', message: 'first', author: { name: 'Allen', email: 'a@b.com' } },
          { sha: 'bbb', message: 'second', author: { name: 'Allen', email: 'a@b.com' } }
        ]
      }
    }
  ];

  const commits = parsePushEventsToCommits(events as any);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].sha, 'aaa');
  assert.equal(commits[0].author.username, 'allenday');
  assert.equal(commits[0].repo.owner, 'allenday');
  assert.equal(commits[0].repo.name, 'myrepo');
});
