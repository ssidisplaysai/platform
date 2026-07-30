# Genesis Commerce Platform State Model Comparison

## Comparison Matrix
| Domain | Lifecycle/Status Fields | Readiness Model | Enabled Flag | Transition Enforcement | Notes |
|---|---|---|---|---|---|
| Sites | lifecycleState, healthStatus, publishingStatus | evaluateSiteReadiness -> ready/status/blockingReasons/warnings/checkedConditions/checkedAt | yes | partial (validation + readiness guards) | Publishing status separated from lifecycle.
| Products | lifecycleState, catalogStatus, visibility | evaluateProductReadiness -> ready/status/blockingReasons/warnings/checkedConditions/checkedAt | yes | partial (validation + readiness guards) | Catalog status separated from lifecycle; visibility separated.
| Categories | status | none | no dedicated enabled flag | limited | Simpler taxonomy lifecycle.
| Manufacturers | status | none | no dedicated enabled flag | limited | Reference registry model.
| Inventory Locations | lifecycleState, healthStatus | location availability derived by repository evaluators | yes | explicit invalid transition checks in repository | Transactional guards disallow archived/suspended/disabled transactional use.
| Inventory Movements | status, movementType | availability/reorder outputs derived separately | n/a | explicit reverse rules and state guards | Includes reversed/cancelled statuses.
| Inventory Reservations | status | availability impact via stock mutation | n/a | explicit fulfillment/release/expiry guards | Active-only fulfillment path enforced.
| Integration Profiles | status | evaluateIntegrationProfileReadiness -> ready/warnings/blockers/checkedConditions/timestamp | yes | validation + assignment integrity | Readiness field names use blockers/timestamp rather than blockingReasons/checkedAt.
| Customers | lifecycleState | evaluateCustomerReadiness -> customerId/ready/status/blockingReasons/warnings/checkedConditions/checkedAt | yes | update validation and link integrity checks | Customer lifecycle distinct from readiness.
| Contacts | enabled | none | yes | validation only | No independent readiness model.
| Addresses | enabled | none | yes | validation only | No independent readiness model.

## Consistency Assessment
- Lifecycle and readiness are mostly separated.
- Enabled is not universally conflated with readiness; evaluators combine enabled plus domain conditions.
- Publication state is separate from product catalog state.
- Inventory stock status is separate from product lifecycle/catalog status.
- Customer lifecycle remains separate from inventory/commercial transaction statuses.

## Divergence Identified
- Integration profile readiness contract uses blockers and timestamp fields while site/product/customer readiness use blockingReasons and checkedAt.
- Domain-specific variation is technically acceptable but increases cross-domain tooling friction.

## Recommendation
- Introduce a shared application readiness envelope contract adapter (non-breaking) for reporting layers while preserving domain-specific evaluator internals.
