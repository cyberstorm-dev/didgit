/**
 * Attestation via Permission-based Smart Account
 * 
 * Flow:
 * 1. User's Kernel has granted permission to verifier for EAS.attest
 * 2. Verifier creates UserOp, signs with permission
 * 3. Kernel executes attestation (user's account is attester)
 */

import { createPublicClient, http, type Address, type Hex, parseAbi, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const ZERODEV_PROJECT_ID = process.env.ZERODEV_PROJECT_ID || 'aa40f236-4eff-41e1-8737-ab95ab7e1850';

const easAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
]);

export interface UserKernelInfo {
  kernelAddress: Address;
  userEOA: Address;  // For sudo validator reconstruction
}

export interface AttestCommitRequest {
  user: UserKernelInfo;
  identityAttestationUid: Hex;
  commitHash: string;
  repoOwner: string;
  repoName: string;
  author: string;
  message: string;
}

/**
 * Create the permission validator for verifier
 * This must match what the user authorized
 */
async function createVerifierPermission(publicClient: any, verifierAccount: any, entryPoint: any, kernelVersion: any) {
  const { toPermissionValidator } = await import('@zerodev/permissions');
  const { toECDSASigner } = await import('@zerodev/permissions/signers');
  const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions/policies');

  const verifierSigner = await toECDSASigner({
    signer: verifierAccount
  });

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

  return await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion
  });
}

export async function attestCommitWithKernel(req: AttestCommitRequest): Promise<{ success: boolean; attestationUid?: Hex; txHash?: Hex; error?: string }> {
  try {
    const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
    if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY not set');

    // Dynamic imports
    const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
    const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
    const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    });

    const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
    const userAccount = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001' as Hex); // Dummy - we only need address
    
    console.log('[attest] Verifier:', verifierAccount.address);
    console.log('[attest] User kernel:', req.user.kernelAddress);
    console.log('[attest] Commit:', req.commitHash.slice(0, 12));

    const entryPoint = getEntryPoint('0.7');
    const kernelVersion = KERNEL_V3_1;

    // Create sudo validator (need user's actual key for account reconstruction)
    // For now, we use the user's EOA to reconstruct the validator
    const USER_PRIVKEY = process.env.USER_PRIVKEY as Hex;
    if (!USER_PRIVKEY) throw new Error('USER_PRIVKEY not set (needed for kernel account reconstruction)');
    
    const actualUserAccount = privateKeyToAccount(USER_PRIVKEY);
    
    const sudoValidator = await signerToEcdsaValidator(publicClient, {
      signer: actualUserAccount,
      entryPoint,
      kernelVersion
    });

    // Create permission validator for verifier
    const permissionValidator = await createVerifierPermission(
      publicClient,
      verifierAccount,
      entryPoint,
      kernelVersion
    );

    console.log('[attest] Permission ID:', permissionValidator.getIdentifier());

    // Create kernel account with permission validator as active
    const kernelAccount = await createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      address: req.user.kernelAddress,
      plugins: {
        sudo: sudoValidator,
        regular: permissionValidator
      }
    });

    // Create kernel client with bundler
    const bundlerUrl = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/84532`;
    
    const kernelClient = await createKernelAccountClient({
      account: kernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(bundlerUrl),
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

    // Create attestation calldata
    const attestCalldata = encodeFunctionData({
      abi: easAbi,
      functionName: 'attest',
      args: [{
        schema: CONTRIBUTION_SCHEMA_UID,
        data: {
          recipient: req.user.userEOA,
          expirationTime: 0n,
          revocable: true,
          refUID: req.identityAttestationUid,
          data: contributionData,
          value: 0n
        }
      }]
    });

    console.log('[attest] Sending UserOp via bundler...');

    // Send transaction via kernel (verifier signs with permission)
    const txHash = await kernelClient.sendTransaction({
      to: EAS_ADDRESS,
      data: attestCalldata,
      value: 0n
    });

    console.log('[attest] TX hash:', txHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log('[attest] Status:', receipt.status === 'success' ? '✅' : '❌');

    // Parse attestation UID from logs
    const attestedLog = receipt.logs.find((log: any) => 
      log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() &&
      log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35'
    );

    const attestationUid = attestedLog?.data?.slice(0, 66) as Hex | undefined;

    if (!attestationUid) {
      throw new Error('Failed to parse attestation UID from logs');
    }

    console.log('[attest] Attestation UID:', attestationUid);

    return {
      success: true,
      attestationUid,
      txHash
    };
  } catch (e: any) {
    console.error('[attest] Error:', e);
    return {
      success: false,
      error: e.shortMessage || e.message || 'Unknown error'
    };
  }
}
