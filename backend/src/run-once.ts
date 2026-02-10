#!/usr/bin/env npx ts-node
/**
 * Single-run attestor script for heartbeat integration.
 * 
 * Pulls all registered agents from EAS, resolves their repo globs,
 * and attests any new commits since last attestation.
 * 
 * No local state required - queries EAS for what's already attested.
 * 
 * Env vars required:
 * - VERIFIER_PRIVKEY: Keypair for signing attestations
 * - GITHUB_TOKEN: For GitHub API access
 */
import dotenv from 'dotenv';
import { AttestationService } from './service';

// Load environment variables
dotenv.config();

// Validate required env vars
const required = ['VERIFIER_PRIVKEY', 'GITHUB_TOKEN'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

async function main() {
  console.log('[attestor] Single run starting...');
  
  const service = new AttestationService();
  await service.run();
  
  console.log('[attestor] Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('[attestor] Fatal error:', err);
  process.exit(1);
});
