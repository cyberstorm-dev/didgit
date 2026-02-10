/**
 * Setup session key on existing Kernel
 * 
 * Goal: Allow attester to call EAS.attest() on behalf of user's Kernel
 * User's Kernel pays gas, attestation comes FROM user's address
 * 
 * This is a ONE-TIME setup script run during onboarding.
 * Requires USER_PRIVKEY only for this setup, not for runtime attestations.
 * 
 * The output is a serialized permission account that can be deserialized
 * at runtime using only the attester's private key.
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  createKernelAccount,
  createKernelAccountClient
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { 
  toPermissionValidator,
  serializePermissionAccount,
} from '@zerodev/permissions';
import { toCallPolicy, CallPolicyVersion } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http as viemHttp } from 'viem';
import { getConfig } from './config';
import { getAttesterPrivKey } from './env';

const ACTIVE = getConfig();
const EAS_ADDRESS = ACTIVE.easAddress as Address;
const ATTEST_SELECTOR = '0xf17325e7' as Hex; // attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))

async function main() {
  const USER_PRIVKEY = process.env.USER_PRIVKEY as Hex;
  const ATTESTER_PRIVKEY = getAttesterPrivKey() as Hex;
  const BUNDLER_RPC = process.env.BUNDLER_RPC;
  
  if (!USER_PRIVKEY) throw new Error('USER_PRIVKEY required for setup');
  if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC required');

  const userAccount = privateKeyToAccount(USER_PRIVKEY);
  const attesterAccount = privateKeyToAccount(ATTESTER_PRIVKEY);
  
  console.log('[setup] User EOA:', userAccount.address);
  console.log('[setup] Attester:', attesterAccount.address);

  const publicClient = createPublicClient({
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  const entryPoint = getEntryPoint('0.7');

  // Create ECDSA validator for the user (owner of the Kernel)
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  // Get the user's Kernel account
  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  console.log('[setup] Kernel address:', kernelAccount.address);

  // Check Kernel balance
  const balance = await publicClient.getBalance({ address: kernelAccount.address });
  console.log('[setup] Kernel balance:', Number(balance) / 1e18, 'ETH');

  if (balance < BigInt(1e15)) { // Less than 0.001 ETH
    console.log('[setup] ⚠️  Low balance - funding from attester...');
    
    const walletClient = createWalletClient({
      account: attesterAccount,
      chain: ACTIVE.chain,
      transport: http(ACTIVE.rpcUrl)
    });

    const fundTx = await walletClient.sendTransaction({
      to: kernelAccount.address,
      value: BigInt(5e15) // 0.005 ETH
    });
    console.log('[setup] Funded Kernel:', fundTx);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
  }

  // Create permission that allows attester to call EAS.attest()
  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: [
      {
        target: EAS_ADDRESS,
        selector: ATTEST_SELECTOR,
        valueLimit: BigInt(0)
      }
    ]
  });

  // Create ECDSA signer for attester (the session key holder)
  const attesterSigner = await toECDSASigner({
    signer: attesterAccount
  });

  // Create permission validator
  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: attesterSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  console.log('[setup] Permission ID:', permissionValidator.getIdentifier());

  // Create Kernel account with permission as regular validator
  // This is a combined account that can use either sudo OR permission validator
  const kernelWithPermission = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionValidator
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  console.log('[setup] Kernel with permission created:', kernelWithPermission.address);

  // Serialize the permission account
  // This captures everything needed to use the permission later:
  // - The enable signature (owner authorizing the permission)
  // - The permission policies
  // - The account address
  console.log('[setup] Serializing permission account...');
  
  const serialized = await serializePermissionAccount(kernelWithPermission, ATTESTER_PRIVKEY);
  
  console.log('[setup] ✓ Serialized permission account');
  console.log('[setup] Length:', serialized.length, 'chars');

  // Save to file for runtime use
  const fs = await import('fs');
  const outputPath = '.permission-account.json';
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ 
      kernelAddress: kernelWithPermission.address,
      serialized,
      attester: attesterAccount.address,
      userEOA: userAccount.address,
      easAddress: EAS_ADDRESS,
      createdAt: new Date().toISOString()
    }, null, 2)
  );
  console.log('[setup] ✓ Saved to', outputPath);
  console.log();
  console.log('Next steps:');
  console.log('1. Copy .permission-account.json to secure storage');
  console.log('2. At runtime, use deserializePermissionAccount() with ATTESTER_PRIVKEY');
  console.log('3. UserOps will be signed by the attester but executed from user\'s Kernel');
}

main().catch(console.error);
