# 03 BOM Cycle Prevention

Implementation summary:

1. Added deterministic BOM graph cycle validation in Product domain invariants.
2. BOM validation executes during mutation and recovery via enforceDomainInvariants.
3. Validation rejects:
- direct self-reference cycles
- two-node cycles
- multi-level and indirect ancestry cycles

Behavior guarantees:

1. Fail-closed rejection with deterministic ProductError code INVARIANT_VIOLATION.
2. No partial state mutation on rejection.
3. Tenant-safe graph evaluation.
4. Version-aware graph partitioning for cycle checks.
5. Rejection evidence emitted through audit and cycleRejectionCount metrics.

Non-expansion confirmation:

- BOM remains definition-only; no manufacturing execution behavior added.