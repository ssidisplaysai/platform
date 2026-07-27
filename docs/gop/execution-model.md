# Execution Model

Status: Frozen by GOP-0004A

## 1. Execution Identity

Execution identity fields:

- executionId: immutable primary identifier
- workspaceId: execution tenancy boundary
- moduleId: owning module boundary
- jobType: workload class
- executionClass: INTERACTIVE, AUTOMATED, SCHEDULED, SYSTEM

Execution identity is immutable after creation, except output and operational fields that evolve with state.

## 2. Execution Lifecycle

Canonical lifecycle states:

- CREATED
- SCHEDULED
- QUEUED
- DISPATCHED
- RUNNING
- WAITING
- BLOCKED
- RETRYING
- SUCCEEDED
- FAILED
- CANCELLED
- TIMED_OUT
- ARCHIVED

## 3. State Transition Rules

Frozen transition constraints:

- any state to itself is valid
- ARCHIVED is terminal and non-reversible
- SUCCEEDED, FAILED, CANCELLED, TIMED_OUT transition only to ARCHIVED
- WAITING or BLOCKED may resume to RUNNING or DISPATCHED
- all other forward transitions are monotonic by lifecycle order

Invalid transition attempts are rejected by runtime.

## 4. Ownership and Hierarchy

Execution owns:

- context
- input
- output
- worker reference
- graph and current node
- timing and metrics
- retry history

Hierarchy model:

- parentExecutionId identifies parent when present
- childExecutionIds track spawned children
- parent linkage is immutable once set

## 5. Retry Semantics

Retries are represented by:

- status RETRYING
- append-only retryHistory entries
- monotonic attempt counters
- retained failure reason per attempt

Retry policy defaults are runtime-defined and bounded. Current GLW synchronization applies retry tracking on FAILED transitions with bounded attempts.

## 6. Cancellation and Timeout

Cancellation and timeout are first-class terminal outcomes:

- CANCELLED for explicit stop
- TIMED_OUT for runtime timeout policy

Both preserve forensic context and can be archived later.

## 7. Failure Semantics

Failure means execution produced no successful terminal output.

Failure must preserve:

- latest execution context
- retry history
- graph position
- correlation linkage
- terminal timestamp

## 8. Recovery Semantics

Current frozen recovery behavior:

- WAITING or BLOCKED can resume to RUNNING
- failed execution can move to RETRYING via retry semantics
- archival is explicit and separate from failure

## 9. Archival

ARCHIVED marks closed lifecycle retention state.

Archival intent:

- preserve immutable historical record
- remove execution from active operational focus

## 10. GLW Execution Mapping

GLW page-generation jobs synchronize execution status as:

- QUEUED -> QUEUED
- STARTING -> DISPATCHED
- RUNNING and active intermediate statuses -> RUNNING
- COMPLETE -> SUCCEEDED
- FAILED -> FAILED
- CANCELLED -> CANCELLED
- TIMED_OUT -> TIMED_OUT
- ARCHIVED -> ARCHIVED

This mapping is frozen for compatibility unless amended.
