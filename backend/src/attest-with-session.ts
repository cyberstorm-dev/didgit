/**
 * Attest commits using session key (user pays gas)
 * 
 * Uses the serialized permission account from setup-session-key.ts
 * Requires only VERIFIER_PRIVKEY at runtime - no user private key.
 * 
 * User's Kernel pays gas, attestation comes FROM user's Kernel address.
 */

import 'dotenv/config';
import { createPublicClient, http, type Address, type Hex, parseAbi, encodeAbiParameters, parseAbiParameters } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  createKernelAccountClient
} from '@zerodev/sdk';
import { deserializePermissionAccount } from '@zerodev/permissions';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http as viemHttp } from 'viem';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;

const easAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
]);

export interface AttestCommitRequest {
  userWalletAddress: Address;
  identityAttestationUid: Hex;
  commitHash: string;
  repoOwner: string;
  repoName: string;
  author: string;
  message: string;
}

export interface SessionConfig {
  serializedAccount: string;
  verifierPrivKey: Hex;
  bundlerRpc: string;
}

export async function attestCommitWithSession(
  req: AttestCommitRequest,
  config: SessionConfig
): Promise<{ success: boolean; attestationUid?: Hex; txHash?: Hex; error?: string }> {
  try {
    console.log('[attest-session] Commit:', req.commitHash.slice(0, 12));
    console.log('[attest-session] User wallet:', req.userWalletAddress);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    });

    const entryPoint = getEntryPoint('0.7');

    // Deserialize the permission account
    const kernelAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      config.serializedAccount
    );

    console.log('[attest-session] Kernel address:', kernelAccount.address);

    // Check balance
    const balance = await publicClient.getBalance({ address: kernelAccount.address });
    console.log('[attest-session] Kernel balance:', Number(balance) / 1e18, 'ETH');

    if (balance < BigInt(1e14)) { // Less than 0.0001 ETH
      throw new Error('Insufficient Kernel balance for gas');
    }

    // Create kernel client
    // Note: entryPoint is inferred from the account in SDK v5.5+
    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      chain: baseSepolia,
      bundlerTransport: viemHttp(config.bundlerRpc)
    });

    // Encode contribution data according to schema
    const contributionData = encodeAbiParameters(
      parseAbiParameters('string, string, string, string, uint64, bytes32'),
      [
        `${req.repoOwner}/${req.repoName}`,
        req.commitHash,
        req.author,
        req.message,
        BigInt(Math.floor(Date.now() / 1000)),
        req.identityAttestationUid
      ]
    );

    // Create attestation request
    const attestationRequest = {
      schema: CONTRIBUTION_SCHEMA_UID,
      data: {
        recipient: req.userWalletAddress,
        expirationTime: 0n,
        revocable: true,
        refUID: req.identityAttestationUid,
        data: contributionData,
        value: 0n
      }
    };

    console.log('[attest-session] Sending attestation UserOp...');

    // Encode the attest function call properly
    const { encodeFunctionData } = await import('viem');
    const attestCallData = encodeFunctionData({
      abi: easAbi,
      functionName: 'attest',
      args: [attestationRequest]
    });

    // Send UserOp
    const userOpHash = await kernelClient.sendUserOperation({
      callData: await kernelAccount.encodeCalls([
        {
          to: EAS_ADDRESS,
          value: BigInt(0),
          data: attestCallData
        }
      ])
    });

    console.log('[attest-session] UserOp hash:', userOpHash);

    // Wait for receipt
    const receipt = await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash
    });

    console.log('[attest-session] TX hash:', receipt.receipt.transactionHash);

    // Parse logs to get attestation UID
    const attestedLog = receipt.receipt.logs.find(log => 
      log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() &&
      log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35'
    );

    const attestationUid = attestedLog?.topics[3] as Hex | undefined;

    console.log('[attest-session] ✓ Attestation UID:', attestationUid);

    return {
      success: true,
      attestationUid,
      txHash: receipt.receipt.transactionHash
    };
  } catch (e) {
    console.error('[attest-session] Error:', e);
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}

// Test if run directly
async function main() {
  const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
  const BUNDLER_RPC = process.env.BUNDLER_RPC;
  
  if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY required');
  if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC required');

  // Load permission account
  const fs = await import('fs');
  const permissionData = JSON.parse(fs.readFileSync('.permission-account.json', 'utf-8'));

  console.log('[test] Testing session key attestation...');
  console.log('[test] Kernel:', permissionData.kernelAddress);
  console.log('[test] Verifier:', permissionData.verifier);

  // Test attestation
  const result = await attestCommitWithSession(
    {
      userWalletAddress: permissionData.kernelAddress as Address,
      identityAttestationUid: '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex,
      commitHash: 'test123456789',
      repoOwner: 'cyberstorm-dev',
      repoName: 'test-repo',
      author: 'cyberstorm-nisto',
      message: 'Test attestation via session key'
    },
    {
      serializedAccount: permissionData.serialized,
      verifierPrivKey: VERIFIER_PRIVKEY,
      bundlerRpc: BUNDLER_RPC
    }
  );

  console.log('[test] Result:', result);
}

// Only run test when executed directly
if (process.argv[1]?.includes('attest-with-session')) {
  main().catch(console.error);
}
