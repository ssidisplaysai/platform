# Remediation Baseline

## Baseline from GQI-0001

- TypeScript errors: 333
- Lint errors: 140
- Lint warnings: 284
- Dependency vulnerabilities: 34
- Active CI workflows: 1

## GQI-0002 Starting Evidence

Pre-remediation repository tsc output characteristics observed in this workstream:
- baseline_tsc_error_count: 333
- baseline_placeholder_tsc_error_lines: 333

Interpretation:
- Placeholder scaffold templates under tools/genesis/templates/entity were fully contaminating repository-wide compile output.

## Baseline Quality Risks

1. Certification static-gate reliability risk due placeholder compile contamination.
2. No canonical repository typecheck script.
3. No dedicated template validation gate tied to repository typecheck.
4. CI workflow did not run a canonical local quality command set.

## Remediation Target

- Canonical repository typecheck passes with exit code 0.
- Placeholder templates no longer produce repository compile failures.
- Templates validated independently via deterministic renderer and fixture typecheck.
- CI executes canonical quality commands used locally.
