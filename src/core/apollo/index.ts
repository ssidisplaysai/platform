/**
 * Apollo Compiler Orchestrator - Public API
 *
 * Exports all Apollo types and functions.
 */

// Core orchestrator
export { createApolloCompiler } from "./ApolloCompiler.js";
export type { ApolloCompiler, ApolloConfig, ApolloValidationResult } from "./ApolloCompiler.js";

// Compiler pass contract
export { type CompilerPass, type CompilerPassId, type CompilerStage, type CompilerPassContext, type PassRegistryEntry, type ExecutionPlan, type PassExecutionResult, type CompilerInput, type CompilerOutput, type CompilerPassDependency } from "./CompilerPass.js";

// Compiler registry
export { createCompilerRegistry } from "./CompilerRegistry.js";
export type { CompilerRegistry, RegistryValidationResult } from "./CompilerRegistry.js";

// Dependency graph
export { createDependencyGraph } from "./DependencyGraph.js";
export type { DependencyGraph, DependencyNode, GraphAnalysisResult } from "./DependencyGraph.js";

// Build plan
export { createBuildPlan } from "./BuildPlan.js";
export type { BuildPlan, BuildRequest, BuildPhase, BuildPlanSummary, PlanValidationResult } from "./BuildPlan.js";

// Build result
export { createBuildResult } from "./BuildResult.js";
export type { BuildResult, BuildStatus, BuildResultSummary, ArtifactRecord, DiagnosticMessage, ErrorRecord } from "./BuildResult.js";

// Verification gates
export type { VerificationGate, VerificationGateId, VerificationResult, VerificationContext, VerificationSchedule, VerificationSummary } from "./VerificationGate.js";

// Certification gates
export type { CertificationGate, CertificationGateId, CertificationLevel, CertificationResult, CertificationContext, CertificationSchedule, CertificationSummary } from "./CertificationGate.js";

// Compiler pipeline
export { createCompilerPipeline } from "./CompilerPipeline.js";
export type { CompilerPipeline, PipelineConfig, PipelineState, PipelineValidationResult } from "./CompilerPipeline.js";

// Incremental compiler
export { createIncrementalCompiler } from "./IncrementalCompiler.js";
export type { IncrementalCompiler, CacheEntry, CacheState, IncrementalPlan, ChangeSet, VersionChange, SchemaChange, PlanValidationResult as IncrementalPlanValidationResult } from "./IncrementalCompiler.js";
