# Repo Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the repo predictable to work in (DX first), then tighten release hygiene, then ensure builds/tests are green, while preserving the requirement that web builds emit into `public/`.

**Architecture:** Add top-level DX entrypoints that orchestrate subproject commands, document environment contracts, and add build hygiene guardrails. Use TDD for any behavior changes and keep builds deterministic with `public/` as the web artifact location.

**Tech Stack:** Node/pnpm, Vite, TypeScript, Vitest, shell scripts.

---

### Task 1: Add a top-level DX entrypoint script

**Files:**
- Create: `scripts/dx.ts`
- Modify: `package.json`
- Test: `scripts/tests/test_dx.ts`

**Step 1: Write the failing test**

```ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test scripts/tests/test_dx.ts`
Expected: FAIL with “Cannot find module ../../scripts/dx”.

**Step 3: Write minimal implementation**

```ts
export function getDxCommands() {
  return {
    'setup': ['pnpm', '-C', 'backend', 'install'],
    'build:web': ['pnpm', '-C', 'src/main/typescript/apps/web', 'run', 'build:static'],
    'verify': ['pnpm', '-C', 'src/main/typescript/apps/web', 'test']
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test scripts/tests/test_dx.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/dx.ts scripts/tests/test_dx.ts package.json
 git commit -m "Add top-level DX command map"
```

---

### Task 2: Add top-level `pnpm` scripts that call the DX entrypoints

**Files:**
- Modify: `package.json`
- Test: `scripts/tests/test_dx.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import pkg from '../../package.json';

describe('package scripts', () => {
  it('includes setup, build:web, verify', () => {
    expect(pkg.scripts).toHaveProperty('setup');
    expect(pkg.scripts).toHaveProperty('build:web');
    expect(pkg.scripts).toHaveProperty('verify');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test scripts/tests/test_dx.ts`
Expected: FAIL with missing scripts.

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "setup": "node scripts/dx.ts setup",
    "build:web": "node scripts/dx.ts build:web",
    "verify": "node scripts/dx.ts verify"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test scripts/tests/test_dx.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json scripts/tests/test_dx.ts
 git commit -m "Add top-level setup/build/verify scripts"
```

---

### Task 3: Make `build:web` deterministic (clean + build to public/)

**Files:**
- Modify: `src/main/typescript/apps/web/package.json`
- Modify: `src/main/typescript/apps/web/vite.config.ts`
- Test: `src/main/typescript/apps/web/src/utils/easStats.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import pkg from '../../../package.json';

describe('web build', () => {
  it('exposes build:static script', () => {
    expect(pkg.scripts).toHaveProperty('build:static');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd src/main/typescript/apps/web && pnpm test`
Expected: FAIL if build:static missing.

**Step 3: Write minimal implementation**

- Ensure `build:static` runs `vite build`.
- Ensure `vite.config.ts` uses `outDir: ../../../../../public` and `emptyOutDir: true`.

**Step 4: Run test to verify it passes**

Run: `cd src/main/typescript/apps/web && pnpm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/typescript/apps/web/package.json src/main/typescript/apps/web/vite.config.ts
 git commit -m "Make web build deterministic"
```

---

### Task 4: Document environment contract

**Files:**
- Modify: `docs/GETTING_STARTED.md`
- Create: `docs/ENV.md`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('env docs', () => {
  it('lists required env vars', () => {
    const envDoc = fs.readFileSync('docs/ENV.md', 'utf8');
    expect(envDoc).toContain('GITHUB_TOKEN');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test scripts/tests/test_env_docs.ts`
Expected: FAIL because file not found.

**Step 3: Write minimal implementation**

Create `docs/ENV.md` with a small table of variables and references.

**Step 4: Run test to verify it passes**

Run: `pnpm test scripts/tests/test_env_docs.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/ENV.md docs/GETTING_STARTED.md scripts/tests/test_env_docs.ts
 git commit -m "Document env contract"
```

---

### Task 5: Make `verify` deterministic and grouped

**Files:**
- Modify: `scripts/dx.ts`
- Create: `scripts/tests/test_verify.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { getDxCommands } from '../../scripts/dx';

describe('verify command', () => {
  it('runs web tests before backend', () => {
    const cmds = getDxCommands();
    expect(cmds.verify[0]).toContain('pnpm');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test scripts/tests/test_verify.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

Implement `verify` to run web tests and backend tests in order, with clear labels.

**Step 4: Run test to verify it passes**

Run: `pnpm test scripts/tests/test_verify.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/dx.ts scripts/tests/test_verify.ts
 git commit -m "Make verify deterministic"
```

---

### Task 6: Fix build blockers in web TypeScript

**Files:**
- Modify: `src/main/typescript/apps/web/utils/config.ts`
- Modify: `src/main/typescript/apps/web/utils/eas.ts`
- Test: `src/main/typescript/apps/web` build

**Step 1: Write failing test**

Run: `cd src/main/typescript/apps/web && pnpm run build`
Expected: FAIL with TS errors.

**Step 2: Implement minimal fixes**

- Add type declarations for `import.meta.env` and `window.ethereum`.
- Fix strict optional type errors in `eas.ts` by narrowing.

**Step 3: Verify build**

Run: `cd src/main/typescript/apps/web && pnpm run build`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/main/typescript/apps/web/utils/config.ts src/main/typescript/apps/web/utils/eas.ts
 git commit -m "Fix web TS build errors"
```

---

### Task 7: Run full verify and build:web

**Files:**
- None

**Step 1: Run verify**

Run: `pnpm run verify`
Expected: PASS or known failures documented.

**Step 2: Run build:web**

Run: `pnpm run build:web`
Expected: `public/` regenerated.

**Step 3: Commit (if any changes)**

```bash
git add public/
 git commit -m "Update web build artifacts"
```

---

### Task 8: Push branch and open review

**Files:**
- None

**Step 1: Push**

Run: `git push -u origin repo-stabilization`

**Step 2: Review**

Summarize changes and any remaining known issues.
