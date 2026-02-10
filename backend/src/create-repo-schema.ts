import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getConfig } from './config';

const ACTIVE = getConfig();
const SCHEMA_REGISTRY = ACTIVE.schemaRegistryAddress as Address;
const EAS = ACTIVE.easAddress as Address;
const VERIFIER_KEY = process.env.VERIFIER_PRIVKEY as Hex;

// Nisto's identity attestation UID
const NISTO_IDENTITY_UID = '0x90687e9e96de20f386d72c9d84b5c7a641a8476da58a77e610e2a1a1a5769cdf' as Hex;

const schemaRegistryAbi = parseAbi([
  'function register(string schema, address resolver, bool revocable) returns (bytes32)'
]);

const easAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data)) returns (bytes32)'
]);

async function main() {
  const account = privateKeyToAccount(VERIFIER_KEY);
  
  const publicClient = createPublicClient({
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: ACTIVE.chain,
    transport: http(ACTIVE.rpcUrl)
  });

  // Schema: repoGlobs (comma-separated patterns like "org/*,user/repo")
  const schema = 'string repoGlobs';
  
  console.log('Registering schema:', schema);
  console.log('From:', account.address);
  
  const registerHash = await walletClient.writeContract({
    address: SCHEMA_REGISTRY,
    abi: schemaRegistryAbi,
    functionName: 'register',
    args: [schema, '0x0000000000000000000000000000000000000000', true]
  });
  
  console.log('Register TX:', registerHash);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
  console.log('Status:', receipt.status);
  
  // Parse schema UID from logs
  const schemaUid = receipt.logs[0]?.topics[1] as Hex;
  console.log('RepoGlobs Schema UID:', schemaUid);
  
  // Now create attestation for Nisto
  console.log('\nCreating repo registration for Nisto...');
  
  const repoGlobs = 'cyberstorm-dev/*,cyberstorm-nisto/*';
  const data = encodeAbiParameters(
    parseAbiParameters('string'),
    [repoGlobs]
  );
  
  const attestHash = await walletClient.writeContract({
    address: EAS,
    abi: easAbi,
    functionName: 'attest',
    args: [{
      schema: schemaUid,
      data: {
        recipient: '0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd' as Address, // Nisto EOA
        expirationTime: 0n,
        revocable: true,
        refUID: NISTO_IDENTITY_UID,
        data: data,
        value: 0n
      }
    }]
  });
  
  console.log('Attest TX:', attestHash);
  
  const attestReceipt = await publicClient.waitForTransactionReceipt({ hash: attestHash });
  console.log('Status:', attestReceipt.status);
  
  const attestUid = attestReceipt.logs.find(l => 
    l.address.toLowerCase() === EAS.toLowerCase()
  )?.data?.slice(0, 66);
  
  console.log('Repo Registration UID:', attestUid);
  console.log('\nDone! Update service.ts with schema UID:', schemaUid);
}

main().catch(console.error);
