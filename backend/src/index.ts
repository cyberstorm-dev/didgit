import dotenv from 'dotenv';
import { AttestationService } from './service';
import { startApiServer } from './api';

// Load environment variables
dotenv.config();

// Validate required env vars
const required = ['VERIFIER_PRIVKEY', 'GITHUB_TOKEN'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

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

async function main() {
  // Start HTTP API server
  await startApiServer();
  
  // Start polling service (optional, can be disabled via env)
  if (process.env.ENABLE_POLLING !== 'false') {
    const service = new AttestationService();
    const intervalMinutes = parseInt(process.env.POLL_INTERVAL_MINUTES || '30', 10);
    await service.start(intervalMinutes);
  } else {
    console.log('[main] Polling service disabled (ENABLE_POLLING=false)');
  }
}

main().catch(err => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
