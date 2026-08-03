# 04 Architecture Baseline

Certified platform architecture domains:
1. Identity: subject and platform identity foundation.
2. Authentication: identity proofing and session authority.
3. Authorization: policy and action authorization boundary.
4. Messaging: certified transport and envelope boundary.
5. Workflow: canonical execution authority and orchestration runtime.
6. Scheduling: canonical platform timing authority for deterministic schedule evaluation and dispatch eligibility.
7. Mission Control: platform observability and operational status surfaces.
8. Repository Quality: quality gate, type safety, template conformance, and regression governance.

Scheduling architecture position:
1. Scheduling owns temporal evaluation, recurrence, occurrence claiming, and dispatch eligibility.
2. Scheduling dispatches only through Messaging contracts.
3. Scheduling does not own workflow execution, only timing and command dispatch eligibility.
4. Scheduling health and metrics integrate through Mission Control observability surfaces.

Authority boundaries:
1. Authentication authority remains external to Scheduling.
2. Authorization authority remains external to Scheduling.
3. Messaging transport authority remains external to Scheduling.
4. Workflow execution authority remains external to Scheduling.
