# Workflow Domain Model

## Core Contracts

- Workflow
- WorkflowDefinition
- WorkflowVersion
- WorkflowInstance
- WorkflowContext
- WorkflowVariable
- WorkflowState
- WorkflowStep
- WorkflowTransition
- WorkflowEvent
- WorkflowAction
- WorkflowResult
- WorkflowCheckpoint
- WorkflowCompensation
- WorkflowTimeout
- WorkflowMetrics
- WorkflowHealth
- WorkflowAudit
- WorkflowExecutionRecord

## State Model

CREATED -> RUNNING -> COMPLETED
CREATED/RUNNING -> PAUSED -> RESUMED -> RUNNING
RUNNING -> FAILED
RUNNING -> TIMED_OUT
CREATED/RUNNING/PAUSED -> CANCELLED
FAILED/TIMED_OUT -> COMPENSATING (transient during compensation)

## Execution Model

1. Definition registration
2. Instance creation with tenant/workspace context
3. Step execution with variable resolution
4. Transition evaluation and next-step routing
5. Retry application per-step policy
6. Timeout handling
7. Checkpoint persistence in execution lifecycle
8. Compensation execution on terminal failure
9. Audit and metrics emission throughout lifecycle
