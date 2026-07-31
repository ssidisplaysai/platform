# Architecture

## Layering

1. Workflow contracts layer
- Canonical object model for definitions, instances, steps, transitions, context, events, checkpoints, metrics, health, and audit.

2. Workflow service layer
- Registry, executor pipeline, transition engine, checkpointing, compensation, timeout handling, metrics, health, and audit.

3. Platform integration layer
- Messaging consumption for lifecycle event publication.
- Identity consumption for dependency health context.
- Mission Control route integration for workflow health and metrics exposure.

## Boundary Compliance

Workflow owns:
- Workflow definitions and versions
- Workflow execution state and transitions
- Long-running orchestration behavior
- Pause/resume/cancel lifecycle
- Timeout, retry, checkpoint, compensation
- Workflow metrics, health, and audit

Workflow does not own:
- Authentication or authorization decisions
- Messaging transport internals
- Mission Control business logic
- Notification channels
- Scheduling systems
- AI decision systems
