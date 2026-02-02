import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const TEST_KERNEL = '0x2Ce0cE887De4D0043324C76472f386dC5d454e96' as any;

async function check() {
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const balance = await publicClient.getBalance({ address: TEST_KERNEL });
  console.log('Kernel balance:', balance.toString(), 'wei');
  console.log('           ETH:', (Number(balance) / 1e18).toFixed(6));
}

check().catch(console.error);
