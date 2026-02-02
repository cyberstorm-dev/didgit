/**
 * Delegated attestation with user-pays-gas
 * 
 * Prerequisites:
 * 1. User has created Kernel account (AA wallet)
 * 2. User has funded Kernel with ETH for gas
 * 3. User has installed SimpleAllowlistValidator module
 * 
 * Flow:
 * 1. Backend detects commit
 * 2. Backend creates UserOp for user's Kernel account
 * 3. Backend signs with verifier key
 * 4. Kernel validates: "Is verifier authorized?" (checks installed modules)
 * 5. Kernel executes EAS.attest, pays gas from user's balance
 */

import { 
  createPublicClient, 
  createWalletClient,
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

export interface DelegatedAttestRequest {
  userKernelAddress: Address; // User's Kernel AA wallet address
  identityAttestationUid: Hex;
  commitHash: string;
  repoOwner: string;
  repoName: string;
  author: string;
  message: string;
}

export async function createDelegatedAttestation(
  req: DelegatedAttestRequest
): Promise<{ success: boolean; attestationUid?: Hex; txHash?: Hex; error?: string }> {
  try {
    const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
    const BUNDLER_RPC = process.env.BUNDLER_RPC;
    
    if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY not set');
    if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC not set');

    const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
    console.log('[delegated] Verifier:', verifierAccount.address);
    console.log('[delegated] User Kernel:', req.userKernelAddress);
    console.log('[delegated] Commit:', req.commitHash.slice(0, 12));

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    });

    // Check user's Kernel is deployed
    const code = await publicClient.getBytecode({ address: req.userKernelAddress });
    if (!code || code === '0x') {
      throw new Error('User Kernel account not deployed. User must create account first.');
    }

    // Check user has balance for gas
    const balance = await publicClient.getBalance({ address: req.userKernelAddress });
    if (balance === 0n) {
      throw new Error('User Kernel has no ETH for gas. User must fund account first.');
    }

    console.log('[delegated] User balance:', balance.toString(), 'wei');

    // Import ZeroDev SDK
    const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
    const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
    const { toECDSASigner } = await import('@zerodev/permissions/signers');
    const { toPermissionValidator } = await import('@zerodev/permissions');
    const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions/policies');

    const entryPoint = getEntryPoint('0.7');
    const kernelVersion = KERNEL_V3_1;

    // Create permission validator with verifier's key
    const verifierSigner = await toECDSASigner({
      signer: verifierAccount
    });

    const easAbi = parseAbi([
      'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
    ]);

    const callPolicy = await toCallPolicy({
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

    const permissionValidator = await toPermissionValidator(publicClient, {
      signer: verifierSigner,
      policies: [callPolicy],
      entryPoint,
      kernelVersion
    });

    console.log('[delegated] Permission validator ID:', permissionValidator.getIdentifier());

    // Create Kernel account reference with explicit address
    const kernelAccount = await createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      address: req.userKernelAddress, // Reference existing account
      plugins: {
        sudo: permissionValidator // Use permission validator for signing
      }
    });

    const derivedAddress = await kernelAccount.getAddress();
    if (derivedAddress !== req.userKernelAddress) {
      throw new Error(`Address mismatch: expected ${req.userKernelAddress}, got ${derivedAddress}`);
    }

    console.log('[delegated] Kernel account referenced successfully');

    // Create Kernel client
    const kernelClient = await createKernelAccountClient({
      account: kernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(BUNDLER_RPC)
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

    console.log('[delegated] Sending UserOp...');

    // Send UserOp
    const txHash = await kernelClient.writeContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: 'attest',
      args: [attestationRequest]
    });

    console.log('[delegated] TX hash:', txHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log('[delegated] Receipt status:', receipt.status);

    // Parse attestation UID from logs
    const attestedLog = receipt.logs.find(log => 
      log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() &&
      log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35'
    );

    const attestationUid = attestedLog?.topics[3] as Hex | undefined;

    if (!attestationUid) {
      throw new Error('Failed to parse attestation UID from logs');
    }

    console.log('[delegated] Attestation UID:', attestationUid);

    return {
      success: true,
      attestationUid,
      txHash
    };
  } catch (e) {
    console.error('[delegated] Error:', e);
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}
