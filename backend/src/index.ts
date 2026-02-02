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

// Start the service
const service = new AttestationService();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[main] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[main] Shutting down...');
  process.exit(0);
});

// Start
console.log('[main] didgit attestation service starting...');

service.start(30).catch(err => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
