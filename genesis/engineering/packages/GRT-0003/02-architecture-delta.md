# GRT-0003 Architecture Delta

Baseline before GRT-0003:
- GRT-0001 runtime kernel and GRT-0002 enterprise host provide deterministic runtime and host orchestration foundations.

Additive architectural delta introduced by GRT-0003:
- New subsystem: src/runtime/services
- New context-owned service orchestration layer above host/kernel runtime-instance boundary.

Canonical runtime-services flow:
- RuntimeExecutionContext -> register descriptors -> resolve dependency graph -> activate services in deterministic order -> shutdown in deterministic reverse order -> snapshot/persist/restore.

Key deltas:
- Deterministic service identity based on canonical descriptor content.
- Deterministic dependency graph ordering independent of registration order.
- Deterministic lifecycle transitions and failure-blocking semantics.
- Monotonic diagnostics/evidence/telemetry capture.
- Deep immutable runtime service snapshots and revision history.
- RuntimeServiceManager integration with EnterpriseHost runtime instances without host lifecycle mutation.

Explicit non-deltas (preserved contracts):
- src/runtime/kernel unchanged.
- src/runtime/host unchanged.
- No certified behavior redesign for GRT-0001 or GRT-0002.

Governance alignment:
- AFR-0004 runtime foundation constraints preserved.
- GRT-0003 remains bounded, additive runtime-services governance layer.
