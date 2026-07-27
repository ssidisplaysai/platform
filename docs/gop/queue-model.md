# Queue Model

Status: Frozen by GOP-0004A

## 1. Queue Identity and Ownership

Queue item identity:

- queueItemId
- executionId
- workspaceId
- moduleId
- workerType
- executionClass
- priority
- enqueuedAt
- optional scheduledFor

Queue Manager is runtime-owned and currently process-local.

## 2. Queue States

Queue state values:

- ACTIVE
- PAUSED
- DRAINING

Frozen behavior:

- dequeue only allowed in ACTIVE
- PAUSED blocks dequeue
- DRAINING marks non-active operational mode and blocks dequeue in current runtime

## 3. Priority and Inversion Protection

Priority classes:

- LOW
- NORMAL
- HIGH
- URGENT

Selection algorithm:

- base score by priority
- additive age boost using elapsed enqueue time
- highest score dequeued first

This age boost is the current inversion mitigation baseline.

## 4. Scheduling

scheduledFor enables future execution release.

Frozen rule:

- scheduled items are ineligible until scheduledFor <= now

## 5. Pause, Resume, Drain

Operations:

- pause sets state PAUSED
- resume sets state ACTIVE
- drain sets state DRAINING

These operations are administrative controls and do not mutate queued items directly.

## 6. Retry and Backoff

Current frozen queue behavior:

- queue does not embed backoff strategy itself
- retries are represented at execution layer and may re-enqueue

Backoff policy is deferred and must be layered as orchestrator policy in later milestones.

## 7. Rate Limiting

Frozen rule:

- per workerType rolling one-minute dispatch window
- current limit is capped at 60 dequeues per minute per workerType

## 8. Worker Assignment

Dequeue call is scoped by workerType, providing worker-class routing.

Assignment ownership:

- queue decides dispatch candidate order
- worker registry tracks workload and health
- orchestrator coordinates the two for effective dispatch

## 9. Future Distributed Assumptions

Constitutional assumption for GOP-0005+:

- queue contract remains stable while implementation may move to distributed backend
- future distributed queue must preserve priority, scheduling, and state semantics defined here
