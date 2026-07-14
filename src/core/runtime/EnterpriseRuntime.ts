/**
 * EnterpriseRuntime.ts
 *
 * Enterprise Runtime Core — Deterministic execution engine for Genesis.
 *
 * The Enterprise Runtime accepts a BuildPlan produced by Apollo and executes
 * all certified compiler passes in plan order. It manages the complete
 * execution lifecycle: preparation, pass execution, verification, certification,
 * artifact registration, event publication, and report generation.
 *
 * The Enterprise Runtime does NOT:
 * - Produce BuildPlans (Apollo's responsibility)
 * - Perform LLM reasoning
 * - Execute passes concurrently or out of order
 * - Reorder passes from the plan
 * - Modify canonical metadata
 * - Perform asynchronous execution scheduling
 *
 * Apollo plans. Runtime executes.
 *
 * Each EnterpriseRuntime instance manages a single execution lifecycle.
 * Create a new instance for each build.
 */

import type { CompilerPass, CompilerPassId } from "../apollo/CompilerPass.js";
import type { BuildPlan } from "../apollo/BuildPlan.js";
import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";
import type { ExecutionContext } from "./ExecutionContext.js";
import type { RuntimeContext } from "./RuntimeContext.js";
import type { ExecutionReport } from "./ExecutionReport.js";
import type { RuntimeStatistics } from "./RuntimeStatistics.js";
import type { AnyRuntimeEvent } from "./RuntimeEvents.js";
import type { RuntimeEventHandler } from "./RuntimeEventBus.js";

import { createRuntimeConfiguration } from "./RuntimeConfiguration.js";
import { createExecutionContext } from "./ExecutionContext.js";
import { createRuntimeContext } from "./RuntimeContext.js";
import { createArtifactRegistry } from "./ArtifactRegistry.js";
import { createRuntimeEventBus } from "./RuntimeEventBus.js";
import { createRuntimeMetrics } from "./RuntimeMetrics.js";
import { createPassExecutor } from "./PassExecutor.js";
import { createRuntimePipeline } from "./RuntimePipeline.js";
import { createExecutionReport } from "./ExecutionReport.js";
import { computeRuntimeStatistics } from "./RuntimeStatistics.js";
import { assertValidTransition, isTerminal } from "./RuntimeStatus.js";
import type { RuntimeStatus } from "./RuntimeStatus.js";
import type { ExecutionError, ExecutionWarning } from "./ExecutionReport.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Semantic version of the Enterprise Runtime. */
export const RUNTIME_VERSION = "1.0.0" as const;

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Enterprise Runtime interface.
 *
 * Each instance has exactly one lifecycle: created → ... → terminal.
 * Create a new instance for each compilation run.
 */
export interface EnterpriseRuntime {
  /** Semantic version of this runtime. */
  readonly version: string;

  /**
   * Execute a BuildPlan produced by Apollo.
   *
   * Transitions: created → preparing → executing → verifying → certifying → completed|failed
   *
   * @returns Immutable ExecutionReport
   * @throws if runtime is not in "created" state
   */
  readonly execute: (plan: BuildPlan) => ExecutionReport;

  /**
   * Request cancellation of an in-progress execution.
   * Cancellation is recorded; the running pass completes before the runtime halts.
   * No-op if runtime is already in a terminal state.
   */
  readonly cancel: (reason: string) => void;

  /** Current runtime status. */
  readonly status: () => RuntimeStatus;

  /**
   * Immutable snapshot of the current RuntimeContext.
   * Returns undefined before execute() is called.
   */
  readonly context: () => RuntimeContext | undefined;

  /**
   * Statistics from the last completed run.
   * Returns undefined before a run completes.
   */
  readonly statistics: () => RuntimeStatistics | undefined;

  /**
   * Execution report from the last completed run.
   * Returns undefined before a run completes.
   */
  readonly report: () => ExecutionReport | undefined;

  /**
   * Subscribe to all runtime events from the current run.
   * Must be called before execute().
   */
  readonly subscribe: (handler: RuntimeEventHandler<AnyRuntimeEvent>) => void;

  /**
   * All events published in the last run.
   */
  readonly events: () => readonly AnyRuntimeEvent[];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Parameters for creating an EnterpriseRuntime.
 */
export interface EnterpriseRuntimeParams {
  /** All compiler passes available for execution. */
  readonly registeredPasses: readonly CompilerPass[];
  /** Optional configuration overrides. Defaults to production configuration. */
  readonly configuration?: Partial<Omit<RuntimeConfiguration, "parallelExecution">>;
  /** Company or workspace being compiled. */
  readonly companyId: string;
  /** Absolute path to workspace root. */
  readonly workspace: string;
  /** Semantic version of the compiler toolchain. */
  readonly compilerVersion: string;
}

/**
 * Create a new EnterpriseRuntime instance.
 *
 * Each instance is single-use. Create a fresh instance for each build.
 */
export const createEnterpriseRuntime = (params: EnterpriseRuntimeParams): EnterpriseRuntime => {
  // Build immutable pass lookup map
  const passMap: ReadonlyMap<CompilerPassId, CompilerPass> = new Map(
    params.registeredPasses.map((p) => [p.id, p]),
  );

  const configuration = createRuntimeConfiguration(params.configuration ?? {});

  // ── Mutable internal lifecycle state ────────────────────────────────────────
  let currentStatus: RuntimeStatus = "created";
  let currentContext: RuntimeContext | undefined;
  let lastReport: ExecutionReport | undefined;
  let lastStatistics: RuntimeStatistics | undefined;
  let cancelRequested = false;
  let cancelReason = "";
  let eventBus = createRuntimeEventBus();
  let sequenceCounter = 0;
  // Handlers registered before execute() — re-applied to each fresh event bus
  const preExecuteHandlers: RuntimeEventHandler<AnyRuntimeEvent>[] = [];

  // ── Internal helpers ────────────────────────────────────────────────────────

  const nextSeq = (): number => sequenceCounter++;

  const transitionTo = (next: RuntimeStatus, buildId: string): void => {
    const prev = currentStatus;
    assertValidTransition(prev, next);
    currentStatus = next;
    eventBus.publish(Object.freeze({
      type: "StatusChanged",
      buildId,
      sequenceNumber: nextSeq(),
      from: prev,
      to: next,
    }));
  };

  const buildCancelReport = (
    buildId: string,
    execCtx: ExecutionContext,
    metrics: ReturnType<typeof createRuntimeMetrics>,
    passesCompleted: number,
  ): ExecutionReport => {
    const snap = metrics.snapshot();
    const summary = Object.freeze({
      buildId,
      companyId: execCtx.companyId,
      environment: execCtx.environment,
      status: "cancelled" as RuntimeStatus,
      successful: false,
      totalPasses: snap.passCount,
      passesExecuted: passesCompleted,
      passesSucceeded: snap.passesSucceeded,
      passesFailed: snap.passesFailed,
      artifactsGenerated: snap.artifactCount,
      verificationsRun: snap.verificationCount,
      verificationsPassed: snap.verificationPassCount,
      certificationsRun: snap.certificationCount,
      certificationsPassed: snap.certificationPassCount,
      durationMs: snap.executionDurationMs,
      cacheHitRate: snap.cacheHitRate,
    });
    return createExecutionReport({
      reportId: `report:${buildId}`,
      buildId,
      summary,
      passResults: [],
      artifacts: [],
      warnings: [],
      errors: [Object.freeze({
        passId: "runtime" as const,
        code: "CANCELLED",
        message: cancelReason,
        fatal: true,
      })],
      metrics: snap,
      generatedAt: execCtx.startTime,
    });
  };

  // ── Public API ───────────────────────────────────────────────────────────────

  const status = (): RuntimeStatus => currentStatus;
  const context = (): RuntimeContext | undefined => currentContext;
  const statistics = (): RuntimeStatistics | undefined => lastStatistics;
  const report = (): ExecutionReport | undefined => lastReport;
  const subscribe = (h: RuntimeEventHandler<AnyRuntimeEvent>): void => {
    preExecuteHandlers.push(h);
    eventBus.subscribeAll(h);
  };
  const events = (): readonly AnyRuntimeEvent[] => eventBus.history();

  const cancel = (reason: string): void => {
    if (!isTerminal(currentStatus)) {
      cancelRequested = true;
      cancelReason = reason;
    }
  };

  const execute = (plan: BuildPlan): ExecutionReport => {
    if (currentStatus !== "created") {
      throw new Error(
        `EnterpriseRuntime.execute() called in state "${currentStatus}". ` +
        "Each runtime instance may only execute once. Create a new instance per build.",
      );
    }

    // Reset event bus and sequence counter for this run; re-apply any
    // handlers registered before execute() was called.
    eventBus = createRuntimeEventBus();
    for (const h of preExecuteHandlers) eventBus.subscribeAll(h);
    sequenceCounter = 0;

    const metrics = createRuntimeMetrics();
    const artifactRegistry = createArtifactRegistry();
    const passExecutor = createPassExecutor();
    const pipeline = createRuntimePipeline(passExecutor);

    // Build execution context from plan
    const execCtx = createExecutionContext({
      buildId: plan.buildId,
      companyId: params.companyId,
      workspace: params.workspace,
      environment: "production",
      compilerVersion: params.compilerVersion,
      runtimeVersion: RUNTIME_VERSION,
      requestedTargets: plan.expectedOutputs,
      startTime: plan.timestamp,
      configuration,
    });

    const buildId = plan.buildId;

    // ── Phase: preparing ──────────────────────────────────────────────────────
    transitionTo("preparing", buildId);

    currentContext = createRuntimeContext({
      executionContext: execCtx,
      runtimeVersion: RUNTIME_VERSION,
      status: currentStatus,
      passesCompleted: 0,
      passesRemaining: plan.passes.length,
      artifactCount: 0,
      verificationsCompleted: 0,
      certificationsCompleted: 0,
      warningCount: 0,
      errorCount: 0,
      snapshotTime: plan.timestamp,
    });

    eventBus.publish(Object.freeze({
      type: "RuntimeStarted",
      buildId,
      sequenceNumber: nextSeq(),
      companyId: params.companyId,
      runtimeVersion: RUNTIME_VERSION,
      passCount: plan.passes.length,
    }));

    // Check for pre-execution cancellation
    if (cancelRequested) {
      transitionTo("cancelled", buildId);
      eventBus.publish(Object.freeze({
        type: "RuntimeCancelled",
        buildId,
        sequenceNumber: nextSeq(),
        passesCompleted: 0,
        reason: cancelReason,
      }));
      const cancelReport = buildCancelReport(buildId, execCtx, metrics, 0);
      lastReport = cancelReport;
      lastStatistics = computeRuntimeStatistics(cancelReport);
      return cancelReport;
    }

    // ── Phase: executing ──────────────────────────────────────────────────────
    transitionTo("executing", buildId);

    const pipelineResult = pipeline.execute(
      plan,
      passMap,
      execCtx,
      artifactRegistry,
      eventBus,
      metrics,
    );

    // Check for mid-execution cancellation
    if (cancelRequested) {
      transitionTo("cancelled", buildId);
      eventBus.publish(Object.freeze({
        type: "RuntimeCancelled",
        buildId,
        sequenceNumber: nextSeq(),
        passesCompleted: pipelineResult.passesExecuted,
        reason: cancelReason,
      }));
      metrics.setDurationMs(1);
      const cancelReport = buildCancelReport(buildId, execCtx, metrics, pipelineResult.passesExecuted);
      lastReport = cancelReport;
      lastStatistics = computeRuntimeStatistics(cancelReport);
      return cancelReport;
    }

    // ── Phase: verifying ──────────────────────────────────────────────────────
    transitionTo("verifying", buildId);

    // ── Phase: certifying ─────────────────────────────────────────────────────
    transitionTo("certifying", buildId);

    // ── Determine final status ────────────────────────────────────────────────
    const finalStatus: RuntimeStatus = pipelineResult.successful ? "completed" : "failed";
    transitionTo(finalStatus, buildId);

    metrics.setDurationMs(1); // deterministic unit duration in plan context

    // Collect pass-level errors and warnings for the report
    const reportErrors: ExecutionError[] = pipelineResult.passResults.flatMap((r) =>
      r.errors.map((e) =>
        Object.freeze({
          passId: r.passId as CompilerPassId | "runtime",
          code: "PASS_ERROR",
          message: e,
          fatal: false,
        }),
      ),
    );
    const reportWarnings: ExecutionWarning[] = pipelineResult.passResults.flatMap((r) =>
      r.diagnostics
        .filter((d) => d.includes("[warn]"))
        .map((d) => Object.freeze({ passId: r.passId as CompilerPassId | "runtime", message: d })),
    );

    const artifactSnap = artifactRegistry.snapshot();
    const metricsSnap = metrics.snapshot();

    const summary = Object.freeze({
      buildId,
      companyId: execCtx.companyId,
      environment: execCtx.environment,
      status: finalStatus,
      successful: finalStatus === "completed",
      totalPasses: metricsSnap.passCount,
      passesExecuted: pipelineResult.passesExecuted,
      passesSucceeded: pipelineResult.passesSucceeded,
      passesFailed: pipelineResult.passesFailed,
      artifactsGenerated: artifactSnap.count,
      verificationsRun: metricsSnap.verificationCount,
      verificationsPassed: metricsSnap.verificationPassCount,
      certificationsRun: metricsSnap.certificationCount,
      certificationsPassed: metricsSnap.certificationPassCount,
      durationMs: metricsSnap.executionDurationMs,
      cacheHitRate: metricsSnap.cacheHitRate,
    });

    const finalReport = createExecutionReport({
      reportId: `report:${buildId}`,
      buildId,
      summary,
      passResults: pipelineResult.passResults,
      artifacts: artifactSnap.artifacts,
      warnings: Object.freeze(reportWarnings),
      errors: Object.freeze(reportErrors),
      metrics: metricsSnap,
      generatedAt: plan.timestamp,
    });

    lastReport = finalReport;
    lastStatistics = computeRuntimeStatistics(finalReport);

    // Emit terminal lifecycle event
    if (finalStatus === "completed") {
      eventBus.publish(Object.freeze({
        type: "RuntimeCompleted",
        buildId,
        sequenceNumber: nextSeq(),
        totalPasses: pipelineResult.passesExecuted,
        totalArtifacts: artifactSnap.count,
        totalDurationMs: metricsSnap.executionDurationMs,
        verificationsPassed: finalReport.verificationsPassed,
        certificationsPassed: finalReport.certificationsPassed,
      }));
    } else {
      const firstFailed = pipelineResult.passResults.find((r) => !r.success);
      eventBus.publish(Object.freeze({
        type: "RuntimeFailed",
        buildId,
        sequenceNumber: nextSeq(),
        error: pipelineResult.haltReason ?? "One or more passes failed",
        failedPassId: firstFailed?.passId as CompilerPassId | undefined,
        passesCompleted: pipelineResult.passesExecuted,
      }));
    }

    return finalReport;
  };

  return Object.freeze({
    version: RUNTIME_VERSION,
    execute,
    cancel,
    status,
    context,
    statistics,
    report,
    subscribe,
    events,
  });
};
