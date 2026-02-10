import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventSelector } from 'viem';
import { extractAttestationUid } from '../src/attest-permission';

test('extractAttestationUid prefers EAS Attested log uid by topic0 (indexed uid)', () => {
  const eas = '0x4200000000000000000000000000000000000021';
  const attestedTopic0 = getEventSelector('Attested(bytes32,address,address,bytes32)');
  const logs = [
    { address: '0x1111111111111111111111111111111111111111', topics: ['0x0', '0xaaa'] },
    { address: eas, topics: ['0xdead', '0x0000000000000000000000003c9b6d91676e2a937f82c58b3038c666d0b94d98'] },
    { address: eas, topics: [attestedTopic0, '0xdeadbeef'] }
  ];
  const uid = extractAttestationUid(logs as any, eas);
  assert.equal(uid, '0xdeadbeef');
});

test('extractAttestationUid reads uid from data when schema indexed', () => {
  const eas = '0x4200000000000000000000000000000000000021';
  const attestedTopic0 = getEventSelector('Attested(address,address,bytes32,bytes32)');
  const uidData = '0x' + '11'.repeat(32);
  const logs = [
    {
      address: eas,
      topics: [
        attestedTopic0,
        '0x0000000000000000000000003c9b6d91676e2a937f82c58b3038c666d0b94d98',
        '0x000000000000000000000000ada4189ea82d0f0fb58d9ef63d580c4e070ed0c5',
        '0x6ab56e335e99f78585c89e5535b47c3c90c94c056775dbd28a57490b07e2e9b6'
      ],
      data: uidData
    }
  ];
  const uid = extractAttestationUid(logs as any, eas);
  assert.equal(uid, uidData);
});

test('extractAttestationUid returns undefined when no matching log', () => {
  const eas = '0x4200000000000000000000000000000000000021';
  const logs = [{ address: eas, topics: ['0xdead', '0xaaa'] }];
  const uid = extractAttestationUid(logs as any, eas);
  assert.equal(uid, undefined);
});
