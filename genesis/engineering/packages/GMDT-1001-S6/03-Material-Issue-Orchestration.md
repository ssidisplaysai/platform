# 03 Material Issue Orchestration

File: src/platform/manufacturing/services/MaterialIssueService.ts

Behavior:
- Deterministic idempotency by payload fingerprint
- Availability -> reservation -> allocation -> issue flow
- Local requirement issued quantity mutation only after external acceptance
- Reconciliation-required classification when external acceptance occurs but local commit fails
