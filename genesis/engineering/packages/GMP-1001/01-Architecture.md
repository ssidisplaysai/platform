# Architecture

## Module Topology

- contracts: message model, envelope model, topic/subscription model, router/publisher/subscriber/transport contracts.
- services: registries, router, delivery pipeline, retry/dead-letter/audit services, metrics, health, message bus facade.
- transports: in-memory transport implementation.

## Design Principles

1. Messaging as shared platform infrastructure.
2. Transport abstraction first; in-memory adapter for baseline.
3. Deterministic delivery pipeline with bounded retry and dead-letter routing.
4. Operational observability through metrics and health snapshots.
5. Strict boundary separation from workflow, notification, authentication, and authorization implementation responsibilities.

## Runtime Flow

1. Producer publishes envelope through MessageBus.
2. Transport receives and forwards transport message.
3. Router resolves subscriptions by topic.
4. Delivery pipeline executes handlers with retry policy.
5. Failed terminal deliveries are dead-lettered and audited.
6. Metrics and health state are updated for mission-control endpoints.
