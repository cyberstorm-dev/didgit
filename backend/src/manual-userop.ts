/**
 * Manual UserOp construction for existing Kernel accounts
 * 
 * Instead of using ZeroDev SDK to create accounts, we manually construct
 * UserOps for existing accounts and submit to bundler.
 */

import { createPublicClient, http, type Address, type Hex, encodeAbiParameters, parseAbiParameters, encodeFunctionData, parseAbi, keccak256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

type UserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
};

export async function createAttestationUserOp(
  userKernelAddress: Address,
  easCallData: Hex,
  verifierPrivateKey: Hex
): Promise<UserOperation> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0])
  });

  const verifierAccount = privateKeyToAccount(verifierPrivateKey);

  // Get nonce from Kernel account
  // Kernel v3 uses a key-based nonce system
  const nonce = 0n; // TODO: Get actual nonce from account

  // Encode the execute call
  // Kernel v3: execute(address target, uint256 value, bytes calldata data)
  const kernelExecuteAbi = parseAbi([
    'function execute(address target, uint256 value, bytes calldata data)'
  ]);

  const executeCallData = encodeFunctionData({
    abi: kernelExecuteAbi,
    functionName: 'execute',
    args: [
      '0x4200000000000000000000000000000000000021' as Address, // EAS
      0n,
      easCallData
    ]
  });

  // Get gas estimates
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  const userOp: UserOperation = {
    sender: userKernelAddress,
    nonce,
    initCode: '0x', // Account already exists
    callData: executeCallData,
    callGasLimit: 1000000n, // TODO: Estimate properly
    verificationGasLimit: 500000n,
    preVerificationGas: 100000n,
    maxFeePerGas: maxFeePerGas || 0n,
    maxPriorityFeePerGas: maxPriorityFeePerGas || 0n,
    paymasterAndData: '0x', // User pays
    signature: '0x' // Will be filled after hashing
  };

  // Create UserOp hash
  const userOpHash = getUserOpHash(userOp, ENTRYPOINT_V07, baseSepolia.id);

  // Sign with verifier key
  // The signature format depends on the validator
  // For permission validator: need to include validator identifier + signature
  const signature = await verifierAccount.signMessage({
    message: { raw: userOpHash }
  });

  // Permission validator signature format (approximate):
  // 0xff (flag) + signature
  userOp.signature = `0xff${signature.slice(2)}` as Hex;

  return userOp;
}

function getUserOpHash(userOp: UserOperation, entryPoint: Address, chainId: number): Hex {
  // Pack UserOp
  const packed = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256, bytes32, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32'),
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData)
      ]
    )
  );

  // Hash with entrypoint and chainId
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, uint256'),
      [packed, entryPoint, BigInt(chainId)]
    )
  );
}

export async function submitUserOp(
  userOp: UserOperation,
  bundlerRpc: string
): Promise<string> {
  const response = await fetch(bundlerRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOp, ENTRYPOINT_V07]
    })
  });

  const result = await response.json() as { error?: { message: string }; result?: string };
  
  if (result.error) {
    throw new Error(`Bundler error: ${result.error.message}`);
  }

  if (!result.result) {
    throw new Error('Bundler returned no result');
  }

  return result.result; // UserOp hash
}
