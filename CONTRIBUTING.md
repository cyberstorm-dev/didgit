# Contributing to didgit.dev

Thank you for your interest in contributing to didgit.dev! This document outlines our contribution process and standards.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Attestation Requirement](#attestation-requirement)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm or npm
- Git
- A GitHub account
- (Optional) Ethereum wallet for attestations

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/didgit.git
   cd didgit
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/cyberstorm-dev/didgit.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

## Development Workflow

### 1. Create a Feature Branch

Always work in a feature branch, never directly in `main` or `dev`:

```bash
git checkout dev
git pull upstream dev
git checkout -b feat/your-feature-name
```

### 2. Branch Naming Convention

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

### 3. Make Your Changes

- Write clear, maintainable code
- Follow existing code style and patterns
- Add tests if applicable
- Update documentation as needed

### 4. Test Your Changes

```bash
# Build
npm run build

# Run tests (if available)
npm test

# Type check
npm run typecheck
```

## Attestation Requirement

**didgit.dev uses its own identity attestation system to track contributions.**

If you have registered your identity on didgit.dev and bound it to a wallet, you can (and should) attest your contributions on-chain. This is optional for external contributors but demonstrates the system in action.

### For Core Contributors (Mandatory)

Core contributors with wallets **must attest every commit** to dogfood our own system:

1. **After committing**, create an on-chain attestation:
   ```bash
   node scripts/attest-contribution.mjs --commit $(git log -1 --format="%H")
   ```

2. **Include attestation details in your PR:**
   ```markdown
   **Attested Commit:**
   - Commit: `abc123...`
   - Attestation UID: `0x...`
   - View: https://base-sepolia.easscan.org/attestation/view/0x...
   ```

### For External Contributors (Optional)

If you don't have a wallet or haven't registered your identity, no worries! Just submit your PR normally. Consider registering on [didgit.dev](https://didgit.dev) to build your on-chain reputation.

## Pull Request Process

### 1. Push Your Branch

```bash
git push origin feat/your-feature-name
```

### 2. Create a Pull Request

- **Base branch:** `dev` (not `main`)
- **Title:** Use conventional commits format: `feat: add feature X`
- **Description:** Include:
  - What the PR does
  - Why the change is needed
  - How to test it
  - Attestation details (if applicable)
  - Screenshots (for UI changes)

### 3. PR Template

```markdown
## Summary
Brief description of the changes.

## Motivation
Why is this change needed?

## Changes
- List of specific changes made

## Testing
- [ ] Built successfully
- [ ] Tests pass
- [ ] Manually tested

## Attestation (if applicable)
**Attested Commit:**
- Commit: `abc123...`
- Attestation UID: `0x...`
- View: [EAS Explorer](https://base-sepolia.easscan.org/attestation/view/0x...)
```

### 4. Code Review

- Address review feedback promptly
- Keep discussions respectful and constructive
- Be open to suggestions and alternative approaches

### 5. Merge

Once approved, a maintainer will merge your PR into `dev`. It will be included in the next release.

## Commit Guidelines

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**
```bash
feat(backend): add GitHub issue verification
fix(ui): resolve attestation form validation
docs(schemas): document issue attestation schema
refactor(service): simplify EAS integration
```

### Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Maintenance, deps, config |

### Commit Best Practices

- **One logical change per commit**
- **Write descriptive messages** (explain why, not just what)
- **Keep commits atomic** (easy to revert if needed)
- **Test each commit** (don't break bisectability)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- path/to/test.spec.ts
```

### Writing Tests

- Write tests for new features
- Update tests when changing behavior
- Ensure tests are deterministic
- Mock external dependencies

## Architecture Guidelines

### Backend (`backend/src/`)

- Keep services stateless
- Use typed interfaces
- Handle errors gracefully
- Log important operations

### Frontend (`src/main/typescript/apps/web/`)

- Use React hooks for state
- Keep components small and focused
- Use TypeScript strictly
- Handle loading and error states

### Contracts

- Contracts are deployed, **do not modify** without coordination
- Document contract interactions
- Use viem for blockchain interactions

## Documentation

- Update `docs/` for architectural changes
- Create or update schema docs in `docs/schemas/`
- Keep README.md current
- Document new APIs and functions

## Need Help?

- **Issues:** Check [open issues](https://github.com/cyberstorm-dev/didgit/issues)
- **Discussions:** Use GitHub Discussions
- **Questions:** Open an issue with the `question` label

## Attribution

By contributing, you agree that your contributions will be licensed under the project's license (MIT).

For core contributors using attestations, your contributions will also be recorded on-chain, building your verifiable reputation in the didgit.dev ecosystem.

---

Thank you for contributing to didgit.dev! Together we're building the future of decentralized identity and reputation. 🎭
