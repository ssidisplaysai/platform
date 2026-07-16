# GRT-0004 Architecture Delta

Baseline before GRT-0004:
- GRT-0001 through GRT-0003 provide kernel, host, and runtime-service context foundations.

Additive architectural delta:
- New subsystem: src/runtime/objects
- New canonical runtime object layer owned per runtime instance.

Canonical object execution flow:
- RuntimeObject descriptor -> RuntimeObjectFactory materialization -> RuntimeObjectRegistry
- RuntimeCapabilityDispatcher receives capability request
- RuntimePermissionEvaluator decides allow/deny
- RuntimeBehaviorRegistry resolves behavior implementation by capability + classification
- Behavior result evolves RuntimeObject through RuntimeObjectFactory
- RuntimeObjectEvidence/RuntimeObjectDiagnostics/RuntimeObjectTelemetry updated
- RuntimeObjectSnapshotStore persists immutable revisions

Key architectural properties:
- Object entities are canonical executable model artifacts.
- Objects do not expose arbitrary executable methods.
- Capability dispatch is gated by lifecycle and permission checks.
- Relationship operations are deterministic and append-only.
- Snapshot, evidence, and diagnostics are immutable/monotonic.
- Runtime-instance isolation is mandatory and validated.

Non-deltas:
- GRT-0001, GRT-0002, GRT-0003 behavior preserved.
- No modifications to messaging, scheduling, or workflow milestone implementation scope.
