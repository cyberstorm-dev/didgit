import { describe, expect, it, vi } from 'vitest';
import {
  bindIdentityAction,
  buildBindIdentityCall,
  decodeBindIdentityData,
  validateAttestationUid,
  validateUsername,
} from './lib.js';
import { RESOLVER_ABI } from './shared.js';

const sampleUid = '0x'.padEnd(66, 'a');
const sampleWallet = '0x7a1de0Fa7242194bbA84E915f39bF7E621B50d2E';
const resolverAddress = '0x20c1cb4313efc28d325d3a893a68ca8c82911b0c';

function mockClients() {
  const walletClient = {
    writeContract: vi.fn().mockResolvedValue('0xdeadbeef'),
  };
  const publicClient = {
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    readContract: vi.fn().mockResolvedValue(sampleWallet),
  };
  return { walletClient, publicClient };
}

describe('validation', () => {
  it('rejects invalid attestation uid', () => {
    expect(() => validateAttestationUid('0x1234')).toThrow(/32-byte/);
  });

  it('accepts valid username', () => {
    expect(validateUsername('alice-dev')).toBe('alice-dev');
  });
});

describe('encoding', () => {
  it('encodes bindIdentity calldata', () => {
    const call = buildBindIdentityCall({
      attestationUid: sampleUid,
      walletAddress: sampleWallet,
      domain: 'github.com',
      username: 'alice',
      resolverAddress,
    });

    const decoded = decodeBindIdentityData(call.data);
    expect(decoded.functionName).toBe('bindIdentity');
    expect(decoded.args).toEqual([sampleUid, sampleWallet, 'github.com', 'alice']);
  });
});

describe('bindIdentityAction', () => {
  it('supports dry-run mode without network calls', async () => {
    const { walletClient, publicClient } = mockClients();

    const result = await bindIdentityAction({
      walletClient,
      publicClient,
      attestationUid: sampleUid,
      walletAddress: sampleWallet,
      domain: 'github.com',
      username: 'alice',
      resolverAddress,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(walletClient.writeContract).not.toHaveBeenCalled();
    expect(publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it('writes and verifies binding with mocked clients', async () => {
    const { walletClient, publicClient } = mockClients();

    const result = await bindIdentityAction({
      walletClient,
      publicClient,
      attestationUid: sampleUid,
      walletAddress: sampleWallet,
      domain: 'github.com',
      username: 'alice',
      resolverAddress,
    });

    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'bindIdentity' })
    );
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getIdentityOwner', args: ['github.com', 'alice'] })
    );
    expect(result.boundWallet).toBe(sampleWallet);
  });
});
