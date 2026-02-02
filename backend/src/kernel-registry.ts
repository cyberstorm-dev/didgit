/**
 * EOA → Kernel account registry
 * 
 * Caches the mapping between user EOAs (from identity) and their Kernel accounts.
 * First Kernel for each EOA is cached (upsert). Swapping supported in v2.
 */

import { createPublicClient, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_FILE = path.join(__dirname, '../.kernel-cache.json');

type KernelCache = {
  [eoa: string]: {
    kernelAddress: Address;
    firstSeen: string;
    lastUsed: string;
  };
};

export class KernelRegistry {
  private cache: KernelCache;
  private publicClient;

  constructor() {
    this.cache = this.loadCache();
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0])
    });
  }

  /**
   * Get or derive Kernel address for an EOA
   */
  async getKernelForEOA(eoa: Address): Promise<Address | null> {
    const eoaLower = eoa.toLowerCase();
    
    // Check cache first
    if (this.cache[eoaLower]) {
      console.log(`[registry] Cache hit: ${eoa} → ${this.cache[eoaLower].kernelAddress}`);
      this.cache[eoaLower].lastUsed = new Date().toISOString();
      this.saveCache();
      return this.cache[eoaLower].kernelAddress;
    }

    // Derive Kernel address
    // For ZeroDev Kernel v3, the address is derived from:
    // - EOA signer address
    // - Initial validator (ECDSA)
    // - EntryPoint
    // - Salt (usually 0)
    
    // We need to compute this deterministically
    // For now, return null and require user to create Kernel first
    
    console.log(`[registry] No Kernel found for ${eoa}`);
    console.log(`[registry] User needs to create Kernel account first`);
    
    return null;
  }

  /**
   * Register a Kernel address for an EOA (discovered or user-provided)
   */
  async registerKernel(eoa: Address, kernelAddress: Address): Promise<void> {
    const eoaLower = eoa.toLowerCase();
    
    // Verify it's actually a contract
    const code = await this.publicClient.getBytecode({ address: kernelAddress });
    if (!code) {
      throw new Error(`${kernelAddress} is not a contract`);
    }

    // Check if already cached
    if (this.cache[eoaLower]) {
      console.log(`[registry] ${eoa} already has Kernel: ${this.cache[eoaLower].kernelAddress}`);
      console.log(`[registry] Not overwriting (v2 will support swapping)`);
      return;
    }

    // Cache it
    this.cache[eoaLower] = {
      kernelAddress,
      firstSeen: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    this.saveCache();
    console.log(`[registry] Registered: ${eoa} → ${kernelAddress}`);
  }

  /**
   * Check if a Kernel account exists and is usable
   */
  async isKernelReady(kernelAddress: Address): Promise<boolean> {
    try {
      // Check if it's a contract
      const code = await this.publicClient.getBytecode({ address: kernelAddress });
      if (!code) return false;

      // Check if it has balance for gas
      const balance = await this.publicClient.getBalance({ address: kernelAddress });
      
      console.log(`[registry] Kernel ${kernelAddress} balance: ${balance} wei`);
      
      // Need at least 0.001 ETH for gas
      return balance > 1000000000000000n;
    } catch (e) {
      console.error(`[registry] Error checking Kernel ${kernelAddress}:`, e);
      return false;
    }
  }

  private loadCache(): KernelCache {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('[registry] Failed to load cache:', e);
    }
    return {};
  }

  private saveCache(): void {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      console.error('[registry] Failed to save cache:', e);
    }
  }
}
