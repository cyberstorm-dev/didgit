# Repo Stabilization Design

**Goal:** Make the repo predictable to work in (DX first), then tighten release hygiene, then ensure builds/tests are green, while preserving the requirement that web builds emit into `public/`.

## Architecture

We will stabilize the repo in three ordered passes aligned with priority: **Developer UX → Release hygiene → Build/test green**. The effort introduces a small set of top-level entrypoints (scripts or pnpm tasks) that orchestrate existing subproject commands rather than re-implementing logic. The invariant that web builds emit into `public/` remains enforced by default. Changes are incremental and reversible, with minimal behavioral refactors.

## Components

1. **DX entrypoints**
   - Standardized commands (`setup`, `build:web`, `verify`) to centralize “how to run this repo.”
   - Clear output and failure messages with actionable next steps.

2. **Environment contract**
   - Single source of truth for required env vars (name, purpose, required/optional, default, where used).
   - Ensure `.env.example` matches actual runtime expectations.

3. **Release hygiene guardrails**
   - Deterministic web build that cleans and regenerates `public/`.
   - Documented node/pnpm versions and dependency install paths.
   - CI-friendly `verify` command, even if CI is not configured yet.

4. **Build/test green**
   - Fix build blockers and test failures in a structured order so “build:web” is reliable first.
   - Remove or correct confusing or dead scripts.

## Data Flow

DX entrypoints orchestrate existing subproject commands. `build:web` is a deterministic pipeline that produces `public/` artifacts, while `verify` runs typechecking/tests and can be stricter than build. This separation ensures production artifacts remain reproducible even when the codebase is mid-transition.

## Error Handling

Top-level commands should fail fast and explain:
- The exact failing subcommand
- The likely cause (missing env var, dependency, etc.)
- The next step (doc link or command to fix)

`verify` should group failures by project (web/backend) to avoid interleaving errors that confuse debugging.

## Testing & Verification

- `build:web` must succeed on a clean checkout and emit into `public/`.
- `verify` should be a deterministic, documented sequence with clear outputs.
- Tests should be minimal but representative of critical flows (e.g., stats aggregation logic, permission setup logic if applicable).

## Rollout

1. Introduce DX entrypoints and documentation updates.
2. Add release hygiene guardrails (clean builds, deterministic outputs).
3. Fix remaining build/test failures with TDD and minimal changes.

## Success Criteria

- A developer can run one setup command and one build command without guessing.
- Web build artifacts appear under `public/` every time.
- `verify` is documented and reliable, even if some tests are initially opt-in.
- Builds/tests are green without manual patching.
