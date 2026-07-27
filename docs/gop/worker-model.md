# Worker Model

Status: Frozen by GOP-0004A

## 1. Worker Registration

Worker registration fields:

- workerId
- name
- workerType
- capabilities
- maxCapacity
- optional workspaceId and moduleId
- optional metadata

Registration initializes:

- heartbeatAt
- currentWorkload
- health

## 2. Capability Contract

Capabilities are declarative strings that describe supported work classes.

Current examples:

- content.generate
- seo.optimize
- wordpress.publish
- wordpress.update
- image.generate
- media.upload
- in_app.notify

Capabilities are advisory for orchestration policy and routing.

## 3. Health and Heartbeat

Health states:

- HEALTHY
- DEGRADED
- OFFLINE

Frozen behavior:

- heartbeat updates heartbeatAt
- OFFLINE workers can move to DEGRADED on heartbeat recovery
- explicit health updates are allowed via registry APIs

## 4. Capacity and Concurrency

Capacity fields:

- maxCapacity
- currentWorkload

Frozen behavior:

- assignWork increments workload up to maxCapacity
- releaseWork decrements workload not below zero

Concurrency governance is currently in-process and registry-local.

## 5. Worker Lifecycle

Lifecycle phases:

- registered
- active heartbeat
- degraded or offline
- recovered

Worker de-registration is not yet formalized and is deferred.

## 6. Failure and Recovery

Failure model:

- worker health degradation does not mutate execution directly by itself
- orchestrator policy decides retries or waiting states based on failure signals

Recovery model:

- heartbeat and health updates restore worker eligibility

## 7. Versioning

Worker protocol versioning is frozen as a contract concern.

Required future rule:

- worker protocol version must be explicit once external workers are introduced

## 8. Trust Boundary

Worker registration and heartbeat endpoints are protected by session and authorization policies in current runtime APIs.

Future external workers must use stronger machine trust and signed identity.
