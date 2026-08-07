# 07 Balance Commitment Mutation

InventoryBalanceService extended with controlled methods:
- applyReserve
- applyReleaseReserved
- applyAllocate
- applyReleaseAllocated
- applyConvertReservedToAllocated

All methods enforce:
- Expected version checks.
- Positive quantity requirements.
- Non-negative reserved/allocated results.
- No over-reservation or over-allocation.
- Deterministic version increments and token updates.

Canonical available quantity now accounts for reserved and allocated commitments.
