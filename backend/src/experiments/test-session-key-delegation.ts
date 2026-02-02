/**
 * Test session key delegation approach
 * User signs: "I delegate attestation rights to verifier until [expiry]"
 * Backend includes this signature when creating UserOps
 */

import { createPublicClient, http, type Hex, parseAbi, encodeAbiParameters, parseAbiParameters, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const USER_PRIVKEY = '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7' as Hex;
const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const USER_KERNEL = '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as Address;

async function test() {
  const user = privateKeyToAccount(USER_PRIVKEY);
  const verifier = privateKeyToAccount(VERIFIER_PRIVKEY);
  
  console.log('User EOA:', user.address);
  console.log('Verifier:', verifier.address);
  console.log('User Kernel:', USER_KERNEL);
  console.log('');
  
  // User signs delegation message
  const delegationMessage = `I authorize ${verifier.address} to create EAS attestations on my behalf until 2026-03-01`;
  
  const userSignature = await user.signMessage({ message: delegationMessage });
  
  console.log('User signed delegation');
  console.log('Signature:', userSignature);
  console.log('');
  console.log('Backend can now include this signature when creating UserOps');
  console.log('Kernel would validate: ecrecover(delegationMessage) == user.address');
  console.log('');
  console.log('⚠️  However: Kernel v3 may not have built-in support for this pattern');
  console.log('   Need to verify if Kernel can validate arbitrary delegation messages');
}

test().catch(console.error);
