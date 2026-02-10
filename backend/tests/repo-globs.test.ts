import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoGlobsDecodedJson } from '../src/repo-globs';

test('parseRepoGlobsDecodedJson reads repoGlobs field', () => {
  const decoded = JSON.stringify([
    { name: 'repoGlobs', value: { value: 'cyberstorm-dev/*, allenday/*' } }
  ]);
  const globs = parseRepoGlobsDecodedJson(decoded);
  assert.deepEqual(globs, ['cyberstorm-dev/*', 'allenday/*']);
});

test('parseRepoGlobsDecodedJson reads pattern field', () => {
  const decoded = JSON.stringify([
    { name: 'pattern', value: { value: 'cyberstorm-dev/*' } }
  ]);
  const globs = parseRepoGlobsDecodedJson(decoded);
  assert.deepEqual(globs, ['cyberstorm-dev/*']);
});

test('parseRepoGlobsDecodedJson returns empty array for invalid json', () => {
  const globs = parseRepoGlobsDecodedJson('not-json');
  assert.deepEqual(globs, []);
});
