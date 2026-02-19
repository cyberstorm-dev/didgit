import { stdin as input, stdout as output } from 'node:process';
import { parseArgs } from 'node:util';
import readline from 'node:readline/promises';
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  isHex,
  trim,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { DEFAULT_DOMAIN, DEFAULT_RESOLVER_ADDRESS, DEFAULT_RPC_URL, RESOLVER_ABI } from './shared.js';

export function validatePrivateKey(value) {
  if (!value) {
    throw new Error('WALLET_PRIVATE_KEY is required for write operations');
  }
  if (!value.startsWith('0x') || value.length !== 66) {
    throw new Error('WALLET_PRIVATE_KEY must be a 32-byte hex string (0x + 64 chars)');
  }
  return value;
}

export function validateAttestationUid(value) {
  if (!value) throw new Error('Attestation UID is required');
  if (!isHex(value) || trim(value).length !== 66) {
    throw new Error('Attestation UID must be a 32-byte hex string');
  }
  return value;
}

export function validateUsername(value) {
  if (!value) throw new Error('Username is required');
  const username = value.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(username)) {
    throw new Error('Username must be a valid GitHub handle (alphanumeric or hyphen, max 39 chars)');
  }
  return username;
}

export function validateDomain(value = DEFAULT_DOMAIN) {
  const domain = value.trim();
  if (!domain) throw new Error('Domain is required');
  return domain;
}

export function validateAddress(address, label = 'address') {
  if (!address) throw new Error(`${label} is required`);
  if (!isAddress(address)) throw new Error(`${label} is not a valid checksum/hex address`);
  return getAddress(address);
}

export function validateRpcUrl(value = DEFAULT_RPC_URL) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('RPC URL must be http(s)');
    }
    return url.toString();
  } catch (err) {
    throw new Error(`Invalid RPC URL: ${err.message}`);
  }
}

export function buildBindIdentityCall({ attestationUid, walletAddress, domain, username, resolverAddress = DEFAULT_RESOLVER_ADDRESS }) {
  const args = [attestationUid, walletAddress, domain, username];
  return {
    to: resolverAddress,
    args,
    data: encodeFunctionData({ abi: RESOLVER_ABI, functionName: 'bindIdentity', args }),
  };
}

export async function bindIdentityAction({
  walletClient,
  publicClient,
  attestationUid,
  walletAddress,
  domain,
  username,
  resolverAddress = DEFAULT_RESOLVER_ADDRESS,
  verify = true,
  dryRun = false,
}) {
  const call = buildBindIdentityCall({ attestationUid, walletAddress, domain, username, resolverAddress });

  if (dryRun) {
    return { hash: null, dryRun: true, callData: call.data, to: call.to, args: call.args };
  }

  const hash = await walletClient.writeContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'bindIdentity',
    args: call.args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  let boundWallet;
  if (verify) {
    boundWallet = await publicClient.readContract({
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'getIdentityOwner',
      args: [domain, username],
    });
  }

  return { hash, receipt, boundWallet };
}

export async function readIdentity({ publicClient, resolverAddress = DEFAULT_RESOLVER_ADDRESS, domain, username }) {
  const owner = await publicClient.readContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'getIdentityOwner',
    args: [domain, username],
  });

  const patterns = await publicClient.readContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'getRepositoryPatterns',
    args: [domain, username],
  });

  return { owner, patterns };
}

export function formatPatterns(patterns = []) {
  if (!patterns.length) return 'No patterns registered';
  return patterns
    .map((p) => `${p.enabled ? '✅' : '❌'} ${p.namespace}/${p.name}`)
    .join('\n');
}

export function decodeBindIdentityData(data) {
  return decodeFunctionData({ abi: RESOLVER_ABI, data });
}

export async function confirmDangerousAction(message, { yesFlag = false } = {}) {
  if (yesFlag) return true;
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${message}\nType "yes" to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    throw new Error('Aborted by user');
  }
  return true;
}

export function parseCliArgs() {
  return parseArgs({
    options: {
      attestation: { type: 'string', short: 'a' },
      username: { type: 'string', short: 'u' },
      wallet: { type: 'string', short: 'w' },
      domain: { type: 'string', default: DEFAULT_DOMAIN },
      resolver: { type: 'string', default: DEFAULT_RESOLVER_ADDRESS },
      rpcUrl: { type: 'string', default: DEFAULT_RPC_URL },
      yes: { type: 'boolean', default: false },
      dryRun: { type: 'boolean', default: false },
      expected: { type: 'string' },
    },
  }).values;
}

export function createClients({ rpcUrl, privateKey }) {
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { account, walletClient, publicClient };
}

export function createPublicResolverClient({ rpcUrl }) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

export function identitySummary({ domain, username, wallet }) {
  return `${domain}:${username} -> ${wallet}`;
}
