# GCC-1003 Traceability

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Canonical Evidence model | `src/evidence-ir/models/index.ts` | Compiler and package reports |
| Evidence IR compiler | `src/evidence-ir/compiler/index.ts` | `tests/compiler/evidence-ir-compiler.test.ts` |
| Deterministic identities | `src/evidence-ir/identity/index.ts` | Focused compiler tests |
| Canonical normalization | `src/evidence-ir/canonicalization/index.ts` | Focused compiler tests |
| Deduplication | `src/evidence-ir/compiler/index.ts` | Package-level dedup test |
| Structural validation | `src/evidence-ir/validation/index.ts` | Invalid-content test |
| Stable ordering | `src/evidence-ir/compiler/index.ts` | Input-order determinism test |
| Compiler kernel integration | `src/compiler/stages/EvidenceCompiler.ts` | `tests/deterministic-eko.test.ts` |
| Metrics and diagnostics | `metrics.json`, `validation.json` | Jest, node:test, npm test |
