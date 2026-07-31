# Test Report

## Focused GMP-1001 Coverage

tests/messaging/messaging-platform-foundation.test.ts verifies:

1. Envelope validation.
2. Topic registration.
3. Subscription registration.
4. Publishing and delivery.
5. Retry behavior.
6. Dead-letter routing.
7. Metrics and health.
8. Transport abstraction behavior.
9. Correlation propagation.
10. Causation propagation.
11. Duplicate detection hooks.
12. Request/reply abstraction.

## Mission-Control Messaging Coverage

tests/gop/mission-control-messaging.test.ts verifies:

1. Messaging health endpoint payload.
2. Messaging metrics endpoint payload.

tests/gop/mission-control-authorization.test.ts verifies:

1. GOP metrics payload includes messaging telemetry and metadata alongside identity telemetry.
