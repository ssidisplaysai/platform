# 07 State and Lifecycle

## Work Order Lifecycle

Approved states:
- DRAFT
- PLANNED
- RELEASED
- READY
- IN_PROGRESS
- PAUSED
- BLOCKED
- ON_HOLD
- PARTIALLY_COMPLETED
- COMPLETED
- CANCELLED
- CLOSED
- ARCHIVED

Legal transition examples:
- DRAFT -> PLANNED or CANCELLED
- PLANNED -> RELEASED or CANCELLED
- RELEASED -> READY or ON_HOLD
- READY -> IN_PROGRESS or ON_HOLD
- IN_PROGRESS -> PAUSED, BLOCKED, ON_HOLD, PARTIALLY_COMPLETED, COMPLETED, CANCELLED
- PAUSED -> IN_PROGRESS, BLOCKED, ON_HOLD, CANCELLED
- BLOCKED -> READY, IN_PROGRESS, ON_HOLD, CANCELLED
- ON_HOLD -> READY, IN_PROGRESS, CANCELLED
- PARTIALLY_COMPLETED -> IN_PROGRESS, COMPLETED, CANCELLED
- COMPLETED -> CLOSED
- CANCELLED -> CLOSED
- CLOSED -> ARCHIVED

Illegal transitions:
- terminal-state exit from ARCHIVED
- DRAFT directly to COMPLETED
- CANCELLED directly to ARCHIVED
- CLOSED back to IN_PROGRESS

Terminal states:
- ARCHIVED

Reversible states:
- PAUSED, BLOCKED, ON_HOLD can return to READY or IN_PROGRESS under authority and evidence rules

Required transition evidence:
- command identity and authority
- correlation ID and idempotency key
- expected version
- transition reason code
- audit timestamp and actor reference

Transition authority:
- only Manufacturing command authority
- Mission Control and AI may not execute transitions

Concurrency behavior:
- expected-version check required
- stale transition requests rejected

Downstream effects:
- RELEASED/READY enable operation-start eligibility
- IN_PROGRESS permits consumption/output recording
- ON_HOLD/BLOCKED pauses downstream state-progress commands
- COMPLETED/CANCELLED closes most mutation paths except controlled closure/archival operations

## Operation Execution Lifecycle

Approved states:
- PENDING
- READY
- IN_PROGRESS
- PAUSED
- BLOCKED
- COMPLETED
- FAILED
- CANCELLED
- CLOSED

Legal transitions:
- PENDING -> READY
- READY -> IN_PROGRESS or BLOCKED
- IN_PROGRESS -> PAUSED, BLOCKED, COMPLETED, FAILED, CANCELLED
- PAUSED -> IN_PROGRESS, BLOCKED, CANCELLED
- BLOCKED -> READY, IN_PROGRESS, CANCELLED
- FAILED -> READY, CANCELLED (policy-bound)
- COMPLETED -> CLOSED
- CANCELLED -> CLOSED

Terminal states:
- CLOSED

Lifecycle coherence requirement:
- operation may not be COMPLETED while parent work order is DRAFT/PLANNED/RELEASED unless explicit exception policy is approved
