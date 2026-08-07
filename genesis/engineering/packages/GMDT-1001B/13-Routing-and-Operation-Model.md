# 13 Routing and Operation Model

## Ownership Distinction

- Product design-time process/routing definition remains Product authority.
- Manufacturing execution routing is a Manufacturing-owned instantiation.

## ExecutionRouting Model

Includes:
- routing identity
- source Product routing or version reference
- routing steps and sequence
- operation definitions
- work center and production cell references
- machine and tool requirements
- labor requirements
- expected cycle, setup, and run times
- predecessor and successor dependencies
- conditional and parallel execution policies
- quality and material checkpoints
- execution state

## Operation and Step Constraints

- dependency graph must be acyclic except approved bounded rework loops
- conditional operations require explicit gating predicates
- skip behavior requires explicit reason and authority
- terminal operation semantics must close required predecessor obligations

## OperationExecution Model

Required fields:
- operationExecutionId
- workOrderReference
- routingStepReference
- status
- assignedWorkCenterReference
- assignedMachineOrToolReferences
- laborReferences
- plannedQuantity
- startedQuantity
- completedQuantity
- rejectedQuantity
- scrapQuantity
- reworkQuantity
- startTime
- endTime
- downtimeReferences
- materialConsumptionReferences
- outputReferences
- audit evidence
- version

Operation lifecycle is governed independently from work-order lifecycle with coherence checks.
