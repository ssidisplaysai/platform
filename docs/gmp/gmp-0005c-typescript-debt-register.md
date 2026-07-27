# GMP-0005C TypeScript Debt Register

## Debt ID
TD-GMP-0005C-TS-TEMPLATE-001

## Affected Paths
- tools/genesis/templates/entity/search.template.ts
- tools/genesis/templates/entity/service.template.ts
- tools/genesis/templates/entity/tests.template.ts
- tools/genesis/templates/entity/repository.template.ts
- tools/genesis/templates/entity/controller.template.ts

## Failure Summary
Global `npx tsc --noEmit` fails on placeholder template tokens such as `{{EntityName}}` and `{{entityNameLower}}`, which are intentionally non-TypeScript placeholders before template materialization.

## Runtime Impact
None. These files are template assets and are not loaded by Next.js runtime paths, GMP publishing API handlers, or GOP runtime execution for deployed flows.

## GMP-0005 Impact
No direct impact to GMP-0005 publishing behavior. GMP-0005C authorization and endpoint closure tests pass independently.

## Owner
Genesis Compiler / Template Tooling Maintainers

## Recommended Remediation
- Move template sources outside default TypeScript include glob.
- Or add typed template wrappers/preprocessing step before typecheck.
- Or split CI typecheck into runtime and template-lint phases.

## Priority
P2 - Medium

## Disposition
Accepted technical debt for freeze certification; tracked as repository-wide tooling debt.

---

## Debt ID
TD-GMP-0005C-TS-RUNTIME-BOUNDARY-002

## Affected Paths
- src/lib/gmp/page-repository.ts
- src/lib/gmp/publishing-repository.ts
- src/lib/gmp/publishing-services.ts
- src/platform/gop/runtime/execution-engine.ts
- src/platform/gop/runtime/execution-repository.ts
- src/platform/gop/runtime/orchestrator.ts
- src/platform/gop/runtime/replay-engine.ts

## Failure Summary
Publishing-wide focused TypeScript project (`tsconfig.gmp-0005.json`) surfaces pre-existing strict typing issues in GMP and GOP runtime boundary modules not modified by GMP-0005C.

## Runtime Impact
No failing runtime assertions observed in GMP/GOP tests; behavior remains stable under validated suites.

## GMP-0005 Impact
No behavioral regression introduced by GMP-0005C. Closure-specific TypeScript project (`tsconfig.gmp-0005c-closure.json`) for files changed in this pass typechecks clean.

## Owner
GMP Core + GOP Runtime Maintainers

## Recommended Remediation
- Resolve strict typing drift in listed files.
- Introduce scoped tsconfig targets per module boundary to prevent unrelated blocker coupling.

## Priority
P2 - Medium

## Disposition
Accepted technical debt for GMP-0005 freeze, non-blocking to publishing authorization closure.
