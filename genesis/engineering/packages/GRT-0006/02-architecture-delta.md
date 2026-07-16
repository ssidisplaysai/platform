# GRT-0006 Architecture Delta

Baseline before GRT-0006:
- GRT-0001 through GRT-0005 provide runtime kernel/host/services/objects/messaging foundations.

Additive architectural delta:
- New subsystem: src/runtime/scheduling
- Canonical runtime scheduler layer owned per RuntimeExecutionContext.

Canonical scheduling flow:
- Schedule descriptor -> RuntimeScheduleFactory -> RuntimeSchedule
- Trigger and slot evaluation -> RuntimeTriggerRegistry
- Window and expiration gating -> RuntimeExecutionWindow
- Due plan derivation -> RuntimePlanner -> RuntimePlanFactory -> RuntimePlan
- Plan publication -> RuntimeSchedulingManager.publishPlan -> RuntimeMessagingManager.publish
- Retry derivation -> RuntimeRetryPolicyEvaluator
- Evidence/diagnostics/telemetry/snapshots remain immutable and auditable

Key models:
- RuntimeSchedule model with immutable deterministic schedule identity.
- RuntimePlan model with immutable deterministic plan identity.
- Execution-slot model with deterministic sequence/window semantics.
- Trigger model for immediate, slot, recurrence, dependency, event, command, workflow, recovery, and manual paths.
- Execution-window model for allowed and grace sequences.
- Expiration model for sequence or slot cutoff.
- Retry model for never/fixed/linear/exponential/until-expiration/compensation-required policies.

Integration boundaries:
- Scheduler publication flows through Runtime Messaging only.
- Scheduler does not execute Runtime Objects directly.
- Scheduler does not execute Runtime Services directly.
- Distributed concurrency remains reserved for GRT-0010.

AFR-0004 compliance:
- Additive extension only.
- No redesign of certified GRT-0001 through GRT-0005 runtime layers.
