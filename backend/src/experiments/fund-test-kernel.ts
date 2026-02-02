import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const VERIFIER_PRIVKEY = process.env.VERIFIER_PRIVKEY as any;
const TEST_KERNEL = '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as any;

async function fund() {
  const verifier = privateKeyToAccount(VERIFIER_PRIVKEY);
  console.log('Verifier:', verifier.address);
  
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const walletClient = createWalletClient({ account: verifier, chain: baseSepolia, transport: http() });
  
  const balance = await publicClient.getBalance({ address: verifier.address });
  console.log('Verifier balance:', balance.toString(), 'wei');
  
  console.log('\nSending 0.002 ETH to test Kernel:', TEST_KERNEL);
  
  const hash = await walletClient.sendTransaction({
    to: TEST_KERNEL,
    value: parseEther('0.002')
  });
  
  console.log('TX hash:', hash);
  await publicClient.waitForTransactionReceipt({ hash });
  
  const newBalance = await publicClient.getBalance({ address: TEST_KERNEL });
  console.log('Kernel balance:', newBalance.toString(), 'wei');
  console.log('✅ Funded');
}

fund().catch(console.error);
