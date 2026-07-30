# Genesis Commerce Platform Customer Readiness and Duplicate Policy

## Readiness Conditions
1. customer_enabled
2. lifecycle_permits_operation
3. primary_site_assigned
4. site_association_present
5. primary_contact_present
6. contact_reachable
7. billing_address_present
8. shipping_address_present
9. communication_preferences_defined
10. user_has_permission

## Readiness Output Contract
1. customerId
2. ready
3. status (ready, blocked, warning)
4. blockingReasons
5. warnings
6. checkedConditions
7. checkedAt

## Duplicate Detection Policy
1. Same-organization account name match contributes duplicate evidence.
2. Same-organization account code match contributes duplicate evidence.
3. Shared contact email contributes duplicate evidence.
4. Confidence scoring is deterministic from matched reason count and bounded below 1.0.

## Duplicate Output Contract
1. customerId
2. matchedCustomerId
3. reasons
4. confidence

## Boundary Statement
Readiness and duplicate policies provide deterministic advisory outputs only and do not perform merge or external identity resolution.
