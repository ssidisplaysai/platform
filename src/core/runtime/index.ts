/**
 * Enterprise Runtime Core — Public API
 *
 * Exports all types and factory functions for the Enterprise Runtime.
 */

// ─── Main runtime ─────────────────────────────────────────────────────────────
export { createEnterpriseRuntime, RUNTIME_VERSION } from "./EnterpriseRuntime.js";
export type { EnterpriseRuntime, EnterpriseRuntimeParams } from "./EnterpriseRuntime.js";

// ─── Configuration ────────────────────────────────────────────────────────────
export { createRuntimeConfiguration, DEFAULT_RUNTIME_CONFIGURATION } from "./RuntimeConfiguration.js";
export type { RuntimeConfiguration, LoggingLevel, ArtifactRetention } from "./RuntimeConfiguration.js";

// ─── Execution context ────────────────────────────────────────────────────────
export { createExecutionContext } from "./ExecutionContext.js";
export type { ExecutionContext, RuntimeEnvironment } from "./ExecutionContext.js";

export { createRuntimeContext } from "./RuntimeContext.js";
export type { RuntimeContext } from "./RuntimeContext.js";

// ─── Status ───────────────────────────────────────────────────────────────────
export { isValidTransition, isTerminal, isActive, assertValidTransition } from "./RuntimeStatus.js";
export type { RuntimeStatus, TerminalStatus, ActiveStatus } from "./RuntimeStatus.js";

// ─── Events ───────────────────────────────────────────────────────────────────
export { createRuntimeEventBus } from "./RuntimeEventBus.js";
export type { RuntimeEventBus, RuntimeEventHandler } from "./RuntimeEventBus.js";
export type {
  RuntimeEventType,
  RuntimeEvent,
  AnyRuntimeEvent,
  RuntimeStartedEvent,
  RuntimeCompletedEvent,
  RuntimeFailedEvent,
  RuntimeCancelledEvent,
  StatusChangedEvent,
  PassStartedEvent,
  PassCompletedEvent,
  PassFailedEvent,
  ArtifactGeneratedEvent,
  VerificationStartedEvent,
  VerificationPassedEvent,
  VerificationFailedEvent,
  CertificationStartedEvent,
  CertificationPassedEvent,
  CertificationFailedEvent,
} from "./RuntimeEvents.js";

// ─── Artifact registry ────────────────────────────────────────────────────────
export { createArtifactRegistry } from "./ArtifactRegistry.js";
export type {
  ArtifactRegistry,
  ArtifactEntry,
  ArtifactRegistrySnapshot,
  ArtifactVerificationState,
  ArtifactCertificationState,
} from "./ArtifactRegistry.js";

// ─── Pass executor ────────────────────────────────────────────────────────────
export { createPassExecutor } from "./PassExecutor.js";
export type { PassExecutor, PassExecutionRecord, PassLifecycleStage } from "./PassExecutor.js";

// ─── Pipeline ─────────────────────────────────────────────────────────────────
export { createRuntimePipeline } from "./RuntimePipeline.js";
export type { RuntimePipeline, PipelineExecutionResult } from "./RuntimePipeline.js";

// ─── Execution result ─────────────────────────────────────────────────────────
export { createExecutionResult } from "./ExecutionResult.js";
export type { ExecutionResult } from "./ExecutionResult.js";

// ─── Execution report ─────────────────────────────────────────────────────────
export { createExecutionReport } from "./ExecutionReport.js";
export type {
  ExecutionReport,
  ExecutionSummary,
  ExecutionWarning,
  ExecutionError,
} from "./ExecutionReport.js";

// ─── Metrics ──────────────────────────────────────────────────────────────────
export { createRuntimeMetrics } from "./RuntimeMetrics.js";
export type { RuntimeMetrics, RuntimeMetricsSnapshot } from "./RuntimeMetrics.js";

// ─── Statistics ───────────────────────────────────────────────────────────────
export { computeRuntimeStatistics } from "./RuntimeStatistics.js";
export type { RuntimeStatistics } from "./RuntimeStatistics.js";
