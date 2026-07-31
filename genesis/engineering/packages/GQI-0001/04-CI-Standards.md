# CI Standards

## Current CI Baseline

Detected workflows: 1
- .github/workflows/atlas-guardrails.yml

Current CI behavior:
- Runs on push and pull request
- Installs dependencies
- Executes npm run atlas:certify

## CI Maturity Gaps

1. No explicit repository typecheck gate.
2. No explicit repository lint gate.
3. No explicit dependency/security audit gate.
4. No template validation gate.
5. No certification readiness gate.
6. No coverage trend capture.
7. No workflow partitioning by quality domain.

## Deterministic CI Gate Model (Recommended)

1. ci-quality-foundation
- quality:typecheck
- quality:lint
- quality:dependency
- quality:security

2. ci-architecture-governance
- quality:architecture
- quality:governance

3. ci-tests
- quality:test:unit
- quality:test:integration
- quality:test:regression
- coverage threshold checks

4. ci-templates
- quality:templates

5. ci-certification-readiness
- quality:gate
- certification criteria checklist validation

## Workflow Conventions

- Pin Node major/minor versions in all workflows.
- Use npm ci with lockfile enforcement.
- Fail fast on first failing gate group.
- Emit summary artifacts:
  - lint-report.json
  - tsc-report.txt
  - test-report.json
  - coverage-summary.json
  - governance-report.json

## Branch Policy Recommendations

- Require passing checks before merge.
- Protect release and certification branches with full gate profile.
- Require manual approval for condition overrides.
