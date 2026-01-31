import { baseSepolia } from '../utils/eas';
import type { Address, Hex } from 'viem';
import { createPublicClient, http, createWalletClient, custom, type Client } from 'viem';
import { appConfig } from '../utils/config';

export type ZeroDevAA = {
  getAddress: () => Promise<Address>;
  sendUserOp: (args: { to: Address; data: Hex; value?: bigint }) => Promise<string>;
  waitForUserOp: (hash: string) => Promise<any>;
  debugTryEp: (ep: '0.6' | '0.7') => Promise<{ ok: boolean; message: string }>;
};

export async function createZeroDevClient(provider: any, _projectId: string): Promise<ZeroDevAA> {
  const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
  const cfg = appConfig();
  if (!cfg.ZERODEV_BUNDLER_RPC) throw new Error('Missing VITE_ZERODEV_BUNDLER_RPC');

  // Base RPC client (execution)
  const execClient: Client = createPublicClient({ chain: baseSepolia, transport: http(baseSepolia.rpcUrls.default.http[0]) }) as any;

  // Prefer injected EOA signer (if available), else use provided provider
  const walletClient = createWalletClient({ chain: baseSepolia, transport: custom(provider) });

  // Switch to EP 0.7 + Kernel v3.1 per diagnostics
  const entryPoint = getEntryPoint('0.7') as any;
  const kernelVersion = KERNEL_V3_1 as any;

  // Build ECDSA validator (sudo only) and create Kernel account
  const ecdsa = await (signerToEcdsaValidator as any)(execClient, {
    signer: walletClient,
    entryPoint,
    kernelVersion,
  });
  const account = await (createKernelAccount as any)(execClient, {
    entryPoint,
    kernelVersion,
    plugins: { sudo: ecdsa },
  });

  const bundlerTransport = http(cfg.ZERODEV_BUNDLER_RPC);
  const kac = (createKernelAccountClient as any)({
    account,
    client: execClient,
    bundlerTransport,
    userOperation: {
      estimateFeesPerGas: async () => {
        const fees = await (execClient as any).estimateFeesPerGas();
        return {
          maxFeePerGas: fees.maxFeePerGas ?? fees.gasPrice ?? 0n,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0n,
        };
      },
    },
  });

  return {
    getAddress: async () => (account as any).address as Address,
    sendUserOp: async ({ to, data, value }) => {
      // Let the client prepare, estimate, sign, and send end-to-end
      const hash: string = await (kac as any).sendUserOperation({
        calls: [{ to, data, value: value ?? 0n }],
      });
      return hash;
    },
    waitForUserOp: async (hash: string) => (kac as any).waitForUserOperationReceipt({ hash }),
    debugTryEp: async (ep: '0.6' | '0.7') => {
      try {
        const { createKernelAccount } = await import('@zerodev/sdk');
        const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
        const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
        const entryPoint2 = getEntryPoint(ep) as any;
        const kernelVersion2 = (ep === '0.6' ? '0.2.4' : KERNEL_V3_1) as any;
        const ecdsa2 = await (signerToEcdsaValidator as any)(execClient, {
          signer: walletClient,
          entryPoint: entryPoint2,
          kernelVersion: kernelVersion2,
        });
        const account2 = await (createKernelAccount as any)(execClient, {
          entryPoint: entryPoint2,
          kernelVersion: kernelVersion2,
          plugins: { sudo: ecdsa2 },
        });
        const addr = await (account2 as any).getAddress();
        // Keep diagnostics simple & robust: just verify we can construct account & address for the EP.
        return { ok: true, message: `EP ${ep} constructed (address ${addr})` };
      } catch (e) {
        return { ok: false, message: (e as Error).message ?? 'unknown error' };
      }
    },
  } satisfies ZeroDevAA;
}
