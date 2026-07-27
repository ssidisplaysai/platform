# Genesis Runtime Constitution

Status: Ratified
Milestone: GOP-0004A
Effective Runtime Baseline: GOP-0004 implementation in current repository

## 1. Constitutional Scope

This document freezes the Genesis Runtime architecture introduced in GOP-0004. It is the governing specification for GOP-0005 and later milestones.

In scope:

- execution runtime model
- job, event, queue, worker, operations, and security boundaries
- service contracts and extension constraints
- runtime versioning rules

Out of scope for this milestone:

- distributed execution
- redesign of runtime behavior
- UI redesign
- callback contract changes
- database schema changes for runtime features

## 2. Constitutional Principles

1. Nothing executes directly. All orchestrated work is represented by an execution.
2. Executions can produce and synchronize with jobs.
3. Jobs emit events. Events reconstruct timeline and state.
4. Runtime state drives operations and inspector surfaces.
5. Workspace and authorization boundaries apply to all runtime reads and writes.

## 3. Frozen Runtime Components

The following components are constitutionally frozen at interface and behavior level:

- Execution Engine
- Workflow Orchestrator Utilities
- Queue Manager
- Worker Registry
- Notification Center
- Operations Snapshot Aggregator
- Execution Inspector Runtime Context
- Runtime API Surfaces

## 4. Immutable Invariants

### 4.1 Execution Invariants

- Every execution has a globally unique executionId.
- Execution status transitions must pass transition validation.
- Terminal execution states are SUCCEEDED, FAILED, CANCELLED, TIMED_OUT.
- ARCHIVED can only be reached from a terminal execution state.
- Transition from ARCHIVED to non-archived states is forbidden.
- Retry entries are append-only and monotonic by attempt number.
- Parent execution references are immutable after creation.

### 4.2 Event Invariants

- Every event has a unique eventId.
- Event sequence is strictly increasing per jobId.
- Event append is serialized per jobId.
- Non-terminal events after a terminal status are rejected.
- Correlation mismatch for the same job timeline is rejected.
- Idempotent append must return existing equivalent events when idempotency key matches.

### 4.3 Queue Invariants

- Queue dequeue is disabled whenever queue state is not ACTIVE.
- Rate limit is enforced per worker type over a rolling minute window.
- Future-scheduled items are not eligible before scheduledFor time.
- Priority order is dominant, with age boost to reduce inversion.

### 4.4 Worker Invariants

- workerId is the stable identity key for worker state updates.
- Workload is bounded between 0 and maxCapacity.
- Heartbeat updates timestamp and can recover OFFLINE to DEGRADED.

### 4.5 Security Invariants

- Session authentication remains mandatory for runtime API access.
- Runtime reads and controls pass authorization policies.
- Workspace boundary is always explicit in operations surfaces.

## 5. Ownership Boundaries

- Execution Engine owns execution lifecycle validity and execution timing metrics.
- Queue Manager owns queue state and dequeue policy.
- Worker Registry owns worker health/workload records.
- Event Store owns durable event ordering and replay correctness.
- Operations API owns snapshot publication, not state mutation semantics.

## 6. Frozen Service Contract Matrix

Execution Engine:

- create execution
- validate and apply status transitions
- append retry metadata

Queue Manager:

- enqueue
- dequeue by worker type
- state control pause/resume/drain
- queue depth by priority

Worker Registry:

- register
- heartbeat
- health updates
- assign and release work

Notification Center:

- emit notifications
- list and unread views
- mark read

Health and Metrics Aggregation:

- derive health from worker lag, queue latency, and runtime state
- derive metrics from runtime/event-derived summaries

Authorization:

- policy-based allow/deny checks remain mandatory for runtime APIs and discovery

Inspector Host:

- receives job plus optional execution runtime context
- renders execution graph/node/retry/dependency context without mutating runtime

Module and Workspace Registries:

- control route discovery and workspace scoping
- remain policy-filtered

## 7. Deferred Constitutional Items

Deferred to GOP-0005+:

- durable execution persistence model
- distributed queue and worker lease protocol
- cross-node worker trust and signed runtime tokens
- advanced health signal ingestion from external systems

## 8. Change Control

Any future change that alters these invariants requires:

1. explicit constitution amendment proposal
2. migration and compatibility strategy
3. contract version bump under versioning-model.md
4. approval before implementation
