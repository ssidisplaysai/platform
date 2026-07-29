# Genesis Commerce Platform Test Coverage Assessment

## Focused Suite Evidence
- Command: npm test -- src/modules/foundation/__tests__/commerce-foundation.test.ts src/modules/foundation/__tests__/multi-site-foundation.test.ts src/modules/foundation/__tests__/product-catalog-foundation.test.ts src/modules/foundation/__tests__/product-catalog-api.test.ts src/modules/foundation/__tests__/inventory-foundation.test.ts src/modules/foundation/__tests__/inventory-api.test.ts src/modules/foundation/__tests__/integration-profiles-foundation.test.ts src/modules/foundation/__tests__/integration-profiles-api.test.ts src/modules/foundation/__tests__/customer-foundation.test.ts src/modules/foundation/__tests__/customer-api.test.ts --runInBand
- Result: 10 suites passed, 90 tests passed.

## Invariant Coverage Mapping
| Invariant | Coverage Status | Evidence |
|---|---|---|
| Authorization | Covered | product/inventory/profile/customer API suites include forbidden-role assertions. |
| Validation | Covered | catalog/inventory/profile/customer validation and API tests. |
| Readiness | Covered | site/product/profile/customer readiness tests and API checks. |
| Invalid state transitions | Covered | inventory movement/reservation/reversal/count tests. |
| Duplicate detection | Covered | customer-foundation and customer-api tests. |
| Inventory calculations | Covered | inventory foundation and repository behavior tests. |
| Reservation behavior | Covered | inventory foundation/API tests. |
| Movement reversal | Covered | inventory API and repository behavior tests. |
| Secret rejection | Covered | multi-site, integration-profile, customer validation tests. |
| Sensitive-field rejection | Partially covered | secret-like patterns covered; broader PII-policy tests limited. |
| Invalid IDs | Covered | detail/readiness/contact/address API tests verify not-found paths. |
| Route rendering | Partially covered | route smoke checks performed outside Jest; minimal direct route unit tests. |
| API behavior | Covered | dedicated API suites for product/inventory/profile/customer. |

## Coverage Gaps
- Blocking before Quotes:
  - Missing tests asserting read authorization on /api/sites, /api/products, /api/inventory collection GET endpoints versus declared permissions.
- High priority:
  - Add explicit organization-scope and site-scope bypass tests across all domain APIs.
- Medium priority:
  - Add consistent error-contract shape tests across all API families.
- Low priority:
  - Add UI unauthorized-rendering assertions for key detail routes.

## Assessment
- Focused foundation coverage is strong for bounded functionality.
- Specific authorization regression gaps remain and are addressed in remediation recommendation.
