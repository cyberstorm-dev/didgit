import test from 'node:test';
import assert from 'node:assert/strict';
import { getChainConfig } from '../src/config';

function setBaseEnv() {
  process.env.BASE_EAS_ADDRESS = '0x0000000000000000000000000000000000000001';
  process.env.BASE_SCHEMA_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000002';
  process.env.BASE_RESOLVER_ADDRESS = '0x0000000000000000000000000000000000000005';
  process.env.BASE_IDENTITY_SCHEMA_UID = '0x' + '11'.repeat(32);
  process.env.BASE_CONTRIBUTION_SCHEMA_UID = '0x' + '22'.repeat(32);
  process.env.BASE_PERMISSION_SCHEMA_UID = '0x' + '33'.repeat(32);
  process.env.BASE_REPO_GLOBS_SCHEMA_UID = '0x' + '44'.repeat(32);
}

function setArbitrumEnv() {
  process.env.ARBITRUM_EAS_ADDRESS = '0x0000000000000000000000000000000000000003';
  process.env.ARBITRUM_SCHEMA_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000004';
  process.env.ARBITRUM_RESOLVER_ADDRESS = '0x0000000000000000000000000000000000000006';
  process.env.ARBITRUM_IDENTITY_SCHEMA_UID = '0x' + '55'.repeat(32);
  process.env.ARBITRUM_CONTRIBUTION_SCHEMA_UID = '0x' + '66'.repeat(32);
  process.env.ARBITRUM_PERMISSION_SCHEMA_UID = '0x' + '77'.repeat(32);
  process.env.ARBITRUM_REPO_GLOBS_SCHEMA_UID = '0x' + '88'.repeat(32);
}

test('defaults to base', () => {
  delete process.env.CHAIN;
  setBaseEnv();
  const cfg = getChainConfig();
  assert.equal(cfg.name, 'base');
  assert.equal(cfg.chainId, 8453);
});

test('allows arbitrum via CHAIN', () => {
  process.env.CHAIN = 'arbitrum';
  setArbitrumEnv();
  const cfg = getChainConfig();
  assert.equal(cfg.name, 'arbitrum');
  assert.equal(cfg.chainId, 42161);
});
