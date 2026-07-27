# GOP-0004 Runtime Milestone

## Overview

GOP-0004 introduces the Genesis orchestration runtime as the platform execution core. The runtime converts workflow activity into execution records and provides queue, worker, health, and operations primitives while preserving existing GLW behavior.

## Execution Lifecycle

Execution states:

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

Execution records include:

- context, inputs, outputs
- worker assignment
- correlation and causation IDs
- parent and child execution links
- retry history
- timing fields
- runtime metrics
- execution graph and current node

## Worker Model

The runtime includes a worker registry with:

- worker identity and type
- capability declaration
- max capacity and current workload
- heartbeat timestamps
- health status

Worker APIs:

- POST /api/gop/workers/register
- POST /api/gop/workers/[id]/heartbeat

## Queue Model

The platform queue manager supports:

- priority classes LOW, NORMAL, HIGH, URGENT
- queue controls ACTIVE, PAUSED, DRAINING
- pause, resume, drain operations
- basic priority inversion protection using wait-time boosting
- rate limiting per worker type window

## Execution Graph Model

Executions use a DAG with node and edge definitions.

Supported node categories:

- AI
- PLUGIN
- WORDPRESS
- DATABASE
- VALIDATION
- IMAGE_GENERATION
- EMAIL
- NOTIFICATION
- HUMAN_APPROVAL
- CUSTOM

## Orchestration Model

The orchestration runtime supports:

- execution creation
- lifecycle transitions
- retry tracking
- queue enqueuing and dispatch flow
- worker association
- notification emission
- operations snapshot aggregation

Current GLW page-generation execution graph:

- Request Intake
- Generate Content
- Generate Image
- Publish Draft
- Notify Operators

## Operations Center

New surfaces:

- /glw/operations
- /operations (redirects to /glw/operations)
- GET /api/gop/operations
- GET /api/gop/operations/stream (SSE)

Operations dashboard displays:

- live executions
- queue depth and queue state
- worker health and capacity
- throughput per minute
- failed executions
- retry queue
- active approvals
- health status
- alerts and notifications

## GLW Integration

GLW page generation now maps into runtime executions through orchestration hooks in page-generation lifecycle logic.

Preserved behaviors:

- existing GLW page UI
- existing callback contract and endpoint
- existing authentication requirements
- existing job persistence and event history

## Notification Center

In-app notifications are emitted for:

- execution queued
- execution completed
- execution failed
- timeout-related failures

Planned channels remain tracked in contracts:

- EMAIL
- WEBHOOK
- TEAMS
- SLACK

## Future Extension Points

Recommended GOP-0005 focus:

- durable execution persistence model separate from job events
- distributed queue backend with lease semantics
- cross-workspace orchestration federation
- advanced approval workflow state machine
- richer graph visualization and node logs
- cost analytics pipeline with AI usage attribution
