import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

function read(path: string) {
  return fs.readFileSync(path, 'utf8');
}

describe('env docs', () => {
  it('lists required env vars', () => {
    const envDoc = read('docs/ENV.md');
    expect(envDoc).toContain('GITHUB_TOKEN');
  });

  it('documents chain config', () => {
    const chainsDoc = read('docs/CHAINS.md');
    expect(chainsDoc).toContain('Base');
    expect(chainsDoc).toContain('Arbitrum');
  });
});
