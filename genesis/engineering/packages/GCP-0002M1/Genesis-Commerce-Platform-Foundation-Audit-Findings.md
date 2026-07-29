# Genesis Commerce Platform Foundation Audit Findings

## GCP-0002M1-F001
- Title: Unprotected collection read APIs bypass declared permission policy
- Domain: Authorization / API Conformance
- Severity: High
- Classification: Authorization defect
- Evidence:
  - Viewer access returned 200 for /api/sites, /api/products, /api/inventory
  - Declared permissions model does not grant viewer sites:read/products:read/inventory:read
  - Files: src/app/api/sites/route.ts, src/app/api/products/route.ts, src/app/api/inventory/route.ts, src/modules/foundation/permissions.ts
- Impact:
  - Inconsistent access-control semantics and broader data exposure than policy indicates.
- Required action:
  - Enforce server-side read authorization on affected collection GET handlers or revise permission policy and docs to match implementation.
- Recommended action:
  - Add shared auth wrapper for collection handlers and regression tests for viewer denial/allowance matrix.
- Blocking status: Resolved in R1A
- Owner category: Application API ownership
- Target package: GCP-0002M1-R1A
- Remediation summary:
  - Strict auth introduced in `src/modules/foundation/api-auth.ts` via `authorizeRequest`.
  - Read capability checks enforced for affected site/product/inventory routes.
  - Mandatory organization scope and optional site scope applied to read collections/details.
  - Viewer now receives 403; unauthenticated requests receive 401.
  - New and updated tests validate no-auth, viewer denial, authorized reads, and scope behavior.
- Runtime verification:
  - Focused authorization suites passed (35 tests).
  - Full focused GCP regression passed (95 tests).
- Closure status: CLOSED
- Residual conditions:
  - None for F001 within bounded authorization scope.

## GCP-0002M1-F002
- Title: Foundation persistence is non-durable and non-transactional for transactional aggregate needs
- Domain: Repository / Persistence
- Severity: Critical
- Classification: Data-integrity defect
- Evidence:
  - In-memory Map repositories and fixture seeding in site/product/inventory/profile/customer repositories.
  - Process-local mutation and no durable transactional boundary.
  - Files: src/modules/foundation/site-repository.ts, src/modules/foundation/product-repository.ts, src/modules/foundation/inventory-repository.ts, src/modules/foundation/integration-profile-repository.ts, src/modules/foundation/customer-repository.ts
- Impact:
  - Quote aggregate cannot be safely implemented with durability, concurrency, and atomicity requirements.
- Required action:
  - Establish durable repositories and transaction strategy before quote module starts.
- Recommended action:
  - Introduce repository interfaces plus persistence adapters with migration plan from fixture stores.
- Blocking status: Blocking
- Owner category: Platform application architecture
- Target package: GCP-0002M1-R1B

## GCP-0002M1-F003
- Title: Readiness result contract fields diverge across domains
- Domain: Type System / Conformance
- Severity: Medium
- Classification: Conformance defect
- Evidence:
  - Profile readiness uses blockers/timestamp.
  - Site/Product/Customer readiness use blockingReasons/checkedAt.
  - Files: src/modules/foundation/types.ts, src/modules/foundation/integration-profile-readiness.ts, src/modules/foundation/site-readiness.ts, src/modules/foundation/product-readiness.ts, src/modules/foundation/customer-readiness.ts
- Impact:
  - Cross-domain reporting and tooling adapters require per-domain branching.
- Required action:
  - Define a normalized readiness reporting envelope for cross-module consumers.
- Recommended action:
  - Add non-breaking adapter functions instead of forcing evaluator rewrites.
- Blocking status: Non-blocking
- Owner category: Foundation contracts
- Target package: GCP-0002M1-R1

## GCP-0002M1-F004
- Title: Default request role fallback may over-grant in no-header contexts
- Domain: Security / Authorization
- Severity: Medium
- Classification: Security defect
- Evidence:
  - resolveRequestRoles defaults to ops_manager when x-gcp-roles header absent.
  - File: src/modules/foundation/api-auth.ts
- Impact:
  - If route-level guards rely on missing headers, default role could exceed least privilege assumptions.
- Required action:
  - Replace default role fallback with explicit anonymous/viewer baseline in production-facing boundaries.
- Recommended action:
  - Keep configurable dev fallback behind explicit development flag.
- Blocking status: Non-blocking for bounded mode; blocking for production hardening
- Owner category: Security architecture
- Target package: GCP-0002M1-R1

## GCP-0002M1-F005
- Title: Singular /profile/[id] and plural /profiles split lacks explicit governance note
- Domain: UI Routing / Documentation
- Severity: Low
- Classification: Documentation defect
- Evidence:
  - Registry routes use /profiles/* while detail route uses /profile/[id].
  - Files: src/app/profiles/page.tsx, src/app/profile/[id]/page.tsx, src/modules/foundation/navigation.ts
- Impact:
  - Route naming may drift if intent is not documented.
- Required action:
  - Document naming rationale and conventions in navigation architecture artifacts.
- Recommended action:
  - Optionally normalize to a single plural hierarchy in future non-breaking migration.
- Blocking status: Non-blocking
- Owner category: UX architecture
- Target package: GCP-0002M1-R1

## GCP-0002M1-F006
- Title: Missing explicit tests for collection read authorization on selected APIs
- Domain: Test Coverage
- Severity: Medium
- Classification: Test gap
- Evidence:
  - Focused suites assert many write/evaluate forbiddens but do not block current read-policy drift on /api/sites, /api/products, /api/inventory.
  - Files: src/modules/foundation/__tests__/multi-site-foundation.test.ts, src/modules/foundation/__tests__/product-catalog-api.test.ts, src/modules/foundation/__tests__/inventory-api.test.ts
- Impact:
  - Permission-policy regressions can ship unnoticed.
- Required action:
  - Add explicit viewer/analyst/operator read-policy assertions for all foundation collection APIs.
- Recommended action:
  - Add one shared authorization contract test helper.
- Blocking status: Resolved in R1A
- Owner category: Test engineering
- Target package: GCP-0002M1-R1A
