import { spawnSync } from 'node:child_process';

type DxStep = {
  label: string;
  cmd: string[];
};

type DxCommands = Record<string, DxStep[]>;

export function getDxCommands(): DxCommands {
  return {
    setup: [
      { label: 'backend install', cmd: ['pnpm', '-C', 'backend', 'install'] }
    ],
    'build:web': [
      { label: 'web build', cmd: ['pnpm', '-C', 'src/main/typescript/apps/web', 'run', 'build:static'] }
    ],
    verify: [
      { label: 'web tests', cmd: ['pnpm', '-C', 'src/main/typescript/apps/web', 'test'] },
      { label: 'backend tests', cmd: ['pnpm', '-C', 'backend', 'test'] }
    ]
  };
}

function runSteps(steps: DxStep[]): void {
  for (const step of steps) {
    console.log(`\n[dx] ${step.label}`);
    const [command, ...args] = step.cmd;
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function main() {
  const commands = getDxCommands();
  const name = process.argv[2];
  if (!name || !commands[name]) {
    console.error('Usage: node scripts/dx.ts <command>');
    console.error(`Available: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
  }
  runSteps(commands[name]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
