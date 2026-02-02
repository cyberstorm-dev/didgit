/**
 * Test: Backend attestation via permission-based Kernel
 * 
 * Prerequisites:
 * - User's Kernel deployed
 * - Permission granted to verifier (happens on first use via enable signature)
 * 
 * Run: VERIFIER_PRIVKEY=... USER_PRIVKEY=... npx ts-node src/test-backend-attest.ts
 */

import { attestCommitWithKernel, type UserKernelInfo, type AttestCommitRequest } from './attest-with-kernel';
import { type Address, type Hex } from 'viem';

// Test configuration
const TEST_USER: UserKernelInfo = {
  kernelAddress: '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as Address,
  userEOA: '0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd' as Address
};

const TEST_IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex;

async function main() {
  console.log('=== Backend Attestation Test ===\n');
  
  // Verify env vars
  if (!process.env.VERIFIER_PRIVKEY) {
    console.error('ERROR: VERIFIER_PRIVKEY not set');
    console.log('\nUsage:');
    console.log('  VERIFIER_PRIVKEY=0x... USER_PRIVKEY=0x... npx ts-node src/test-backend-attest.ts');
    process.exit(1);
  }
  if (!process.env.USER_PRIVKEY) {
    console.error('ERROR: USER_PRIVKEY not set');
    process.exit(1);
  }

  // Create a test commit attestation
  const testRequest: AttestCommitRequest = {
    user: TEST_USER,
    identityAttestationUid: TEST_IDENTITY_UID,
    commitHash: 'abc123def456789012345678901234567890abcd', // 40 char SHA
    repoOwner: 'cyberstorm-dev',
    repoName: 'didgit',
    author: 'cyberstorm-nisto',
    message: 'test: backend attestation via permission-based kernel'
  };

  console.log('Test request:');
  console.log('  Kernel:', testRequest.user.kernelAddress);
  console.log('  User EOA:', testRequest.user.userEOA);
  console.log('  Commit:', testRequest.commitHash.slice(0, 12) + '...');
  console.log('  Repo:', `${testRequest.repoOwner}/${testRequest.repoName}`);
  console.log('');

  // Execute attestation
  const result = await attestCommitWithKernel(testRequest);

  console.log('\n=== Result ===');
  if (result.success) {
    console.log('✅ SUCCESS');
    console.log('  TX:', result.txHash);
    console.log('  Attestation UID:', result.attestationUid);
    console.log('  Explorer: https://sepolia.basescan.org/tx/' + result.txHash);
  } else {
    console.log('❌ FAILED');
    console.log('  Error:', result.error);
  }
}

main().catch(console.error);
