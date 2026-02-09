export function getDxCommands() {
  return {
    setup: ['pnpm', '-C', 'backend', 'install'],
    'build:web': ['pnpm', '-C', 'src/main/typescript/apps/web', 'run', 'build:static'],
    verify: ['pnpm', '-C', 'src/main/typescript/apps/web', 'test']
  };
}
