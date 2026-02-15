/**
 * Issue Attestation Constants
 * Schema registered on Base Sepolia
 */

import { type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';

// Issue schema UID on Base Sepolia
export const ISSUE_SCHEMA_UID = '0x56dcaaecb00e7841a4271d792e4e6a724782b880441adfa159aa06fa1cfda9cc' as Hex;

export const ISSUE_SCHEMA_STRING = 
  'string repo,uint64 issueNumber,string author,string title,string labels,uint64 timestamp,bytes32 identityUid';

export interface IssueAttestationData {
  repo: string;
  issueNumber: bigint;
  author: string;
  title: string;
  labels: string; // Comma-separated
  timestamp: bigint;
  identityUid: Hex;
}

/**
 * Encode issue attestation data for EAS
 */
export function encodeIssueAttestationData(data: IssueAttestationData): Hex {
  return encodeAbiParameters(
    parseAbiParameters('string,uint64,string,string,string,uint64,bytes32'),
    [
      data.repo,
      data.issueNumber,
      data.author,
      data.title.substring(0, 200), // Truncate title to 200 chars
      data.labels,
      data.timestamp,
      data.identityUid
    ]
  );
}
