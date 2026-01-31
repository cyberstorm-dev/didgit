#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'src', 'main', 'solidity', 'out');
  const destDir = path.join(root, 'src', 'generated', 'abi');
  await fs.mkdir(destDir, { recursive: true });

  const candidates = [
    { file: 'Resolver.sol/Resolver.json', name: 'Resolver.json' },
  ];

  for (const c of candidates) {
    const src = path.join(outDir, c.file);
    try {
      const data = await fs.readFile(src, 'utf8');
      const json = JSON.parse(data);
      const abi = json.abi ?? json.ABI ?? json;
      await fs.writeFile(path.join(destDir, c.name), JSON.stringify(abi, null, 2));
      console.log(`synced ${c.name}`);
    } catch (e) {
      console.warn(`skip ${c.file}: ${(e && e.message) || e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

