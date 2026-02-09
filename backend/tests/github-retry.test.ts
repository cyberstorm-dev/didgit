import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetryGitHubError, parseRetryAfterMs, getRetryDelayMs } from '../src/github';

test('shouldRetryGitHubError returns true for 502/503/504/429', () => {
  assert.equal(shouldRetryGitHubError({ status: 502 }), true);
  assert.equal(shouldRetryGitHubError({ status: 503 }), true);
  assert.equal(shouldRetryGitHubError({ status: 504 }), true);
  assert.equal(shouldRetryGitHubError({ status: 429 }), true);
  assert.equal(shouldRetryGitHubError({ response: { status: 429 } }), true);
});

test('shouldRetryGitHubError returns false for 404/403', () => {
  assert.equal(shouldRetryGitHubError({ status: 404 }), false);
  assert.equal(shouldRetryGitHubError({ status: 403 }), false);
});

test('parseRetryAfterMs parses seconds and HTTP date', () => {
  assert.equal(parseRetryAfterMs('5', new Date('2026-02-09T00:00:00Z')), 5000);
  const ms = parseRetryAfterMs('Mon, 09 Feb 2026 00:00:10 GMT', new Date('2026-02-09T00:00:00Z'));
  assert.equal(ms, 10_000);
});

test('getRetryDelayMs honors abuse minimum', () => {
  const err = {
    status: 429,
    response: { headers: { 'retry-after': '1' } },
    data: { message: 'abuse detection mechanism' }
  };
  const delay = getRetryDelayMs(err as any, 1, 500, 30_000, new Date('2026-02-09T00:00:00Z'));
  assert.equal(delay, 30_000);
});
