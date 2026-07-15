# GCC-1002: API Documentation

Status:
- Reviewed under GAR-0014
- Frozen under GD-0005 for GCC-1002 v1.0.0

Primary Runtime APIs:
- `CompilerKernel`: high-level entrypoint for registering passes and executing compilations.
- `CompilerPipeline`: deterministic executor responsible for lifecycle management, validation hooks, rollback hooks, artifact registration, metrics, telemetry, and events.
- `CompilerPipelineBuilder`: fluent builder for constructing configured pipelines.
- `CompilerPassRegistry`: pass registration, lookup, capability discovery, dependency validation, and execution-plan creation.

Execution Model:
- Input enters `CompilerKernel.compile()` or `CompilerPipeline.compile()`.
- `CompilerPassRegistry.createExecutionPlan()` materializes ordered steps.
- Each pass optionally validates input, executes, publishes events, and registers produced artifacts.
- `CompilationTransaction` records rollback hooks and replays them in reverse order on failure.
- `CompilerManifestManager` emits the deterministic manifest embedded in `CompilerResult`.

Result Model:
- `CompilerResult.success`
- `CompilerResult.status`
- `CompilerResult.warnings`
- `CompilerResult.errors`
- `CompilerResult.artifactsProduced`
- `CompilerResult.executionTime`
- `CompilerResult.compilerVersion`
- `CompilerResult.pipelineVersion`
- `CompilerResult.metrics`
- `CompilerResult.diagnostics`
- `CompilerResult.telemetry`
- `CompilerResult.outputs`
- `CompilerResult.manifest`

Compatibility APIs Preserved:
- `CompilerCore`
- `CompilerArtifactManager`
- `CompilerDiagnosticsEngine`

Validation note:
- API surface compiles cleanly in scoped GCC-1002 validation and workspace diagnostics.