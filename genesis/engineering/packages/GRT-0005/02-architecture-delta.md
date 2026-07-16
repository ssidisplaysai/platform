# GRT-0005 Architecture Delta

Baseline before GRT-0005:
- GRT-0001 through GRT-0004 provide kernel, host, service, and object execution foundations.

Additive architectural delta:
- New subsystem: src/runtime/messaging
- Canonical runtime transport layer owned per RuntimeExecutionContext.

Canonical messaging flow:
- Publish intent -> RuntimeEnvelopeFactory -> RuntimeEnvelope
- RuntimeRouter routes to deterministic subscription set
- RuntimeDispatcher derives delivery outcomes
- RuntimeMessageLog appends immutable history
- RuntimeReplayStore supports deterministic replay
- RuntimeEvidence/RuntimeDiagnostics/RuntimeTelemetry/SnapshotStore maintain immutable auditable state

Key models:
- RuntimeEnvelope model with Command/Event/Query/Reply semantics.
- Deterministic identity, correlation, and causation tracking.
- Deterministic channel/topic/subscription routing.
- Stable subscription ordering.
- Dead-letter handling for undeliverable/rejected outcomes.
- Replay model that does not mutate prior message history.
- Context-local ownership and isolation.

Integration boundaries:
- Runtime services consume via additive subscriptions.
- Runtime object publication requires governed object-dispatch integration.
- Cross-context messaging remains reserved for GRT-0010.

AFR-0004 compliance:
- Additive extension only.
- No redesign of certified GRT-0001 through GRT-0004 runtime layers.
