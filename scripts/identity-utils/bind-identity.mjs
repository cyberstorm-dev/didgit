#!/usr/bin/env node
import {
  bindIdentityAction,
  confirmDangerousAction,
  createClients,
  identitySummary,
  parseCliArgs,
  validateAddress,
  validateAttestationUid,
  validateDomain,
  validatePrivateKey,
  validateRpcUrl,
  validateUsername,
} from './lib.js';
import { DEFAULT_RESOLVER_ADDRESS, DEFAULT_RPC_URL } from './shared.js';

async function main() {
  const args = parseCliArgs();

  const attestationUid = validateAttestationUid(args.attestation || process.env.DIDGIT_ATTESTATION_UID);
  const username = validateUsername(args.username || process.env.DIDGIT_USERNAME);
  const walletAddress = validateAddress(args.wallet || process.env.DIDGIT_WALLET || '', 'recipient wallet');
  const domain = validateDomain(args.domain);
  const resolverAddress = validateAddress(args.resolver || DEFAULT_RESOLVER_ADDRESS, 'resolver address');
  const rpcUrl = validateRpcUrl(args.rpcUrl || DEFAULT_RPC_URL);
  const privateKey = validatePrivateKey(process.env.WALLET_PRIVATE_KEY);

  const { account, walletClient, publicClient } = createClients({ rpcUrl, privateKey });

  await confirmDangerousAction(
    [
      `This will bind ${identitySummary({ domain, username, wallet: walletAddress })}.`,
      'The resolver automatically enables the */* repository pattern.',
      `Sender: ${account.address}`,
      `Resolver: ${resolverAddress}`,
    ].join('\n'),
    { yesFlag: args.yes }
  );

  const result = await bindIdentityAction({
    walletClient,
    publicClient,
    attestationUid,
    walletAddress,
    domain,
    username,
    resolverAddress,
    dryRun: args.dryRun,
  });

  if (args.dryRun) {
    console.log('🧪 Dry run only — no transaction sent');
    console.log(`To: ${resolverAddress}`);
    console.log(`Calldata: ${result.callData}`);
    console.log(`Args: ${JSON.stringify(result.args)}`);
    return;
  }

  console.log(`📤 Transaction sent: ${result.hash}`);
  console.log(`🔗 Explorer: https://sepolia.basescan.org/tx/${result.hash}`);

  if (result.boundWallet) {
    const match = result.boundWallet.toLowerCase() === walletAddress.toLowerCase();
    console.log(`✅ Binding verified: ${domain}:${username} -> ${result.boundWallet} (${match ? 'match' : 'mismatch'})`);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exitCode = 1;
});
