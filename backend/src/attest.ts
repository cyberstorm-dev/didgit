import { createPublicClient, http, type Address, type Hex, parseAbi, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC as string;
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
}

export async function attestCommit(req: AttestCommitRequest): Promise<{ success: boolean; attestationUid?: Hex; error?: string }> {
  try {
    if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY not set');
    if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC not set');

    const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
    console.log('Verifier:', verifierAccount.address);

    // Create the attestation data
    const attestationData = {
      schema: CONTRIBUTION_SCHEMA_UID,
      data: {
        recipient: req.userWalletAddress,
        expirationTime: 0n,
        revocable: true,
        refUID: req.identityAttestationUid,
        data: encodeContributionData({
          commitHash: req.commitHash,
          repoName: `${req.repoOwner}/${req.repoName}`,
          timestamp: BigInt(Math.floor(Date.now() / 1000))
        }),
        value: 0n
      }
    };

    // For now, we'll use the verifier's account to call EAS directly
    // TODO: Create UserOp for user's Kernel wallet
    // For MVP testing: verifier pays gas (not ideal, but functional)
    
    const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
    const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
    const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0])
    });

    const entryPoint = getEntryPoint('0.7');
    const kernelVersion = KERNEL_V3_1;

    // Create verifier's own Kernel account (for testing)
    const validator = await signerToEcdsaValidator(publicClient, {
      signer: verifierAccount,
      entryPoint,
      kernelVersion
    });

    const kernelAccount = await createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      plugins: {
        sudo: validator
      }
    });

    const kernelClient = await createKernelAccountClient({
      account: kernelAccount,
      client: publicClient,
      bundlerTransport: http(BUNDLER_RPC)
    });

    console.log('Kernel account:', await kernelAccount.getAddress());

    // Call EAS.attest via UserOp
    const callData = encodeFunctionData({
      abi: easAbi,
      functionName: 'attest',
      args: [attestationData]
    });

    const userOpHash = await kernelClient.sendUserOperation({
      calls: [{
        to: EAS_ADDRESS,
        data: callData,
        value: 0n
      }]
    });

    console.log('UserOp hash:', userOpHash);

    const receipt = await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash
    });

    console.log('Receipt:', receipt);

    // TODO: Parse logs to get attestation UID
    const attestationUid = '0x...' as Hex; // Placeholder

    return {
      success: true,
      attestationUid
    };
  } catch (e) {
    console.error('Attestation error:', e);
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}

function encodeContributionData(data: { commitHash: string; repoName: string; timestamp: bigint }): Hex {
  // TODO: Properly encode according to Contribution Schema
  // For now, use a simple encoding
  const abiCoder = parseAbi(['function encode(bytes32,string,uint64)']);
  // This is a placeholder - need to match actual schema encoding
  return '0x' as Hex;
}
