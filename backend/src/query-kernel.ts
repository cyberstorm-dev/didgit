/**
 * Query an existing Kernel v3 account to understand its state
 */
import { createPublicClient, http, type Address, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

const USER_KERNEL = '0x5B6441B4FF0AA470B1aEa11807F70FB98428BAEd' as Address;

async function query() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0])
  });

  console.log('Querying Kernel account:', USER_KERNEL);

  // Check if it's a contract
  const code = await publicClient.getBytecode({ address: USER_KERNEL });
  console.log('Is contract?', code ? 'Yes' : 'No (EOA)');
  
  if (!code) {
    console.log('This is an EOA, not a Kernel smart account!');
    console.log('User needs to create a Kernel account first.');
    return;
  }

  // Try to read Kernel v3 state
  // Kernel v3 has these functions:
  // - getNonce(uint192 key) returns (uint256)
  // - validators / executors mapping
  
  const kernelAbi = parseAbi([
    'function getNonce(uint192 key) view returns (uint256)',
    'function getActiveValidator() view returns (address)',
  ]);

  try {
    const nonce = await publicClient.readContract({
      address: USER_KERNEL,
      abi: kernelAbi,
      functionName: 'getNonce',
      args: [0n] // key = 0 for default validator
    });
    console.log('Nonce (key=0):', nonce);
  } catch (e) {
    console.log('Could not read nonce:', (e as Error).message);
  }

  try {
    const validator = await publicClient.readContract({
      address: USER_KERNEL,
      abi: kernelAbi,
      functionName: 'getActiveValidator'
    });
    console.log('Active validator:', validator);
  } catch (e) {
    console.log('Could not read validator:', (e as Error).message);
  }

  // Check balance
  const balance = await publicClient.getBalance({ address: USER_KERNEL });
  console.log('Balance:', balance, 'wei (', Number(balance) / 1e18, 'ETH)');
}

query().catch(console.error);
