# GRT-0002 Traceability Matrix

Requirement to implementation:
- Host lifecycle control -> src/runtime/host/HostStateMachine.ts, src/runtime/host/EnterpriseHost.ts
- Runtime instance orchestration -> src/runtime/host/EnterpriseHost.ts
- Environment/profile governance -> src/runtime/host/EnvironmentRegistry.ts, src/runtime/host/ProfileRegistry.ts
- Diagnostics and telemetry -> src/runtime/host/HostDiagnostics.ts, src/runtime/host/HostTelemetry.ts
- Event ordering and observability -> src/runtime/host/HostEventRouter.ts
- Dependency and activation materialization -> src/runtime/host/RuntimeDependencyResolver.ts, src/runtime/host/RuntimeActivationPipeline.ts
- Persistence and restoration -> src/runtime/host/RuntimeStateStore.ts, src/runtime/host/EnterpriseHost.ts
- Type contract and exports -> src/runtime/host/types.ts, src/runtime/host/index.ts

Requirement to validation:
- Host lifecycle and transitions -> tests/runtime/host/runtime-host.test.ts
- Runtime orchestration and isolation -> tests/runtime/host/runtime-host.test.ts
- Crash/recovery/supervision -> tests/runtime/host/runtime-host.test.ts
- Persistence/restoration -> tests/runtime/host/runtime-host.test.ts
- Determinism and immutability -> tests/runtime/host/runtime-host.test.ts
- Matrix and static quality -> 04-validation-report.md, validation.json

Governance traceability:
- Architecture review -> genesis/architecture/reviews/GAR-0021-GRT-0002-Enterprise-Host.md
- Governance decision -> genesis/governance-decisions/GD-0013-Approve-GRT-0002.md
