# Genesis Commerce Platform Availability Policy

## Policy Intent
Define deterministic application-level availability evaluation for bounded inventory operations.

## Availability Inputs
1. Product identity and organization scope.
2. Site scope (optional, policy-dependent).
3. Per-location stock records and derived available quantity.
4. Product lifecycle state metadata.

## Availability Outputs
1. Per-location availability summaries.
2. Aggregate availability signal for requested scope.
3. Derived stockStatus for display and policy gates.

## Policy Rules
1. Availability is computed from derived available quantity, not raw on-hand only.
2. Damaged/hold/reserved/allocated quantities reduce available quantity.
3. Incoming quantity is visible but does not increase immediate available quantity.
4. Archived product lifecycle is unavailable for actionable inventory operations.
5. Evaluation output is deterministic for same repository state and inputs.
