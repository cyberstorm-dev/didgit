import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAbiParameters, parseAbiParameters } from 'viem';
import { buildRepoGlobsData } from '../src/attest-repo-globs';

test('buildRepoGlobsData encodes comma-joined globs', () => {
  const data = buildRepoGlobsData(['org/*', 'user/repo']);
  const [decoded] = decodeAbiParameters(parseAbiParameters('string'), data);
  assert.equal(decoded, 'org/*,user/repo');
});
