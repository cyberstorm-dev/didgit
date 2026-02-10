import { describe, it, expect } from 'vitest';
import { getDxCommands } from '../../scripts/dx';

describe('dx commands', () => {
  it('exposes setup, build:web, verify', () => {
    const cmds = getDxCommands();
    expect(cmds).toHaveProperty('setup');
    expect(cmds).toHaveProperty('build:web');
    expect(cmds).toHaveProperty('verify');
  });
});

describe('package scripts', () => {
  it('includes setup, build:web, verify', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.default.scripts).toHaveProperty('setup');
    expect(pkg.default.scripts).toHaveProperty('build:web');
    expect(pkg.default.scripts).toHaveProperty('verify');
  });
});
