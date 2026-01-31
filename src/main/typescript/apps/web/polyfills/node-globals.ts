import { Buffer } from 'buffer';
import process from 'process';
// Assign Node-ish globals for browser deps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).global = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).process = (globalThis as any).process || process;
