# GRT-0003 API Documentation

## RuntimeExecutionContext API

File: src/runtime/services/RuntimeExecutionContext.ts
- constructor(runtimeInstanceId: string, runtimeId: string)
- stateValue(): RuntimeExecutionContextState
- registerServices(descriptors: readonly RuntimeServiceDescriptor[]): void
- resolveServices(): RuntimeServiceDependencySnapshot
- activateServices(): RuntimeActivationOutcome
- shutdownServices(): readonly string[]
- snapshot(): RuntimeExecutionContextSnapshot

Purpose:
- Owns deterministic per-runtime service orchestration, lifecycle transitions, activation/shutdown ordering, and immutable snapshot projection.

## RuntimeServiceStateMachine API

File: src/runtime/services/RuntimeServiceStateMachine.ts
- constructor(initialState?: RuntimeServiceState)
- current(): RuntimeServiceState
- transition(next: RuntimeServiceState, serviceId: string): RuntimeServiceState

Purpose:
- Enforces legal deterministic lifecycle transitions for service records.

## RuntimeServiceRegistry API

File: src/runtime/services/RuntimeServiceRegistry.ts
- register(descriptor: RuntimeServiceDescriptor): void
- get(id: string): RuntimeServiceDescriptor
- list(): readonly RuntimeServiceDescriptor[]
- identityFor(id: string): string

Purpose:
- Deterministic descriptor validation, normalization, ordering, and service identity calculation.

## RuntimeServiceDependencyGraph API

File: src/runtime/services/RuntimeServiceDependencyGraph.ts
- build(descriptors: readonly RuntimeServiceDescriptor[]): RuntimeServiceDependencyGraphResult

Purpose:
- Validates dependency correctness and computes deterministic activation/shutdown order.

## RuntimeServiceResolver API

File: src/runtime/services/RuntimeServiceResolver.ts
- resolve(registry: RuntimeServiceRegistry): RuntimeServiceDependencySnapshot

Purpose:
- Materializes deterministic dependency graph from registry state.

## RuntimeServiceDiagnostics API

File: src/runtime/services/RuntimeServiceDiagnostics.ts
- log(level, code, message, runtimeInstanceId, serviceId?, details?): void
- all(): readonly RuntimeServiceDiagnostic[]

Purpose:
- Monotonic diagnostics stream for runtime services.

## RuntimeServiceTelemetry API

File: src/runtime/services/RuntimeServiceTelemetry.ts
- increment(counter: string, amount?: number): void
- snapshot(metrics: RuntimeServiceMetrics): RuntimeServiceTelemetrySnapshot

Purpose:
- Deterministic telemetry counter aggregation and snapshot emission.

## RuntimeServiceEvidence API

File: src/runtime/services/RuntimeServiceEvidence.ts
- append(runtimeInstanceId, type, details, serviceId?): void
- all(): readonly RuntimeServiceEvidenceEntry[]

Purpose:
- Append-only runtime evidence trail with deterministic sequence growth.

## RuntimeServiceSnapshotStore API

File: src/runtime/services/RuntimeServiceSnapshotStore.ts
- save(snapshot: RuntimeExecutionContextSnapshot): RuntimeExecutionContextRestoreRecord
- loadLatest(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord
- history(runtimeInstanceId: string): readonly RuntimeExecutionContextRestoreRecord[]

Purpose:
- Immutable revisioned snapshot persistence/restoration.

## RuntimeServiceManager API

File: src/runtime/services/RuntimeServiceManager.ts
- createExecutionContext(runtimeInstanceId: string, runtimeId: string): RuntimeExecutionContext
- attachToHostRuntime(host: EnterpriseHost, runtimeInstanceId: string): RuntimeExecutionContext
- registerServices(runtimeInstanceId: string, descriptors: readonly RuntimeServiceDescriptor[]): void
- resolveServices(runtimeInstanceId: string): void
- activateServices(runtimeInstanceId: string): void
- shutdownServices(runtimeInstanceId: string): void
- snapshot(runtimeInstanceId: string): RuntimeExecutionContextSnapshot
- snapshotAll(): readonly RuntimeExecutionContextSnapshot[]
- persistSnapshot(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord
- restoreLatest(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord
- history(runtimeInstanceId: string): readonly RuntimeExecutionContextRestoreRecord[]

Purpose:
- Runtime-level context manager for deterministic multi-context isolation and host attachment.
