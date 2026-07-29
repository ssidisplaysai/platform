# GCP-0002M1-R1A Authorization Conformance Remediation

## Package
- ID: GCP-0002M1-R1A
- Title: Commerce Foundation Authorization Conformance Remediation
- Predecessor: GCP-0002M1
- Target finding: GCP-0002M1-F001

## Executive Outcome
- Implementation status: IMPLEMENTED
- Finding status target: CLOSED
- Persistence finding status: unchanged and open (GCP-0002M1-F002)

## Policy Decision
- Approved policy: enforce declared read capabilities; do not broaden viewer access.
- Viewer decision: viewer remains denied for Sites, Products, Inventory, Categories, Manufacturers, Profiles, Customers, Contacts, Addresses APIs.
- Auth model decision: strict auth identity required for API access.

## Implementation Summary
1. Added shared strict auth and scope utilities in `src/modules/foundation/api-auth.ts`.
2. Enforced read capability checks on collection and detail routes for Sites, Products, Inventory, Categories, Manufacturers.
3. Added mandatory organization scope and optional site scope filtering for collections and details in remediated route families.
4. Standardized unauthorized responses to `401` (unauthenticated) and `403` (authenticated but unauthorized).
5. Preserved `404` non-disclosure behavior for out-of-scope detail resources.
6. Extended scope conformance across Profiles and Customers read routes.
7. Added new site API authorization suite and expanded existing API suites for auth/scope regressions.

## Files Remediated (Code)
- src/modules/foundation/api-auth.ts
- src/app/api/sites/route.ts
- src/app/api/sites/[siteId]/route.ts
- src/app/api/products/route.ts
- src/app/api/products/[productId]/route.ts
- src/app/api/products/[productId]/readiness/route.ts
- src/app/api/inventory/route.ts
- src/app/api/inventory/availability/route.ts
- src/app/api/inventory/counts/route.ts
- src/app/api/inventory/locations/route.ts
- src/app/api/inventory/locations/[locationId]/route.ts
- src/app/api/inventory/movements/route.ts
- src/app/api/inventory/movements/[movementId]/route.ts
- src/app/api/inventory/reservations/route.ts
- src/app/api/inventory/reservations/[reservationId]/route.ts
- src/app/api/categories/route.ts
- src/app/api/manufacturers/route.ts
- src/app/api/profiles/route.ts
- src/app/api/profiles/[profileId]/route.ts
- src/app/api/profiles/readiness/route.ts
- src/app/api/customers/route.ts
- src/app/api/customers/[customerId]/route.ts
- src/app/api/customers/[customerId]/readiness/route.ts
- src/app/api/customers/[customerId]/duplicates/route.ts
- src/app/api/customers/[customerId]/contacts/route.ts
- src/app/api/customers/[customerId]/addresses/route.ts

## Files Remediated (Tests)
- src/modules/foundation/__tests__/multi-site-api.test.ts (new)
- src/modules/foundation/__tests__/product-catalog-api.test.ts
- src/modules/foundation/__tests__/inventory-api.test.ts
- src/modules/foundation/__tests__/integration-profiles-api.test.ts
- src/modules/foundation/__tests__/customer-api.test.ts

## Validation Highlights
- Focused authorization suites: pass (6 suites, 35 tests).
- Full focused GCP foundation regression: pass (11 suites, 95 tests).
- Scoped lint over remediated surfaces: pass.
- Repository-wide gates remain known baseline failures outside bounded remediation scope.

## Finding Closure
- F001 closure result: CLOSED
- Closure evidence:
  - Runtime read endpoints now enforce declared read capabilities.
  - Viewer no longer receives `200` on remediated collection reads.
  - Collection and detail behaviors are scope-conformant with non-disclosure detail fallback.
  - Focused tests added and passing.

## Residual Conditions
- F002 (persistence transactional readiness) remains OPEN and is deferred to GCP-0002M1-R1B.
- Taxonomy organization partitioning for categories/manufacturers remains deferred architecture work; capability + scoped request requirement is enforced in R1A.
