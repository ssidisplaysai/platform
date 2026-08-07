# 05 Allocation Service

Implemented AllocationService responsibilities:
- Create allocation with item/balance validation.
- Enforce expected balance version.
- Support partial allocation only when explicitly allowed.
- Release allocation (full or partial).
- Convert reservation to allocation when reservation context is supplied.
- Deterministic listing and retrieval.
- Audit accept/reject/replay outcomes.

Allocation operations mutate commitment quantities only. No picking or physical movement was added.
