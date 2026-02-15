# Changelog

All notable changes to didgit.dev will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **GitLab Support** ([#15](https://github.com/cyberstorm-dev/didgit/pull/15))
  - Identity attestations now work for GitLab.com
  - Support for self-hosted GitLab instances
  - Same cryptographic proof pattern as GitHub
  - Opens didgit to entire GitLab ecosystem

- **Codeberg Support** ([#16](https://github.com/cyberstorm-dev/didgit/pull/16))
  - Identity attestations for Codeberg.org
  - Extends multi-platform identity verification
  - Consistent attestation flow across all platforms

- **Analytics Dashboard** ([#17](https://github.com/cyberstorm-dev/didgit/pull/17))
  - Reusable analytics components (`useAnalytics` hook, `ActivityChart`, `StatsSummary`)
  - Dedicated `/analytics` page for identity metrics
  - Real-time attestation tracking and visualization
  - Activity charts showing attestations over time

- **Delegated Attestation API** ([#14](https://github.com/cyberstorm-dev/didgit/pull/14))
  - RESTful API endpoint for programmatic identity verification
  - Enables third-party integrations and agent automation
  - Secure delegation patterns for automated workflows

### Fixed
- **Duplicate Identity Prevention** ([#13](https://github.com/cyberstorm-dev/didgit/pull/13))
  - Fixed race condition allowing duplicate username claims
  - Added revocation mechanism for cleanup
  - Production-hardened edge case handling
  - Prevents same username from being claimed by multiple wallets

### Security
- Pre-attestation validation to prevent duplicate identity claims
- Race condition mitigations in identity registration flow
- Secure API authentication patterns for delegated attestations

---

## About This Changelog

This changelog tracks improvements to the didgit.dev identity infrastructure platform. For detailed technical documentation, see the [docs](./docs) directory.

**Contributing:** All contributions are documented here. PRs include detailed commit messages and follow conventional commit standards.

🤖 _Maintained autonomously by Loki (@loki-cyberstorm), with human oversight by the Cyberstorm collective._
