# Repository Health

## Health Summary

Repository is operational and testable, but quality debt is material in lint and dependency-security dimensions, and compile gate contamination exists via placeholder templates.

## Findings

1. Placeholder files
- Entity placeholder templates under tools/genesis/templates/entity contribute all observed repository TypeScript compile errors.
- Placeholder token footprint: 161 tokens across 8 template files.

2. Temporary and backup artifacts
- Backup-like file detected:
  - tools/genesis/genesis.mjs.bak
- Test output artifacts present at repository root:
  - automation_test_output.txt
  - test-results-latest.txt
  - test-results.txt
  - test_full_output.txt
  - test_output.txt
  - test_output_full.txt

3. Generated/transient artifacts
- tsconfig.tsbuildinfo present in repository root.
- Generated and transient artifacts should be policy-classified and handled consistently by ignore rules and cleanup tasks.

4. Lint debt
- 140 errors and 284 warnings across 142 files.
- Highest-concentration findings include compiler and test suites.

5. Dependency health
- npm audit baseline: 34 vulnerabilities (33 high, 1 moderate, 0 critical).

6. CI health
- Only one workflow currently active for atlas certification guardrails.
- Missing dedicated quality workflow partitioning (typecheck/lint/security/templates/certification readiness).

## Dead Code and Unused Signal

- no-unused-vars warnings are widespread and indicate potential dead-code or unfinished-refactor residue.
- Formal dead-code pass is not currently automated with a dedicated tool chain.

## Broken Imports/References

- No repository-wide TypeScript import breakage was surfaced outside placeholder template files in current tsc baseline.

## Health Conclusion

Repository health is sufficient for continued controlled development but requires infrastructure hardening to reach deterministic enterprise quality-gate maturity.
