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
