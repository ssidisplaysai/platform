# Contributing To Genesis

## Contribution Principles

1. Preserve approved architecture and governance.
2. Keep changes small, reviewable, and traceable.
3. Prioritize determinism, maintainability, and auditability.

## Workflow

1. Read [GENESIS_ENGINEERING_HANDBOOK.md](GENESIS_ENGINEERING_HANDBOOK.md).
2. Create a branch using naming rules in [docs/governance/BRANCH_STRATEGY.md](docs/governance/BRANCH_STRATEGY.md).
3. Implement scoped changes with tests and docs updates.
4. Open a pull request using the repository PR template.
5. Obtain required owner reviews and pass required checks.

## Architecture Changes

1. Any foundational architecture change must follow RAR -> ARD -> ADR.
2. Use the Architecture Proposal issue template for new proposals.

## Quality Requirements

1. Lint and required tests must pass.
2. Definition of done in [genesis/development/definition-of-done.md](genesis/development/definition-of-done.md) must be satisfied.
3. Documentation must be updated for process, contract, or behavior changes.

## Commit Guidance

Use clear commit subjects with scoped prefixes:

1. docs: ...
2. governance: ...
3. compiler: ...
4. runtime: ...
5. test: ...
