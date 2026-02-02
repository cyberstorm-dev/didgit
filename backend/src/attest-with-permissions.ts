/**
 * Attestation service with user-pays-gas via ZeroDev permissions
 * 
 * Flow:
 * 1. User creates Kernel account with permission validator enabled
 * 2. Permission validator allows verifier to call EAS.attest
 * 3. Backend creates UserOp for user's Kernel account
 * 4. Backend signs with verifier's key via permission validator
 * 5. Bundler executes, user's wallet pays gas
 */

import { 
  createPublicClient, 
  http, 
  type Address, 
  type Hex, 
  parseAbi, 
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters 
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;

export interface AttestCommitRequest {
  userKernelAddress: Address; // User's Kernel account address
  identityAttestationUid: Hex;
  commitHash: string;
  repoOwner: string;
  repoName: string;
  author: string;
  message: string;
}

export async function attestCommitWithPermissions(
  req: AttestCommitRequest
): Promise<{ success: boolean; attestationUid?: Hex; txHash?: Hex; error?: string }> {
  try {
    const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
    const BUNDLER_RPC = process.env.BUNDLER_RPC;
    
    if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY not set');
    if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC not set');

    const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
    console.log('[attest-perm] Verifier:', verifierAccount.address);
    console.log('[attest-perm] User Kernel:', req.userKernelAddress);
    console.log('[attest-perm] Commit:', req.commitHash.slice(0, 12));

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0])
    });

    // Import ZeroDev modules
    const { toPermissionValidator } = await import('@zerodev/permissions');
    const { toECDSASigner } = await import('@zerodev/permissions');
    const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions');
    const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
    const { createKernelAccountClient, createZeroDevPaymasterClient } = await import('@zerodev/sdk');
    const { http: bundlerHttp } = await import('viem');

    const entryPoint = getEntryPoint('0.7');
    const kernelVersion = KERNEL_V3_1;

    // Create verifier's signer for permission validator
    const verifierSigner = await toECDSASigner({
      signer: verifierAccount
    });

    // Create call policy - only allow EAS.attest
    const easAbi = parseAbi([
      'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
    ]);

    const callPolicy = toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_5,
      permissions: [
        {
          target: EAS_ADDRESS,
          abi: easAbi,
          functionName: 'attest',
          valueLimit: 0n
        }
      ]
    });

    // Create permission validator
    console.log('[attest-perm] Creating permission validator...');
    const permissionValidator = await toPermissionValidator(publicClient, {
      signer: verifierSigner,
      policies: [callPolicy],
      entryPoint,
      kernelVersion
    });

    console.log('[attest-perm] Permission ID:', permissionValidator.getIdentifier());

    // Create kernel account client for the EXISTING user account
    // This uses the user's Kernel address directly
    const kernelClient = await createKernelAccountClient({
      account: {
        address: req.userKernelAddress,
        entryPoint,
        kernelVersion
      },
      chain: baseSepolia,
      bundlerTransport: http(BUNDLER_RPC),
      middleware: {
        sponsorUserOperation: async ({ userOperation }) => {
          // No paymaster - user pays own gas
          return userOperation;
        }
      }
    });

    // Encode contribution data
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
        recipient: req.userKernelAddress,
        expirationTime: 0n,
        revocable: true,
        refUID: req.identityAttestationUid,
        data: contributionData,
        value: 0n
      }
    };

    console.log('[attest-perm] Sending UserOp...');

    // Send UserOp via the Kernel client
    // This creates a UserOp with sender=userKernelAddress, signed with verifier's permission
    const txHash = await kernelClient.writeContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: 'attest',
      args: [attestationRequest]
    });

    console.log('[attest-perm] TX hash:', txHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log('[attest-perm] Receipt:', receipt.status);

    // Parse attestation UID from logs
    const attestedLog = receipt.logs.find(log => 
      log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() &&
      log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35'
    );

    const attestationUid = attestedLog?.topics[3] as Hex | undefined;

    if (!attestationUid) {
      throw new Error('Failed to parse attestation UID from logs');
    }

    console.log('[attest-perm] Attestation UID:', attestationUid);

    return {
      success: true,
      attestationUid,
      txHash
    };
  } catch (e) {
    console.error('[attest-perm] Error:', e);
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}
