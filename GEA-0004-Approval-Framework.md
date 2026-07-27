# GEA-0004 Approval Framework

## Approval Design
- High-risk or approval-required stages create approval checkpoints.
- Checkpoints include required approvers, current approvers, timeout, and escalation policy payload.
- Approval state is persisted and queryable via orchestration approvals API.

## Lifecycle
1. Execution reaches approval-gated stage.
2. Checkpoint is created and execution state transitions to waiting approval.
3. Approved stages resume execution flow.
4. Cancellation cascades to approval cancellation state.

## Authorization
- Approval and workflow-control actions are governed by GOP orchestration permissions.
- Protected GLW workspace sections are conditionally rendered by approved action scope.

## Auditability
- Approval checkpoint records and execution timeline provide immutable evidence of approval decisions.
