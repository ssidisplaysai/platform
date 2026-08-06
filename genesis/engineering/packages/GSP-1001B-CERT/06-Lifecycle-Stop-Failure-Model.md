# 06 Lifecycle Stop Failure Model

Condition target:

- GSP-A-C002

Reviewed and updated files:

1. src/platform/shared/runtime/LifecycleManager.ts
2. src/platform/shared/runtime/RuntimeHost.ts (behavioral integration only)

Stop-path model:

1. Stop handler order is deterministic reverse lexical order of stepId.
2. Repeated stop after STOPPED is explicit no-op.
3. stop() before successful start state is rejected for CREATED and STARTING.
4. stop() while STOPPING is rejected as invalid transition.
5. During stop, all handlers continue execution even if one fails (bounded cleanup attempt).
6. Stop failures are not swallowed; they are aggregated and thrown deterministically.
7. Final lifecycle state is FAILED when stop failures occur.
8. Successful stop sets state STOPPED.

Failure taxonomy:

1. INVALID_LIFECYCLE_TRANSITION
2. COMPONENT_STOP_FAILURE
3. MULTIPLE_COMPONENT_STOP_FAILURES

Error model:

- LifecycleStopError includes code plus ordered failure details.

Outcome:

- Explicit deterministic stop-path failure behavior implemented without introducing business lifecycle semantics.