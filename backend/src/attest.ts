import { createPublicClient, http, type Address, type Hex, parseAbi, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';

const ACTIVE = getConfig();
const EAS_ADDRESS = ACTIVE.easAddress as Address;
const CONTRIBUTION_SCHEMA_UID = ACTIVE.contributionSchemaUid as Hex;

const easAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
]);

export interface AttestCommitRequest {
  userWalletAddress: Address;
  identityAttestationUid: Hex;
  commitHash: string;
  repoOwner: string;
  repoName: string;
  author: string;
  message: string;
}

export async function attestCommit(req: AttestCommitRequest): Promise<{ success: boolean; attestationUid?: Hex; txHash?: Hex; error?: string }> {
  try {
    const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as Hex;
    if (!VERIFIER_PRIVKEY) throw new Error('VERIFIER_PRIVKEY not set');

    const verifierAccount = privateKeyToAccount(VERIFIER_PRIVKEY);
    console.log('[attest] Verifier:', verifierAccount.address);
    console.log('[attest] User wallet:', req.userWalletAddress);
    console.log('[attest] Commit:', req.commitHash.slice(0, 12));

    const publicClient = createPublicClient({
      chain: ACTIVE.chain,
      transport: http(ACTIVE.rpcUrl)
    });

    // Encode contribution data according to schema
    // Schema: string repo, string commitHash, string author, string message, uint64 timestamp, bytes32 identityUid
    const contributionData = encodeAbiParameters(
      parseAbiParameters('string, string, string, string, uint64, bytes32'),
      [
        `${req.repoOwner}/${req.repoName}`, // repo
        req.commitHash, // commitHash (as string, full 40 char SHA)
        req.author, // author
        req.message, // message
        BigInt(Math.floor(Date.now() / 1000)), // timestamp
        req.identityAttestationUid // identityUid
      ]
    );

    // Create attestation request
    const attestationRequest = {
      schema: CONTRIBUTION_SCHEMA_UID,
      data: {
        recipient: req.userWalletAddress,
        expirationTime: 0n,
        revocable: true,
        refUID: req.identityAttestationUid,
        data: contributionData,
        value: 0n
      }
    };

    console.log('[attest] Attestation request:', {
      schema: attestationRequest.schema,
      recipient: attestationRequest.data.recipient,
      refUID: attestationRequest.data.refUID
    });

    // MVP: Verifier calls EAS directly (verifier pays gas)
    // TODO: Create UserOp for user's wallet once AllowlistValidator is deployed
    const { createWalletClient } = await import('viem');
    const { http: httpTransport } = await import('viem');

    const walletClient = createWalletClient({
      account: verifierAccount,
      chain: ACTIVE.chain,
      transport: httpTransport(ACTIVE.rpcUrl)
    });

    // Call EAS.attest
    const txHash = await walletClient.writeContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: 'attest',
      args: [attestationRequest]
    });

    console.log('[attest] TX hash:', txHash);

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log('[attest] Receipt:', receipt.status);

    // Parse logs to get attestation UID
    const attestedLog = receipt.logs.find(log => 
      log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() &&
      log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35' // Attested event
    );

    const attestationUid = attestedLog?.topics[3] as Hex | undefined;

    if (!attestationUid) {
      throw new Error('Failed to parse attestation UID from logs');
    }

    console.log('[attest] Attestation UID:', attestationUid);

    return {
      success: true,
      attestationUid,
      txHash
    };
  } catch (e) {
    console.error('[attest] Error:', e);
    return {
      success: false,
      error: (e as Error).message ?? 'Unknown error'
    };
  }
}

function encodeContributionData(data: { commitHash: string; repoName: string; timestamp: bigint }): Hex {
  // TODO: Properly encode according to Contribution Schema
  // For now, use a simple encoding
  const abiCoder = parseAbi(['function encode(bytes32,string,uint64)']);
  // This is a placeholder - need to match actual schema encoding
  return '0x' as Hex;
}
