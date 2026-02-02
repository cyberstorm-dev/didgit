/**
 * End-to-end test: Permission-based attestation flow
 * 
 * Flow:
 * 1. User deploys/uses Kernel with ECDSA sudo validator
 * 2. User grants permission to verifier for EAS.attest calls
 * 3. Verifier uses permission to submit attestation (UserOp signed by verifier)
 */

import { createPublicClient, http, parseAbi, type Address, type Hex, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY || '0xfcb525413bd7c69608771c60e923c7dcb283caa07559f5bbfcffb86ed2bbd637';
const USER_PRIVKEY = process.env.USER_PRIVKEY || '0xbc92aa2df0e5bee540343a9b758f699c1e0d503ecb5314aae46b55280aa3c5c7';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782' as Hex;
const EXISTING_KERNEL = '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as Address;

async function main() {
  console.log('=== Permission-Based Attestation Flow Test ===\n');
  
  // Dynamic imports
  const { toPermissionValidator } = await import('@zerodev/permissions');
  const { toECDSASigner } = await import('@zerodev/permissions/signers');
  const { toCallPolicy, CallPolicyVersion } = await import('@zerodev/permissions/policies');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');
  const { createKernelAccount, createKernelAccountClient } = await import('@zerodev/sdk');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
  const { http: bundlerHttp } = await import('viem');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  const userAccount = privateKeyToAccount(USER_PRIVKEY as Hex);
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY as Hex);

  console.log('User EOA:', userAccount.address);
  console.log('Verifier EOA:', verifierAccount.address);

  // Step 1: Create user's sudo validator
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion
  });
  console.log('Sudo validator address:', sudoValidator.address);

  // Step 2: Create verifier's permission
  const verifierSigner = await toECDSASigner({
    signer: verifierAccount
  });

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

  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion
  });

  console.log('Permission ID:', permissionValidator.getIdentifier());

  // Step 3: Create kernel account with both validators
  // When using 'regular' plugin, the SDK enables it on first use
  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    address: EXISTING_KERNEL, // Use existing deployed kernel
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator
    }
  });

  console.log('Kernel address:', await kernelAccount.getAddress());

  // Check if kernel is deployed
  const code = await publicClient.getCode({ address: EXISTING_KERNEL });
  console.log('Kernel deployed:', code && code.length > 2 ? 'YES' : 'NO');

  // Check kernel balance
  const balance = await publicClient.getBalance({ address: EXISTING_KERNEL });
  console.log('Kernel balance:', Number(balance) / 1e18, 'ETH');

  // Step 4: The key test - can the verifier sign a UserOp?
  console.log('\n--- Testing UserOp Signing ---');
  
  // This simulates what the backend would do:
  // The verifier creates a UserOp for an attestation, signs it with their permission
  
  const testAttestData = encodeFunctionData({
    abi: easAbi,
    functionName: 'attest',
    args: [{
      schema: CONTRIBUTION_SCHEMA,
      data: {
        recipient: userAccount.address,
        expirationTime: 0n,
        revocable: true,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        data: '0x' as Hex,
        value: 0n
      }
    }]
  });

  console.log('Attest calldata length:', testAttestData.length / 2 - 1, 'bytes');

  // Use ZeroDev bundler
  const ZERODEV_PROJECT_ID = 'aa40f236-4eff-41e1-8737-ab95ab7e1850';
  const bundlerUrl = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/84532`;
  
  console.log('Bundler URL:', bundlerUrl);

  try {
    // Create kernel client with bundler
    const kernelClient = await createKernelAccountClient({
      account: kernelAccount,
      chain: baseSepolia,
      bundlerTransport: http(bundlerUrl),
      // No paymaster - kernel will pay gas from its own balance
    });

    console.log('Kernel client created');

    // Prepare a minimal attestation UserOp
    console.log('\n--- Sending Attestation UserOp ---');
    
    const txHash = await kernelClient.sendTransaction({
      to: EAS_ADDRESS,
      data: testAttestData,
      value: 0n
    });

    console.log('✅ Transaction submitted!');
    console.log('Hash:', txHash);
    console.log('Explorer: https://sepolia.basescan.org/tx/' + txHash);

  } catch (e: any) {
    console.error('\n❌ Transaction failed:');
    console.error('Error:', e.shortMessage || e.message);
    if (e.details) console.error('Details:', e.details);
    
    // Common issues:
    console.log('\nPossible causes:');
    console.log('- Insufficient gas in kernel account');
    console.log('- Permission not enabled on-chain yet');
    console.log('- Invalid attestation data');
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
