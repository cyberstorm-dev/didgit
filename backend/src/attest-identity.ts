#!/usr/bin/env npx tsx
import { createWalletClient, createPublicClient, http, encodeAbiParameters, parseAbiParameters, parseEventLogs, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { CONFIG, getConfig } from './config';

/*
 * Identity attestation helper (Base Sepolia)
 * Usage (env only):
 *   PRIVATE_KEY=0x... GITHUB_USERNAME=alice WALLET_ADDRESS=0x... SIGNATURE=0x... GIST_URL=https://gist... \
 *   pnpm run attest:identity
 */

const ACTIVE = getConfig();
const EAS = ACTIVE.easAddress;
const SCHEMA = ACTIVE.identitySchemaUid;

async function main() {
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || '').trim();
  const GITHUB_USERNAME = (process.env.GITHUB_USERNAME || '').trim();
  const WALLET_ADDRESS = (process.env.WALLET_ADDRESS || '').trim();
  const SIGNATURE = (process.env.SIGNATURE || '').trim();
  const GIST_URL = (process.env.GIST_URL || '').trim();

  await attestIdentity({
    privateKey: PRIVATE_KEY,
    githubUsername: GITHUB_USERNAME,
    walletAddress: WALLET_ADDRESS,
    signature: SIGNATURE,
    gistUrl: GIST_URL
  });
}

const isMain = process.argv[1] && /attest-identity\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export async function attestIdentity(input: {
  privateKey: string;
  githubUsername: string;
  walletAddress: string;
  signature: string;
  gistUrl: string;
}) {
  const PRIVATE_KEY = input.privateKey.trim();
  const GITHUB_USERNAME = input.githubUsername.trim();
  const WALLET_ADDRESS = input.walletAddress.trim();
  const SIGNATURE = input.signature.trim();
  const GIST_URL = input.gistUrl.trim();

  if (!PRIVATE_KEY.startsWith('0x')) throw new Error('PRIVATE_KEY required (0x-prefixed)');
  if (!GITHUB_USERNAME) throw new Error('GITHUB_USERNAME required');
  if (!WALLET_ADDRESS.startsWith('0x')) throw new Error('WALLET_ADDRESS required (0x-prefixed)');
  if (!SIGNATURE.startsWith('0x')) throw new Error('SIGNATURE required (0x-prefixed)');
  if (!GIST_URL) throw new Error('GIST_URL required');

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: ACTIVE.chain, transport: http(ACTIVE.rpcUrl) });

  const entryPoint = getEntryPoint('0.7');
  const ecdsa = await signerToEcdsaValidator(publicClient, { signer: account, entryPoint, kernelVersion: KERNEL_V3_1 });
  const kernel = await createKernelAccount(publicClient, { plugins: { sudo: ecdsa }, entryPoint, kernelVersion: KERNEL_V3_1 });

  console.log('Submitting identity attestation for', GITHUB_USERNAME, '→', WALLET_ADDRESS);
  console.log('Kernel:', kernel.address);

  const eoaBalance = await publicClient.getBalance({ address: account.address });
  const eoaBalanceEth = Number(formatEther(eoaBalance));
  if (eoaBalanceEth < CONFIG.minBalanceEth.eoaForIdentity) {
    console.log('Warning: low EOA balance:', eoaBalanceEth, 'ETH');
  if (ACTIVE.faucetUrl) {
    console.log('Faucet:', ACTIVE.faucetUrl);
  }
    throw new Error('Insufficient funds for identity attestation');
  }

  const kernelBalance = await publicClient.getBalance({ address: kernel.address });
  const kernelBalanceEth = Number(formatEther(kernelBalance));
  if (kernelBalanceEth >= CONFIG.maxKernelTopUpEth) {
    console.log('Kernel balance:', kernelBalanceEth, 'ETH (skip top-up)');
  } else if (kernelBalanceEth < CONFIG.minBalanceEth.kernelForAttestations) {
    console.log('Kernel balance:', kernelBalanceEth, 'ETH (below recommended)');
  } else {
    console.log('Kernel balance:', kernelBalanceEth, 'ETH');
  }

  const data = encodeAbiParameters(
    parseAbiParameters('string domain,string username,address wallet,string message,bytes signature,string proof_url'),
    [
      'github.com',
      GITHUB_USERNAME,
      WALLET_ADDRESS as `0x${string}`,
      `github.com:${GITHUB_USERNAME}`,
      SIGNATURE as `0x${string}`,
      GIST_URL
    ]
  );

  const easAbi = [{
    name: 'attest',
    type: 'function',
    inputs: [{ name: 'request', type: 'tuple', components: [
      { name: 'schema', type: 'bytes32' },
      { name: 'data', type: 'tuple', components: [
        { name: 'recipient', type: 'address' },
        { name: 'expirationTime', type: 'uint64' },
        { name: 'revocable', type: 'bool' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'uint256' }
      ]}
    ]}],
    outputs: [{ name: '', type: 'bytes32' }]
  }, {
    name: 'Attested',
    type: 'event',
    inputs: [
      { name: 'uid', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'attester', type: 'address', indexed: true },
      { name: 'schema', type: 'bytes32', indexed: false }
    ]
  }] as const;

  const req = {
    schema: SCHEMA,
    data: {
      recipient: WALLET_ADDRESS as `0x${string}`,
      expirationTime: 0n,
      revocable: true,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      value: 0n
    }
  };

  const tx = await walletClient.writeContract({ address: EAS, abi: easAbi, functionName: 'attest', args: [req] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  const parsed = parseEventLogs({ abi: easAbi, logs: receipt.logs, eventName: 'Attested' });
  const fallback = receipt.logs.find(
    (l) => l.address.toLowerCase() === EAS.toLowerCase() && (l.topics?.length || 0) > 1
  );
  const uid = parsed[0]?.args?.uid ?? fallback?.topics?.[1];

  console.log('TX:', tx);
  console.log('UID:', uid);
  console.log('Basescan URL:', `${ACTIVE.explorers.basescanTx}/${tx}`);
  if (uid) {
    console.log('EASscan URL:', `${ACTIVE.explorers.easAttestation}/${uid}`);
  }
  console.log('EASscan Address:', `${ACTIVE.explorers.easAddress}/${WALLET_ADDRESS}`);
  return { tx, uid, kernelAddress: kernel.address };
}
