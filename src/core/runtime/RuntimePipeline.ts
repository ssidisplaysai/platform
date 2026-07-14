/**
 * RuntimePipeline.ts
 *
 * Executes compiler passes in the exact order supplied by Apollo's BuildPlan.
 *
 * Responsibilities:
 * - Execute passes in plan order (never reorder)
 * - Validate dependency constraints before each pass
 * - Track completed passes for downstream dependency validation
 * - Collect ExecutionResults from PassExecutor
 * - Honour stopOnFirstFailure configuration
 *
 * The Runtime Pipeline does not:
 * - Plan or reorder passes (Apollo's responsibility)
 * - Perform AI reasoning
 * - Modify canonical metadata
 */

import type { CompilerPass, CompilerPassId } from "../apollo/CompilerPass.js";
import type { BuildPlan } from "../apollo/BuildPlan.js";
import type { ExecutionContext } from "./ExecutionContext.js";
import type { ArtifactRegistry } from "./ArtifactRegistry.js";
import type { RuntimeEventBus } from "./RuntimeEventBus.js";
import type { RuntimeMetrics } from "./RuntimeMetrics.js";
import type { PassExecutor } from "./PassExecutor.js";
import type { ExecutionResult } from "./ExecutionResult.js";
import { createExecutionResult } from "./ExecutionResult.js";

/**
 * Result produced by the pipeline after all passes have been processed.
 */
export interface PipelineExecutionResult {
  readonly passResults: readonly ExecutionResult[];
  readonly passesExecuted: number;
  readonly passesSucceeded: number;
  readonly passesFailed: number;
  readonly successful: boolean;
  readonly haltedEarly: boolean;
  readonly haltReason: string | undefined;
}

/**
 * Runtime pipeline interface.
 */
export interface RuntimePipeline {
  /**
   * Execute all passes in plan order.
   * Returns a PipelineExecutionResult with all results in execution order.
   */
  readonly execute: (
    plan: BuildPlan,
    passes: ReadonlyMap<CompilerPassId, CompilerPass>,
    context: ExecutionContext,
    artifactRegistry: ArtifactRegistry,
    eventBus: RuntimeEventBus,
    metrics: RuntimeMetrics,
  ) => PipelineExecutionResult;
}

/**
 * Create a RuntimePipeline backed by the supplied PassExecutor.
 */
export const createRuntimePipeline = (passExecutor: PassExecutor): RuntimePipeline => {
  const execute = (
    plan: BuildPlan,
    passes: ReadonlyMap<CompilerPassId, CompilerPass>,
    context: ExecutionContext,
    artifactRegistry: ArtifactRegistry,
    eventBus: RuntimeEventBus,
    metrics: RuntimeMetrics,
  ): PipelineExecutionResult => {
    const results: ExecutionResult[] = [];
    const completedPassIds = new Set<CompilerPassId>();
    let haltedEarly = false;
    let haltReason: string | undefined;

    const totalPasses = plan.passes.length;
    metrics.setTotalPasses(totalPasses);

    for (let i = 0; i < totalPasses; i++) {
      const passId = plan.passes[i];
      const pass = passes.get(passId);

      if (!pass) {
        // Pass not found in registry — record failure and optionally halt
        const msg = `Pass not registered in runtime: "${passId}"`;
        metrics.recordPassFailed();
        metrics.recordError();
        const result = createExecutionResult({
          passId,
          passName: passId,
          buildId: context.buildId,
          passIndex: i,
          success: false,
          cacheHit: false,
          durationMs: 0,
          outputCount: 0,
          stage: "failed",
          verificationResults: [],
          certificationResults: [],
          diagnostics: [],
          errors: [msg],
        });
        results.push(result);
        if (context.configuration.stopOnFirstFailure) {
          haltedEarly = true;
          haltReason = msg;
          break;
        }
        continue;
      }

      // Execute pass through full lifecycle
      const record = passExecutor.executePass(
        pass,
        i,
        totalPasses,
        completedPassIds,
        context,
        artifactRegistry,
        eventBus,
        metrics,
      );

      const result = createExecutionResult({
        passId: record.passId,
        passName: record.passName,
        buildId: record.buildId,
        passIndex: record.passIndex,
        success: record.success,
        cacheHit: record.cacheHit,
        durationMs: record.durationMs,
        outputCount: record.outputCount,
        stage: record.stage,
        verificationResults: record.verificationResults,
        certificationResults: record.certificationResults,
        diagnostics: record.diagnostics,
        errors: record.errors,
      });

      results.push(result);

      if (result.success) {
        completedPassIds.add(passId);
      } else if (context.configuration.stopOnFirstFailure) {
        haltedEarly = true;
        haltReason = `Pass "${passId}" failed: ${result.errors[0] ?? "unknown error"}`;
        break;
      }
    }

    const passesSucceeded = results.filter((r) => r.success).length;
    const passesFailed = results.filter((r) => !r.success).length;

    return Object.freeze({
      passResults: Object.freeze([...results]),
      passesExecuted: results.length,
      passesSucceeded,
      passesFailed,
      successful: passesFailed === 0 && !haltedEarly,
      haltedEarly,
      haltReason,
    });
  };

  return Object.freeze({ execute });
};
