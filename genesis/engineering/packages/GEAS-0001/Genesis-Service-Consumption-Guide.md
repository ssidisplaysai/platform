# Genesis Service Consumption Guide

## Consumption Principles
1. Applications consume services through published contracts.
2. Applications do not duplicate service behavior.
3. Service calls must satisfy authorization requirements.
4. Consumers must respect service version contracts.

## Consumption Model
- Discovery: Applications resolve service endpoints and contracts through registry interfaces.
- Invocation: Applications call service APIs or registered interfaces.
- Asynchronous integration: Applications publish/consume events via Messaging Service.
- Operational guardrails: Applications emit telemetry and health metadata for service interactions.

## Prohibited Consumption Patterns
- Direct writes to service persistence by applications
- Capability reimplementation in application scope
- Bypass of service authorization or governance controls

## Recommended Adoption Sequence
1. Discover service in registry.
2. Validate contract version and permissions.
3. Integrate through approved interface.
4. Monitor with observability and telemetry hooks.
5. Certify compatibility during upgrade cycles.
