import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePermissionApiUrl } from '../src/permission-setup';

test('resolvePermissionApiUrl falls back to workers.dev when didgit.dev is set', () => {
  const url = resolvePermissionApiUrl('https://didgit.dev/api/v1/permission-blob');
  assert.equal(url, 'https://didgit-permission-blob.ops7622.workers.dev');
});

test('resolvePermissionApiUrl keeps explicit non-didgit URLs', () => {
  const url = resolvePermissionApiUrl('https://example.com/permission-blob');
  assert.equal(url, 'https://example.com/permission-blob');
});
