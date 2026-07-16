# GRT-0007 Traceability Matrix

Requirement to implementation:
- RuntimeProcess abstraction -> src/runtime/workflows/RuntimeProcess.ts, src/runtime/workflows/types.ts
- Deterministic identities (workflow, instance, activity, intent) -> src/runtime/workflows/RuntimeWorkflowFactory.ts, src/runtime/workflows/RuntimeExecutionIntent.ts
- Graph validation and ordering -> src/runtime/workflows/RuntimeActivityGraph.ts
- Lifecycle enforcement -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Deterministic transition ordering and guard evaluation -> src/runtime/workflows/RuntimeTransitionEngine.ts
- Execution-intent generation -> src/runtime/workflows/RuntimeWorkflowManager.ts, src/runtime/workflows/RuntimeExecutionIntent.ts
- Scheduler integration -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Runtime Plan linkage -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Messaging observation -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Waiting-state persistence -> src/runtime/workflows/RuntimeWaitingStateStore.ts
- Waiting-state resumption -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Correlation and causation matching -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Compensation derivation/execution -> src/runtime/workflows/RuntimeCompensationEngine.ts, src/runtime/workflows/RuntimeWorkflowManager.ts
- Replay behavior -> src/runtime/workflows/RuntimeWorkflowManager.ts
- Evidence model -> src/runtime/workflows/RuntimeWorkflowEvidence.ts
- Diagnostics model -> src/runtime/workflows/RuntimeWorkflowDiagnostics.ts
- Telemetry model -> src/runtime/workflows/RuntimeWorkflowTelemetry.ts
- Snapshot model -> src/runtime/workflows/RuntimeWorkflowSnapshotStore.ts, src/runtime/workflows/RuntimeWorkflowManager.ts
- Context isolation ownership -> src/runtime/workflows/RuntimeWorkflowManager.ts

Requirement to focused tests:
- RuntimeProcess and identities -> tests/runtime/workflows/runtime-workflows.test.ts (tests 1-11)
- Definition/graph/lifecycle/transition -> tests/runtime/workflows/runtime-workflows.test.ts (tests 12-41)
- Intent/scheduler/plan/messaging integration -> tests/runtime/workflows/runtime-workflows.test.ts (tests 42-47, 53, 85, 99)
- No direct execution/publication boundaries -> tests/runtime/workflows/runtime-workflows.test.ts (tests 47-49)
- Waiting persistence/resumption/correlation/causation -> tests/runtime/workflows/runtime-workflows.test.ts (tests 50-58, 91)
- Evidence/diagnostics/telemetry/snapshots -> tests/runtime/workflows/runtime-workflows.test.ts (tests 59-64, 89-90, 100)
- Replay and determinism -> tests/runtime/workflows/runtime-workflows.test.ts (tests 65-66, 84)
- Context isolation and ordering -> tests/runtime/workflows/runtime-workflows.test.ts (tests 67-72)
- Compensation -> tests/runtime/workflows/runtime-workflows.test.ts (tests 73-82)
- Frozen milestone non-regression -> tests/runtime/workflows/runtime-workflows.test.ts (tests 93-98)

Requirement to validation outputs:
- Focused and deterministic results -> 04-validation-report.md, validation.json
- Matrix results -> 04-validation-report.md, validation.json
- TypeScript/ESLint/diagnostics -> 04-validation-report.md, validation.json
- Frozen-runtime diff verification -> 06-repository-impact.md, CLOSURE-EVIDENCE.md

Governance traceability:
- Architecture review -> genesis/architecture/reviews/GAR-0026-GRT-0007-Runtime-Workflow-Engine.md
- Governance decision -> genesis/governance-decisions/GD-0018-Approve-GRT-0007.md
- Package closure evidence -> CLOSURE-EVIDENCE.md
