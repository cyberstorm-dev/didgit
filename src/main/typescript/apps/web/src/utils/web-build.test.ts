import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('web build', () => {
  it('exposes build:static script', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
    expect(pkg.scripts).toHaveProperty('build:static');
  });
});
