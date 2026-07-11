# Genesis Engineering Handbook

## Purpose

This handbook is the canonical engineering manual for Genesis.

It defines how engineers build, review, validate, and ship work while preserving approved architecture and long-term platform integrity.

## Engineering Philosophy

1. Architecture first, implementation second.
2. Determinism over convenience.
3. Governance by default.
4. Explicit boundaries over implicit coupling.
5. Long-term maintainability over short-term speed.

## Repository Layout

1. docs/architecture: architecture records and board artifacts.
2. docs/governance: engineering governance and process controls.
3. docs/reports: sprint and readiness reports.
4. docs/onboarding: onboarding and enablement checklists.
5. docs/readiness: implementation readiness checklists.
6. tools/genesis: compiler and runtime tooling.
7. src: application and platform source tree.
8. definitions/entity: business definitions for compiler inputs.
9. genesis: standards, language, roadmap, and governance context.

## Module Boundaries

1. Domain concerns remain in domain layers.
2. Runtime orchestration remains in runtime layers.
3. Compiler orchestration remains in compiler platform.
4. UI concerns remain presentation-only.
5. Shared utilities remain dependency-light and well bounded.

## Ownership Model

Ownership is defined in docs/governance/OWNERSHIP_MATRIX.md.

Rules:

1. Primary owner must approve critical path changes.
2. Supporting owner review is required for cross-subsystem changes.
3. Escalations go to engineering leadership.

## Git Workflow

1. Create a scoped branch from main.
2. Keep branch focused to one coherent change set.
3. Rebase frequently against main.
4. Open PR early for visibility.

## Branch Naming

Use docs/governance/BRANCH_STRATEGY.md.

Pattern examples:

1. feature/compiler-pass-metadata
2. fix/runtime-registration-validation
3. docs/onboarding-checklist

## Commit Standards

1. Use concise subject with scope prefix.
2. Keep each commit logically coherent.
3. Include architecture/governance reference in commit body for critical changes.

Prefix examples:

1. compiler:
2. runtime:
3. docs:
4. governance:
5. test:

## Pull Request Workflow

1. Open PR with required template fields completed.
2. Link issue and architecture references where relevant.
3. Include validation commands and outputs.
4. Request required owner reviews via CODEOWNERS.
5. Merge only after required checks pass.

## Review Expectations

Reviewers evaluate:

1. Boundary compliance.
2. Determinism and reproducibility impact.
3. Test and validation sufficiency.
4. Documentation and traceability completeness.
5. Long-term maintainability.

## Definition Of Done

Definition of done baseline is in genesis/development/definition-of-done.md.

Additional engineering requirements:

1. Required checks pass in CI.
2. Ownership approvals completed.
3. Risk impact documented for medium/high risk changes.
4. Docs updated for behavior/process changes.

## Testing Expectations

1. Unit and component tests for changed behavior.
2. Compiler pipeline tests for compiler changes.
3. Deterministic behavior checks where applicable.
4. No merge for failing required tests.

Primary test entrypoint:

1. node tools/genesis/genesis.mjs test

## Documentation Standards

1. Every canonical document has clear purpose and owner.
2. Remove placeholders and empty canonical docs.
3. Cross-reference related canonical records.
4. Keep docs implementation-relevant and current.

## Compiler Development Guidelines

1. Preserve pass-driven architecture.
2. Keep pass contracts explicit and version-aware.
3. Do not bypass mandatory verification gates.
4. Maintain diagnostics and provenance coverage.
5. Avoid embedding business semantics in shared orchestration layers.

## Architecture Governance Process

Architecture changes follow:

1. RAR proposal.
2. Independent review.
3. Board review.
4. ADR decision.
5. Contract updates.
6. Implementation planning.

No foundational architecture change proceeds without approved governance path.

## Release Process

Release process baseline:

1. Cut release branch from main.
2. Run required quality gate suite.
3. Approve release candidate.
4. Tag and publish release notes.
5. Track post-release issues with milestone labels.

Detailed process references:

1. genesis/roadmap/releases.md
2. docs/governance/BRANCH_STRATEGY.md
3. docs/governance/BRANCH_PROTECTION_RECOMMENDATIONS.md

## Developer Onboarding

First-week onboarding path:

1. Read README.md, REPOSITORY_OVERVIEW.md, and REPOSITORY_VISION.md.
2. Read this handbook.
3. Run install, lint, and test baseline.
4. Review architecture baseline docs and ownership matrix.
5. Complete onboarding checklist in docs/onboarding/DEVELOPER_ONBOARDING_CHECKLIST.md.

## AI Development Guidelines

1. AI-assisted changes must preserve architecture boundaries.
2. AI-generated output must be reviewed, tested, and owned by engineers.
3. Include explicit rationale for non-trivial generated changes.
4. Do not use AI output to bypass governance or review requirements.

## Engineering Principles

1. Clarity over cleverness.
2. Small changes over sweeping edits.
3. Observable behavior over hidden side effects.
4. Explicit contracts over implied behavior.
5. Governance and quality gates are product features, not overhead.
