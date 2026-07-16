# GCC-1004 Closure Evidence

| Check | Result | Evidence | Notes |
|---|---|---|---|
| Focused GCC-1004 tests | PASS | `npx tsx --test tests/compiler/knowledge/knowledge-canonical-compiler.test.ts tests/compiler/knowledge/deterministic-knowledge-compilation.test.ts tests/compiler/knowledge/knowledge-compiler.test.ts tests/compiler/knowledge/knowledge-validator.test.ts` | 7 passed, 0 failed, 0 skipped |
| GCC-1002 compiler-kernel integration | PASS | `npx tsx --test tests/compiler/core/compiler-kernel.test.ts` | Kernel remains deterministic |
| GCC-1003 regression tests | PASS | `npm run test:jest` and `npm run test:node` | GCC-1003 regression coverage passed in repository runners |
| Repository Jest suite | PASS | `npm run test:jest` | 372 tests passed |
| Repository node suite | PASS | `npm run test:node` | 297 tests passed |
| Repository compiler suite | PASS | `npm run test:compiler` | 20 tests passed |
| Repository aggregate suite | PASS | `npm test` | 297 tests passed, 0 failed |
| Smoke aggregate suite | PASS | `npm run test:all -- --smoke` | 3 smoke runners passed |
| Touched-scope TypeScript | PARTIAL | `npx tsc --noEmit ...` | Clean in touched slice; blocked by unrelated genome error outside scope |
| Touched-scope ESLint | PASS | `npx eslint ...` | Clean on touched GCC-1004 files |
| Workspace diagnostics | PASS | `get_errors` on touched slice | No GCC-1004-file diagnostics; unrelated genome issue remains outside slice |
| Archive integrity | PASS | SHA-256 comparison of package and canonical ZIP | Byte-identical archives |
