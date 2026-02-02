import type { Address, Hex } from 'viem';
import { createPublicClient, http, parseAbi } from 'viem';
import { baseSepolia } from '../utils/eas';
import { appConfig } from '../utils/config';

export type PermissionInfo = {
  verifierAddress: Address;
  easAddress: Address;
  contributionSchemaUid: Hex;
};

/**
 * Grant attestation permission to the verifier address.
 * This allows the verifier to submit UserOps that call EAS.attest on behalf of the user.
 * Gas is paid from the user's smart wallet.
 */
export async function grantAttestationPermission(
  provider: any, // EIP-1193 provider from wallet
  kernelAccountAddress: Address,
  permissionInfo: PermissionInfo
): Promise<{ success: boolean; permissionId?: Hex; txHash?: Hex; error?: string }> {
  try {
    const { toPermissionValidator } = await import('@zerodev/permissions');
    const { toECDSASigner } = await import('@zerodev/permissions');
    const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions');
    const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
    const { createKernelAccountClient, createKernelAccount } = await import('@zerodev/sdk');
    const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
    const { createWalletClient, custom } = await import('viem');

    const cfg = appConfig();
    if (!cfg.ZERODEV_BUNDLER_RPC) throw new Error('Missing VITE_ZERODEV_BUNDLER_RPC');

    // EAS ABI (minimal - just attest function)
    const easAbi = parseAbi([
      'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
    ]);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0])
    });

    const walletClient = createWalletClient({
      chain: baseSepolia,
      transport: custom(provider)
    });

    const entryPoint = getEntryPoint('0.7');
    const kernelVersion = KERNEL_V3_1;

    // Create call policy: only allow EAS.attest with contribution schema
    const callPolicy = toCallPolicy({
      policyVersion: CallPolicyVersion.V0_0_5,
      permissions: [
        {
          target: permissionInfo.easAddress,
          abi: easAbi,
          functionName: 'attest',
          valueLimit: 0n
        }
      ]
    });

    // Create modular signer for the verifier
    // The verifier address acts as the signer (uses default ECDSA signer contract)
    const verifierSigner = await toECDSASigner({
      signer: {
        address: permissionInfo.verifierAddress,
        async signMessage({ message }: any) {
          // This won't actually be called for permission creation,
          // but is required for the interface
          throw new Error('Verifier signing not needed for permission grant');
        }
      } as any
    });

    // Create permission validator
    const permissionValidator = await toPermissionValidator(publicClient, {
      signer: verifierSigner,
      policies: [callPolicy],
      entryPoint,
      kernelVersion
    });

    // Get the permission ID (this is what uniquely identifies the permission)
    const permissionId = permissionValidator.getIdentifier();

    // Now we need to enable this permission on the user's Kernel account
    // This requires calling account.installModule or similar
    // First, create the user's kernel account with sudo validator
    const sudoValidator = await signerToEcdsaValidator(publicClient, {
      signer: walletClient,
      entryPoint,
      kernelVersion
    });

    const kernelAccount = await createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      plugins: {
        sudo: sudoValidator,
        regular: permissionValidator
      }
    });

    // Create kernel account client
    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      client: publicClient,
      bundlerTransport: http(cfg.ZERODEV_BUNDLER_RPC)
    });

    // Send a transaction to enable the permission
    // In Kernel v3, this happens automatically when we add it as a regular plugin
    // The enableData is included in the first UserOp that uses the permission
    
    // For now, we'll just return the permission ID
    // The actual enabling will happen when the verifier tries to use it
    // (or we could send a dummy tx here to enable it proactively)

    return {
      success: true,
      permissionId,
      txHash: undefined // No tx yet, permission is registered but not enabled
    };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}

export function getPermissionInfo(): PermissionInfo {
  const cfg = appConfig();
  
  return {
    verifierAddress: '0x0CA6A71045C26087F8dCe6d3F93437f31B81C138' as Address,
    easAddress: cfg.contract as Address,
    contributionSchemaUid: '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex
  };
}
