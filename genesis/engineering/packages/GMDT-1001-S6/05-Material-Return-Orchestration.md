# 05 Material Return Orchestration

File: src/platform/manufacturing/services/MaterialIssueService.ts

Behavior:
- Return request routed to bounded inventory port
- No local returned quantity mutation when external return request is rejected
- Reconciliation-required classification when external acceptance occurs but local commit fails
