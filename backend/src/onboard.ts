#!/usr/bin/env npx tsx
import { Octokit } from '@octokit/rest';
import { privateKeyToAccount } from 'viem/accounts';
import { attestIdentity } from './attest-identity';
import { getConfig } from './config';
import { runPermissionSetup } from './permission-setup';

const ACTIVE = getConfig();
const IDENTITY_SCHEMA = ACTIVE.identitySchemaUid;

export type Inputs = {
  githubUsername: string;
  privateKey: string;
  walletAddress: string;
  message: string;
  signature: string;
  gistUrl: string;
  githubToken: string;
};

function readInputs(): Inputs {
  const githubUsername = (process.env.GITHUB_USERNAME || '').trim();
  const privateKey = (process.env.PRIVATE_KEY || '').trim();
  const walletAddress = (process.env.WALLET_ADDRESS || '').trim();
  const message = (process.env.MESSAGE || '').trim();
  const signature = (process.env.SIGNATURE || '').trim();
  const gistUrl = (process.env.GIST_URL || '').trim();
  const githubToken = (process.env.GITHUB_TOKEN || process.env.YOUR_GITHUB_TOKEN || '').trim();
  return { githubUsername, privateKey, walletAddress, message, signature, gistUrl, githubToken };
}

function assertEnv(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function buildGistPayload(input: { githubUsername: string; walletAddress: string; signature: string }) {
  return {
    domain: 'github.com',
    username: input.githubUsername,
    wallet: input.walletAddress,
    message: `github.com:${input.githubUsername}`,
    signature: input.signature,
    chain_id: 84532,
    schema_uid: IDENTITY_SCHEMA
  };
}

async function createGist(token: string, payload: Record<string, string | number>) {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.gists.create({
    description: 'didgit.dev identity proof',
    public: true,
    files: {
      'didgit-proof.json': {
        content: JSON.stringify(payload, null, 2)
      }
    }
  });
  return data.html_url;
}

type RunOnboardOptions = {
  inputs?: Inputs;
  createGistFn?: (token: string, payload: Record<string, string | number>) => Promise<string>;
  attestIdentityFn?: typeof attestIdentity;
  permissionSetupFn?: typeof runPermissionSetup;
};

export async function runOnboard(options: RunOnboardOptions = {}) {
  const inputs = options.inputs || readInputs();
  const createGistFn = options.createGistFn || createGist;
  const attestIdentityFn = options.attestIdentityFn || attestIdentity;
  const permissionSetupFn = options.permissionSetupFn || runPermissionSetup;

  assertEnv(inputs.githubUsername, 'GITHUB_USERNAME required');
  assertEnv(inputs.privateKey.startsWith('0x'), 'PRIVATE_KEY required (0x-prefixed)');

  const account = privateKeyToAccount(inputs.privateKey as `0x${string}`);
  const walletAddress = inputs.walletAddress || account.address;
  const message = inputs.message || `github.com:${inputs.githubUsername}`;

  let signature = inputs.signature;
  if (!signature) {
    signature = await account.signMessage({ message });
  }

  let gistUrl = inputs.gistUrl;
  if (!gistUrl) {
    if (inputs.githubToken) {
      const payload = buildGistPayload({
        githubUsername: inputs.githubUsername,
        walletAddress,
        signature
      });
      gistUrl = await createGistFn(inputs.githubToken, payload);
      console.log('Gist:', gistUrl);
    } else {
      const payload = buildGistPayload({
        githubUsername: inputs.githubUsername,
        walletAddress,
        signature
      });
      console.log('No GITHUB_TOKEN found. Create a public gist named didgit-proof.json with:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('Then export GIST_URL and rerun.');
      process.exit(1);
    }
  }

  await attestIdentityFn({
    privateKey: inputs.privateKey,
    githubUsername: inputs.githubUsername,
    walletAddress,
    signature,
    gistUrl
  });

  await permissionSetupFn({
    privateKey: inputs.privateKey
  });

  return { gistUrl, walletAddress };
}

async function main() {
  await runOnboard();
}

const isMain = process.argv[1] && /onboard\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
