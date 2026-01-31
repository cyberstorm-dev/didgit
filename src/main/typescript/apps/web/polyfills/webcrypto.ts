// Minimal WebCrypto polyfill for digest('SHA-256') and getRandomValues
// Only used if browser-provided crypto.subtle is missing (e.g., non-secure context or polyfill collision).
import { sha256 } from 'viem';

type Algo = string | { name: string };

function algoName(a: Algo): string {
  return typeof a === 'string' ? a : a?.name ?? '';
}

function toBytes(data: ArrayBufferView | ArrayBuffer): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  const view = data as ArrayBufferView;
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

(() => {
  const g: any = globalThis as any;
  const hasSubtle = !!(g.crypto && g.crypto.subtle && typeof g.crypto.subtle.digest === 'function');
  if (!hasSubtle) {
    const subtle = {
      async digest(algorithm: Algo, data: ArrayBufferView | ArrayBuffer): Promise<ArrayBuffer> {
        const name = algoName(algorithm).toUpperCase();
        if (name !== 'SHA-256') throw new Error('polyfill only supports SHA-256');
        const bytes = toBytes(data);
        const out = sha256(bytes, 'bytes') as Uint8Array;
        return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
      },
    } as SubtleCrypto;
    const getRandomValues = (arr: any) => {
      // Best-effort RNG fallback; prefer native if available
      if (g.crypto && typeof g.crypto.getRandomValues === 'function') return g.crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    };
    g.crypto = g.crypto || {};
    g.crypto.subtle = subtle;
    if (!g.crypto.getRandomValues) g.crypto.getRandomValues = getRandomValues;
  }
})();
