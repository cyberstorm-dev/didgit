#!/usr/bin/env npx tsx
/**
 * Setup Session Key Permission - Two-step CLI
 * 
 * For agents (have private key):
 *   USER_PRIVKEY=0x... npx tsx src/setup-permission.ts
 * 
 * For humans (external signer):
 *   Step 1: npx tsx src/setup-permission.ts --prepare 0xYourEOA
 *           → Outputs message to sign
 *   Step 2: npx tsx src/setup-permission.ts --complete 0xYourEOA 0xSignature
 *           → Creates permission account
 */

import 'dotenv/config';
import { createPublicClient, http, type Address, type Hex, hashMessage, recoverAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
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
import * as fs from 'fs';

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;
const ATTEST_SELECTOR = '0xf17325e7' as Hex;

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const BUNDLER_RPC = process.env.BUNDLER_RPC;

if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY required in .env');
if (!BUNDLER_RPC) throw new Error('BUNDLER_RPC required in .env');

const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

const entryPoint = getEntryPoint('0.7');

async function getKernelAddress(userEOA: Address): Promise<Address> {
  // Create a local account just to compute Kernel address
  // The Kernel address is deterministic based on owner
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: { address: userEOA, type: 'local' } as any,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const kernel = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  return kernel.address;
}

async function setupWithPrivateKey(userPrivKey: Hex) {
  const userAccount = privateKeyToAccount(userPrivKey);
  console.log('\n🔑 Setting up session key permission...\n');
  console.log('User EOA:', userAccount.address);
  console.log('Verifier:', verifierAccount.address);

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: userAccount,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  console.log('Kernel:', kernelAccount.address);

  const balance = await publicClient.getBalance({ address: kernelAccount.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(6), 'ETH');

  if (balance < BigInt(1e15)) {
    console.log('\n⚠️  Low balance - funding Kernel...');
    const { createWalletClient } = await import('viem');
    const walletClient = createWalletClient({
      account: verifierAccount,
      chain: baseSepolia,
      transport: http()
    });
    const tx = await walletClient.sendTransaction({
      to: kernelAccount.address,
      value: BigInt(5e15)
    });
    console.log('Funded:', tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  // Create permission
  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: [{
      target: EAS_ADDRESS,
      selector: ATTEST_SELECTOR,
      valueLimit: BigInt(0)
    }]
  });

  const verifierSigner = await toECDSASigner({ signer: verifierAccount });

  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: verifierSigner,
    policies: [callPolicy],
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const kernelWithPermission = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionValidator
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  });

  const serialized = await serializePermissionAccount(kernelWithPermission, VERIFIER_PRIVKEY);

  // Save
  const output = {
    kernelAddress: kernelWithPermission.address,
    userEOA: userAccount.address,
    verifier: verifierAccount.address,
    serialized,
    createdAt: new Date().toISOString()
  };

  const filename = `.permission-${userAccount.address.slice(2, 10).toLowerCase()}.json`;
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));

  console.log('\n✅ Permission created!');
  console.log('Saved to:', filename);
  console.log('\nThe verifier can now attest on behalf of this Kernel.');
}

function printUsage() {
  console.log(`
🔐 Session Key Permission Setup

OPTION 1 - Direct (for agents with private key):
  USER_PRIVKEY=0x... npx tsx src/setup-permission.ts

OPTION 2 - External signer (for hardware wallets / mobile):
  Step 1: npx tsx src/setup-permission.ts --prepare 0xYourEOA
  Step 2: Sign the message with your wallet
  Step 3: npx tsx src/setup-permission.ts --complete 0xYourEOA 0xSignature

Currently configured verifier: ${verifierAccount.address}
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Direct mode with private key
  const userPrivKey = process.env.USER_PRIVKEY as Hex;
  if (userPrivKey && args.length === 0) {
    await setupWithPrivateKey(userPrivKey);
    return;
  }

  // Two-step mode
  if (args[0] === '--prepare' && args[1]) {
    const userEOA = args[1] as Address;
    const kernelAddress = await getKernelAddress(userEOA);
    
    // Create a deterministic message to sign
    const message = `didgit.dev session key authorization

I authorize the following verifier to create attestations on my behalf:
Verifier: ${verifierAccount.address}
Kernel: ${kernelAddress}
Chain: Base Sepolia (84532)
Scope: EAS.attest() only

Timestamp: ${Math.floor(Date.now() / 1000)}`;

    console.log('\n📝 Sign this message with your wallet:\n');
    console.log('---MESSAGE START---');
    console.log(message);
    console.log('---MESSAGE END---\n');
    console.log('Message hash:', hashMessage(message));
    console.log('\nAfter signing, run:');
    console.log(`npx tsx src/setup-permission.ts --complete ${userEOA} 0xYOUR_SIGNATURE`);
    return;
  }

  if (args[0] === '--complete' && args[1] && args[2]) {
    console.log('\n⚠️  External signer flow requires SDK modifications.');
    console.log('For now, please use the direct private key method.');
    console.log('\nAlternatively, export your key temporarily:');
    console.log(`USER_PRIVKEY=0x... npx tsx src/setup-permission.ts`);
    return;
  }

  printUsage();
}

main().catch(console.error);
