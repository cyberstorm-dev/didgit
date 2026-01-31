import { Buffer } from 'buffer';
import process from 'process';

// @ts-ignore
globalThis.Buffer = Buffer;
// @ts-ignore
globalThis.process = process;