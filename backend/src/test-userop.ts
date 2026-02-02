/**
 * Test: Can we create a UserOp for user's wallet signed by verifier?
 */
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
const USER_WALLET = '0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd' as Address; // cyberstorm-nisto's wallet
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021' as Address;

async function test() {
  const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
  
  console.log('Verifier:', verifierAccount.address);
  console.log('User wallet:', USER_WALLET);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0])
  });

  // Try to create a Kernel account for the USER, but use VERIFIER as signer
  const { createKernelAccount } = await import('@zerodev/sdk');
  const { signerToEcdsaValidator } = await import('@zerodev/ecdsa-validator');
  const { getEntryPoint, KERNEL_V3_1 } = await import('@zerodev/sdk/constants');

  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_1;

  // This creates a validator with verifier's key
  const verifierValidator = await signerToEcdsaValidator(publicClient, {
    signer: verifierAccount,
    entryPoint,
    kernelVersion
  });

  // This will create an account derived from verifier's key
  // NOT the user's existing account
  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: verifierValidator
    }
  });

  const address = await kernelAccount.getAddress();
  console.log('Kernel account address:', address);
  console.log('Matches user wallet?', address.toLowerCase() === USER_WALLET.toLowerCase());

  // This won't match because Kernel derives the account address from the signer
  // We need a different approach
}

test().catch(console.error);
