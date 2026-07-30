# GCP-0002M1-R1B Durable Persistence Remediation

## Objective
Close finding GCP-0002M1-F002 by replacing non-durable in-memory foundation repositories with a durable, swappable persistence foundation and transaction-safe mutation model.

## Scope Implemented
1. Added file-backed persistence runtime in src/modules/foundation/foundation-persistence.ts.
2. Migrated site, product, integration profile, customer, and inventory repositories to revisioned durable persistence files.
3. Added optimistic concurrency enforcement at persistence boundary (expectedRevision conflict detection).
4. Added rollback behavior for multi-step inventory mutation workflows.
5. Added deterministic reset hooks for site/product repositories and integrated reset usage into site/product test suites.
6. Added durable persistence conformance tests in src/modules/foundation/__tests__/durable-persistence.test.ts.

## Transaction and Safety Guarantees Delivered
1. Durable write envelope with schema version, revision token, and atomic file replacement.
2. Repository mutation commit pattern: mutate in-memory state, persist, then return success.
3. Repository mutation rollback pattern (inventory): capture snapshot before mutation; restore on failure.
4. Cross-process optimistic concurrency token conflict signaling via FoundationPersistenceConflictError.

## Explicit Boundaries Preserved
1. No quote/order/invoice/payment/credit/tax/shipping aggregate implementation.
2. No ERP/CRM runtime integration.
3. No credential material storage.
4. No Business Genome mutation authority changes.

## Validation Evidence
1. Focused foundation regression suites: 11/11 passed, 93/93 tests.
2. Durable persistence suite: 1/1 passed, 5/5 tests.
3. Scoped lint on all touched R1B files: passed.

## Outcome
- GCP-0002M1-F002 status: CLOSED for foundation scope.
- Foundation persistence boundary: durable and transaction-foundation ready for next bounded package work.
