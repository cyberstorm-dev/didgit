import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContributionDecodedJson, fetchRecentAttestedCommits } from '../src/contributions';

test('parseContributionDecodedJson extracts commitHash', () => {
  const decoded = JSON.stringify([
    { name: 'repo', value: { value: 'org/repo' } },
    { name: 'commitHash', value: { value: 'abcd1234' } }
  ]);
  assert.equal(parseContributionDecodedJson(decoded), 'abcd1234');
});

test('parseContributionDecodedJson returns null when missing', () => {
  const decoded = JSON.stringify([{ name: 'repo', value: { value: 'org/repo' } }]);
  assert.equal(parseContributionDecodedJson(decoded), null);
});

test('fetchRecentAttestedCommits returns set of commit hashes', async () => {
  const fetchFn = async (_url: string, _init?: RequestInit) => {
    return {
      ok: true,
      json: async () => ({
        data: {
          attestations: [
            { decodedDataJson: JSON.stringify([{ name: 'commitHash', value: { value: 'aaa' } }]) },
            { decodedDataJson: JSON.stringify([{ name: 'commitHash', value: { value: 'bbb' } }]) }
          ]
        }
      })
    } as Response;
  };

  const set = await fetchRecentAttestedCommits({
    fetchFn,
    graphqlUrl: 'https://example.com/graphql',
    schemaUid: '0xschema',
    since: new Date('2024-01-01T00:00:00Z')
  });

  assert.equal(set.has('aaa'), true);
  assert.equal(set.has('bbb'), true);
  assert.equal(set.size, 2);
});
