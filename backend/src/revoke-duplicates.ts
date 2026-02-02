/**
 * Revoke duplicate identity attestations
 * 
 * Identifies usernames with multiple attestations and revokes the older ones,
 * keeping only the most recent attestation per username.
 * 
 * Usage:
 *   DRY RUN:  npx ts-node tools/revoke-duplicates.ts
 *   EXECUTE:  PRIVATE_KEY=0x... npx ts-node tools/revoke-duplicates.ts --execute
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const EAS_GRAPHQL = 'https://base-sepolia.easscan.org/graphql';
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';

const EAS_ABI = parseAbi([
  'function revoke((bytes32 schema, (bytes32 uid, bytes32 value)[] data)) external payable returns (bool)',
]);

interface Attestation {
  id: string;
  attester: string;
  recipient: string;
  time: number;
  decodedDataJson: string;
  revoked: boolean;
}

interface DecodedField {
  name: string;
  value: { value: string };
}

async function fetchIdentityAttestations(): Promise<Attestation[]> {
  const query = `
    query GetIdentities($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: asc }
      ) {
        id
        attester
        recipient
        time
        decodedDataJson
        revoked
      }
    }
  `;

  const response = await fetch(EAS_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { schemaId: IDENTITY_SCHEMA_UID }
    })
  });

  if (!response.ok) {
    throw new Error(`EAS API error: ${response.statusText}`);
  }

  const data = await response.json() as { data?: { attestations?: Attestation[] } };
  return data?.data?.attestations ?? [];
}

function extractUsername(attestation: Attestation): string | null {
  try {
    const decoded: DecodedField[] = JSON.parse(attestation.decodedDataJson);
    const usernameField = decoded.find(d => d.name === 'username');
    return usernameField?.value?.value?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function findDuplicates(attestations: Attestation[]): Map<string, Attestation[]> {
  const byUsername = new Map<string, Attestation[]>();

  for (const att of attestations) {
    const username = extractUsername(att);
    if (!username) continue;

    const existing = byUsername.get(username) ?? [];
    existing.push(att);
    byUsername.set(username, existing);
  }

  // Filter to only usernames with duplicates
  const duplicates = new Map<string, Attestation[]>();
  for (const [username, atts] of byUsername) {
    if (atts.length > 1) {
      // Sort by time descending (newest first)
      atts.sort((a, b) => b.time - a.time);
      duplicates.set(username, atts);
    }
  }

  return duplicates;
}

async function revokeAttestation(uid: string, walletClient: any): Promise<string> {
  const hash = await walletClient.writeContract({
    address: EAS_ADDRESS,
    abi: EAS_ABI,
    functionName: 'revoke',
    args: [{
      schema: IDENTITY_SCHEMA_UID,
      data: [{ uid: uid as `0x${string}`, value: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}` }]
    }]
  });
  return hash;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const privateKey = process.env.PRIVATE_KEY;

  console.log('🔍 Scanning for duplicate identity attestations...\n');

  // Fetch all identity attestations
  const attestations = await fetchIdentityAttestations();
  console.log(`Found ${attestations.length} total identity attestations\n`);

  // Find duplicates
  const duplicates = findDuplicates(attestations);

  if (duplicates.size === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log(`⚠️  Found ${duplicates.size} usernames with duplicate attestations:\n`);

  const toRevoke: { uid: string; username: string; attester: string }[] = [];

  for (const [username, atts] of duplicates) {
    console.log(`  ${username}:`);
    for (let i = 0; i < atts.length; i++) {
      const att = atts[i];
      const date = new Date(att.time * 1000).toISOString();
      const status = i === 0 ? '✓ KEEP (newest)' : '✗ REVOKE';
      console.log(`    ${status} ${att.id.slice(0, 10)}... (${date})`);
      
      if (i > 0) {
        toRevoke.push({ uid: att.id, username, attester: att.attester });
      }
    }
    console.log();
  }

  console.log(`\nTotal attestations to revoke: ${toRevoke.length}\n`);

  if (!execute) {
    console.log('🔶 DRY RUN - No changes made.');
    console.log('   Run with --execute and PRIVATE_KEY=0x... to revoke duplicates.');
    return;
  }

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable required for --execute');
    process.exit(1);
  }

  // Set up wallet client
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  });

  console.log(`🔑 Using wallet: ${account.address}\n`);

  // Check that wallet matches attester for all attestations
  for (const item of toRevoke) {
    if (item.attester.toLowerCase() !== account.address.toLowerCase()) {
      console.error(`❌ Cannot revoke ${item.uid} - attester ${item.attester} doesn't match wallet ${account.address}`);
      console.error('   Only the original attester can revoke an attestation.');
      process.exit(1);
    }
  }

  // Revoke each duplicate
  console.log('🚀 Revoking duplicates...\n');

  for (const item of toRevoke) {
    try {
      console.log(`  Revoking ${item.uid.slice(0, 10)}... (${item.username})`);
      const hash = await revokeAttestation(item.uid, walletClient);
      console.log(`    ✓ TX: ${hash}`);
    } catch (err: any) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
