import test from 'node:test';
import assert from 'node:assert/strict';
import { runOnboard } from '../src/onboard';

test('runOnboard attests identity then runs permission setup', async () => {
  const calls: string[] = [];

  const result = await runOnboard({
    inputs: {
      githubUsername: 'alice',
      privateKey: '0x59c6995e998f97a5a0044976f0945382db6b0c6f1f48d6b6f5d7d0b8c4b6b9c1',
      walletAddress: '',
      message: '',
      signature: '',
      gistUrl: '',
      githubToken: 'ghp_test'
    },
    createGistFn: async () => {
      calls.push('createGist');
      return 'https://gist.github.com/x/y';
    },
    attestIdentityFn: async () => {
      calls.push('attestIdentity');
    },
    permissionSetupFn: async () => {
      calls.push('permissionSetup');
    }
  });

  assert.deepEqual(calls, ['createGist', 'attestIdentity', 'permissionSetup']);
  assert.equal(result.gistUrl, 'https://gist.github.com/x/y');
});
