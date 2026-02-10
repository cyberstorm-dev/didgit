import { describe, it, expect } from 'vitest';
import { getDxCommands } from '../../scripts/dx';

describe('verify command', () => {
  it('runs web tests before backend', () => {
    const cmds = getDxCommands();
    const verify = cmds.verify;
    expect(Array.isArray(verify)).toBe(true);
    expect(verify).toHaveLength(2);
    expect(verify[0].cmd.join(' ')).toContain('src/main/typescript/apps/web');
    expect(verify[1].cmd.join(' ')).toContain('backend');
  });
});
