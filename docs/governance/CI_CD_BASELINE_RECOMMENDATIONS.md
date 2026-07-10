# CI/CD Baseline Recommendations

## Goal

Establish minimum quality gates for engineering readiness without introducing deployment pipelines.

## Required PR Gates

1. Lint gate
2. Build validation gate
3. Compiler test baseline gate
4. Documentation integrity gate
5. Architecture governance gate

## Suggested Checks

### Lint

Command:

1. npm run lint

### Build

Command:

1. npm run build

### Compiler Tests

Command:

1. node tools/genesis/genesis.mjs test

### Documentation Integrity

Checks:

1. No empty canonical markdown files in governance and architecture baselines.
2. Markdown link validation for docs/ and root governance docs.

### Architecture Governance

Checks:

1. Architecture-changing PRs include RAR/ARD/ADR trace fields.
2. CODEOWNERS approvals required for protected paths.

## Dependency And Security Checks

1. Run npm audit or equivalent dependency audit on schedule.
2. Fail critical vulnerabilities unless explicit temporary waiver exists.

## Versioning Controls

1. Enforce changelog update for release-impacting changes.
2. Tag release candidates from protected release branches only.

## Implementation Note

This document defines recommendations only. Pipeline implementation can be done in a follow-up engineering execution task.
