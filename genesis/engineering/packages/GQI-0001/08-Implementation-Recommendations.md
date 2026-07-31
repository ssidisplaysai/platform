# Implementation Recommendations

## Priority Order

1. Establish quality command contract in package scripts.
2. Isolate placeholder templates from repository tsc gate.
3. Introduce dedicated template validation pipeline.
4. Add CI workflow partitioning by quality domain.
5. Introduce certification-readiness gate workflow.
6. Burn down lint error debt with staged ownership.
7. Address high vulnerabilities with risk-disposition process.
8. Normalize repository artifact hygiene.

## Recommendation Set

1. TypeScript gate modernization
- Create root quality tsconfig for platform source and tests.
- Exclude placeholder template files by policy.
- Add dedicated template tsconfig and render-check tests.

2. Template quality pipeline
- Add template:validate script.
- Add template:render-fixtures script.
- Add template:compile-fixtures script.
- Enforce no unresolved tokens in rendered outputs.

3. Validation command standardization
- Implement canonical quality:* script namespace.
- Require each work order package to cite executed quality profile.

4. CI expansion
- Add workflows:
  - quality-foundation.yml
  - quality-tests.yml
  - quality-templates.yml
  - certification-readiness.yml
- Keep atlas-guardrails.yml as architecture/governance domain gate.

5. Certification gate enforcement
- Add pre-certification checklist automation.
- Require machine-readable evidence bundle for every certification package.

6. Repository health automation
- Add hygiene check script for backup/temp artifacts.
- Add dead-code/unused-export analysis tooling in a non-blocking phase, then elevate to gate.

7. Dependency security control
- Add vulnerability policy thresholds and suppression governance file.
- Block critical vulnerabilities by default.

8. Ownership and accountability
- Assign domain owners for type/lint/security/template debt categories.
- Define service-level objectives for gate pass rates and remediation latency.

## Non-Goals for GQI-0001

- No runtime behavior changes.
- No Authentication or Authorization behavior modifications.
- No unrelated feature implementation.

## Success Target

All future Genesis work orders, certifications, and releases reference this package and execute standardized quality profiles with deterministic evidence output.
