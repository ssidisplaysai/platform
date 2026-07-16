# GRT-0005 Traceability Matrix

Requirement to implementation:
- deterministic envelope identity and immutable envelopes -> src/runtime/messaging/RuntimeEnvelopeFactory.ts, src/runtime/messaging/RuntimeEnvelope.ts, src/runtime/messaging/RuntimeCommand.ts, src/runtime/messaging/RuntimeEvent.ts, src/runtime/messaging/RuntimeQuery.ts, src/runtime/messaging/RuntimeReply.ts
- command/event/query/reply semantics -> src/runtime/messaging/RuntimeCommand.ts, src/runtime/messaging/RuntimeEvent.ts, src/runtime/messaging/RuntimeQuery.ts, src/runtime/messaging/RuntimeReply.ts
- channel registration -> src/runtime/messaging/RuntimeChannelRegistry.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- topic registration -> src/runtime/messaging/RuntimeTopicRegistry.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- subscription ordering and duplicate rejection -> src/runtime/messaging/RuntimeSubscriptionRegistry.ts, src/runtime/messaging/RuntimeRouter.ts
- routing determinism -> src/runtime/messaging/RuntimeRouter.ts
- dispatch ordering and delivery outcomes -> src/runtime/messaging/RuntimeDispatcher.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- replay determinism and append-only history -> src/runtime/messaging/RuntimeMessageLog.ts, src/runtime/messaging/RuntimeReplayStore.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- dead-letter behavior -> src/runtime/messaging/RuntimeDispatcher.ts, src/runtime/messaging/RuntimeMessageLog.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- correlation and causation tracking -> src/runtime/messaging/RuntimeEnvelopeFactory.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- evidence sequencing -> src/runtime/messaging/RuntimeEvidence.ts
- diagnostics sequencing -> src/runtime/messaging/RuntimeDiagnostics.ts
- telemetry updates -> src/runtime/messaging/RuntimeTelemetry.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- snapshot immutability and revisions -> src/runtime/messaging/RuntimeSnapshotStore.ts, src/runtime/messaging/RuntimeMessagingManager.ts
- multi-runtime isolation -> src/runtime/messaging/RuntimeMessagingManager.ts
- service subscriptions -> src/runtime/messaging/RuntimeMessagingManager.ts
- object publication governance -> src/runtime/messaging/RuntimeMessagingManager.ts

Requirement to focused tests:
- deterministic envelope identity -> tests/runtime/messaging/runtime-messaging.test.ts (1-3, 72)
- immutable envelopes -> tests/runtime/messaging/runtime-messaging.test.ts (8-9)
- command/event/query/reply semantics -> tests/runtime/messaging/runtime-messaging.test.ts (4-7)
- channel/topic registration and duplicate rejection -> tests/runtime/messaging/runtime-messaging.test.ts (13-18)
- subscriptions ordering/duplicate rejection -> tests/runtime/messaging/runtime-messaging.test.ts (19-24, 31-32)
- routing determinism -> tests/runtime/messaging/runtime-messaging.test.ts (25-32)
- dispatch ordering and delivery outcomes -> tests/runtime/messaging/runtime-messaging.test.ts (33-45)
- replay determinism and append-only history -> tests/runtime/messaging/runtime-messaging.test.ts (46-58)
- dead-letter behavior -> tests/runtime/messaging/runtime-messaging.test.ts (36-38, 43)
- correlation and causation -> tests/runtime/messaging/runtime-messaging.test.ts (10-12, 50, 55)
- evidence/diagnostics/telemetry sequencing -> tests/runtime/messaging/runtime-messaging.test.ts (39-42, 56-58)
- snapshot immutability/revisions -> tests/runtime/messaging/runtime-messaging.test.ts (59-68)
- multi-runtime isolation -> tests/runtime/messaging/runtime-messaging.test.ts (69-72)
- service subscriptions -> tests/runtime/messaging/runtime-messaging.test.ts (73)
- object publication governance -> tests/runtime/messaging/runtime-messaging.test.ts (74-75)
- frozen-milestone non-regression -> tests/runtime/messaging/runtime-messaging.test.ts (76-79)

Requirement to validation/governance/package:
- validation outputs -> 04-validation-report.md, validation.json
- GAR findings -> genesis/architecture/reviews/GAR-0024-GRT-0005-Runtime-Messaging.md
- governance decision -> genesis/governance-decisions/GD-0016-Approve-GRT-0005.md
- package closure evidence -> CLOSURE-EVIDENCE.md, RELEASE-READINESS.md
