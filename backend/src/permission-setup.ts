#!/usr/bin/env npx tsx
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import { attestPermission } from './attest-permission';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type RunOptions = {
  privateKey?: string;
  apiUrl?: string;
  apiKey?: string;
  kernelAddress?: string;
  fetchFn?: FetchFn;
  attestFn?: (args: { privateKey: string; kernelAddress: string; permissionData: string }) => Promise<{ tx: string; uid?: string }>;
  maxRetries?: number;
  retryDelayMs?: number;
};

function requireEnv(val: string | undefined, name: string) {
  if (!val) throw new Error(`${name} required`);
  return val;
}

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function resolvePermissionApiUrl(explicitUrl?: string) {
  const url = (explicitUrl || '').trim();
  if (!url) {
    return 'https://didgit-permission-blob.ops7622.workers.dev';
  }
  if (url.includes('didgit.dev')) {
    return 'https://didgit-permission-blob.ops7622.workers.dev';
  }
  return url;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withJitter(baseMs: number, attempt: number) {
  const max = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(max + jitter, 8000);
}

async function fetchWithRetry(fetchFn: FetchFn, url: string, init: RequestInit, opts: { maxRetries: number; retryDelayMs: number }) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const res = await fetchFn(url, init);
      if (res.ok) return res;
      const body = await res.text();
      const isRetryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!isRetryable || attempt === opts.maxRetries) {
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      lastError = new Error(`${res.status} ${res.statusText}: ${body}`);
    } catch (err) {
      lastError = err as Error;
      if (attempt === opts.maxRetries) break;
    }
    const delay = withJitter(opts.retryDelayMs, attempt);
    console.log(`[permission-setup] Retry ${attempt + 1}/${opts.maxRetries} in ${delay}ms...`);
    await sleep(delay);
  }
  throw lastError ?? new Error('Request failed');
}

export async function runPermissionSetup(opts: RunOptions = {}) {
  const privateKey = (opts.privateKey || process.env.PRIVATE_KEY || '').trim();
  const apiUrl = normalizeBaseUrl(
    resolvePermissionApiUrl(opts.apiUrl || process.env.PERMISSION_API_URL)
  );
  const apiKey = (opts.apiKey || process.env.PERMISSION_API_KEY || process.env.DIDGIT_API_KEY || 'ab95ab7e1850').trim();
  const kernelAddress = (opts.kernelAddress || process.env.KERNEL_ADDRESS || '').trim();
  const fetchFn: FetchFn = opts.fetchFn || fetch;
  const attestFn = opts.attestFn || attestPermission;
  const maxRetries = opts.maxRetries ?? Number(process.env.PERMISSION_SETUP_RETRIES || 3);
  const retryDelayMs = opts.retryDelayMs ?? Number(process.env.PERMISSION_SETUP_RETRY_DELAY_MS || 750);

  requireEnv(privateKey, 'PRIVATE_KEY');
  requireEnv(apiKey, 'PERMISSION_API_KEY');

  const account = privateKeyToAccount(privateKey as Hex);
  const userEOA = account.address;

  const prepareRes = await fetchWithRetry(fetchFn, `${apiUrl}/prepare`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userEOA, kernelAddress: kernelAddress || undefined })
  }, { maxRetries, retryDelayMs });
  const prepareJson = await prepareRes.json() as { typedData: any; kernelAddress: string };
  const typedData = prepareJson.typedData;
  const resolvedKernel = prepareJson.kernelAddress;

  const enableSignature = await account.signTypedData(typedData);

  const completeRes = await fetchWithRetry(fetchFn, `${apiUrl}/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userEOA, kernelAddress: resolvedKernel, enableSignature })
  }, { maxRetries, retryDelayMs });
  const completeJson = await completeRes.json() as { permissionData: string; kernelAddress: string };

  const permissionAttestation = await attestFn({
    privateKey,
    kernelAddress: completeJson.kernelAddress,
    permissionData: completeJson.permissionData
  });

  return {
    permissionData: completeJson.permissionData,
    kernelAddress: completeJson.kernelAddress,
    permissionUid: permissionAttestation?.uid
  };
}

async function main() {
  const result = await runPermissionSetup();
  console.log('Kernel:', result.kernelAddress);
  if (result.permissionUid) {
    console.log('Permission UID:', result.permissionUid);
  }
  console.log('PERMISSION_DATA:', result.permissionData);
}

const isMain = process.argv[1] && /permission-setup\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error('[permission-setup] Failed after retries.');
    console.error('[permission-setup] If this is a 429 or RPC rate-limit, switch BASE_RPC_URL to a higher-capacity provider and retry.');
    const msg = (err as Error)?.message || '';
    if (msg.includes('InvalidSchema') || msg.includes('Schema not found') || msg.includes('0xbf37b20e')) {
      console.error('[permission-setup] Schema not found on this chain. Re-run schema registration and set BASE_PERMISSION_SCHEMA_UID.');
    }
    console.error(err);
    process.exit(1);
  });
}
