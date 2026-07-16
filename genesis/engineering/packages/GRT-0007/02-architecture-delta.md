# GRT-0007 Architecture Delta

Baseline before GRT-0007:
- Runtime stack certified through GRT-0006 with scheduler and messaging foundations frozen.

Additive architectural delta introduced:
- New subsystem: src/runtime/workflows
- New context-owned orchestration layer between RuntimeExecutionContext and RuntimeSchedulingManager.

Canonical execution flow (validated):
- RuntimeWorkflow Activity -> RuntimeExecutionIntent -> RuntimeSchedulingManager -> RuntimePlan -> RuntimeMessagingManager -> Runtime Command envelope delivery -> observations back to workflow transitions.

Key deltas:
- RuntimeProcess abstraction introduced.
- RuntimeWorkflow introduced as first RuntimeProcess implementation.
- RuntimeExecutionIntent introduced as explicit orchestration intent artifact.
- Waiting-state continuation formalized as observation-driven state transitions.
- Compensation formalized as append-only forward execution pipeline.
- Replay projection and verification hash added for deterministic reconstruction checks.

Explicit non-deltas (frozen contracts preserved):
- src/runtime/kernel unchanged in behavior.
- src/runtime/host unchanged in behavior.
- src/runtime/services unchanged in behavior.
- src/runtime/objects unchanged in behavior.
- src/runtime/messaging unchanged in behavior.
- src/runtime/scheduling unchanged in behavior.

Governance alignment:
- AFR-0004 constraints preserved.
- GRT-0007 is additive and bounded to workflow orchestration ownership.
