# GKP-0001 - Replay Certification Report

Status: PASS
Date: 2026-07-27

## Objective
Certify deterministic replay behavior for analytics, evidence compilation, recommendation generation, and compiler-core determinism.

## Replay Validation Commands
- npm test -- tests/gmp/gmp-recommendation-services.test.ts tests/gmp/gmp-evidence-compiler-services.test.ts tests/gop/execution-durability.test.ts tests/deterministic-eko.test.ts
  - PASS (4 suites, 26 tests)
- npx tsx --test tests/compiler/core/compiler-core-determinism.test.ts
  - PASS (1 test)

## Additional Diagnostic Note
- Command attempted initially under incompatible runner:
  - npm test -- tests/compiler/core/compiler-core-determinism.test.ts
  - Result: FAIL due to Jest runner mismatch (suite contains node:test tests)
- Corrected execution under tsx test runner passed.

## Determinism Domains Verified
- Observations and evidence normalization determinism
- Evidence snapshot deterministic checksum behavior
- Recommendation replay deterministic match behavior
- Compiler-core deterministic artifact replay

## Findings
- Blocker: None
- Major: None
- Minor: None
- Observation: Mixed test framework usage (Jest plus node:test) requires runner-specific replay commands.

## Conclusion
Replay certification is PASS.
Deterministic replay controls are operational across certified domains.
