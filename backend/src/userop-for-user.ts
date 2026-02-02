/**
 * Create UserOps for user's Kernel account, signed by verifier
 * 
 * Flow:
 * 1. User has Kernel account with permission validator enabled
 * 2. Permission validator allows verifier to call EAS.attest
 * 3. Verifier creates UserOp for user's account
 * 4. Verifier signs with permission validator signature
 * 5. Submit to bundler
 * 6. User's wallet validates permission, executes, pays gas
 */

import { createPublicClient, http, type Address, type Hex, parseAbi, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;

export async function createUserOpForAttestation(
  userKernelAddress: Address,
  attestationData: {
    recipient: Address;
    refUID: Hex;
    repo: string;
    commitHash: string;
    author: string;
    message: string;
  }
) {
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
  
  console.log('[userop] Creating UserOp for:', userKernelAddress);
  console.log('[userop] Verifier:', verifierAccount.address);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0])
  });

  // Encode contribution data
  const contributionDataEncoded = encodeAbiParameters(
    parseAbiParameters('string, string, string, string, uint64, bytes32'),
    [
      attestationData.repo,
      attestationData.commitHash,
      attestationData.author,
      attestationData.message,
      BigInt(Math.floor(Date.now() / 1000)),
      attestationData.refUID
    ]
  );

  // Create attestation request
  const easAbi = parseAbi([
    'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
  ]);

  const attestCallData = encodeFunctionData({
    abi: easAbi,
    functionName: 'attest',
    args: [{
      schema: CONTRIBUTION_SCHEMA_UID,
      data: {
        recipient: attestationData.recipient,
        expirationTime: 0n,
        revocable: true,
        refUID: attestationData.refUID,
        data: contributionDataEncoded,
        value: 0n
      }
    }]
  });

  console.log('[userop] EAS call data prepared');

  // Now we need to create a UserOp for the user's Kernel account
  // The trick: we need to reference the user's existing account, not create new one
  
  // For this to work, the user must have:
  // 1. Created a Kernel account (they have)
  // 2. Installed a permission validator that allows verifier to call EAS.attest
  
  // Let's try using ZeroDev SDK to create the UserOp
  const { createKernelAccountClient } = await import('@zerodev/sdk');
  const { getEntryPoint } = await import('@zerodev/sdk/constants');
  
  // We can't use createKernelAccount because that would derive a new address
  // Instead, we need to create a client for the EXISTING account
  
  // This is where it gets complex: we need the user's account object
  // but with the verifier's permission validator attached
  
  // TODO: This requires the user to have set up permissions first
  // For now, return error indicating setup needed
  
  throw new Error('User must enable permission validator first - not yet implemented');
}
