/**
 * CompilerPipeline.ts
 *
 * Core orchestration pipeline for the Genesis compilation process.
 * Manages build planning (not execution).
 *
 * Pipeline responsibilities:
 * - Accept build requests
 * - Compute dependency graphs
 * - Plan incremental compilation
 * - Schedule verifications and certifications
 * - Produce build plans (not execute them)
 */

import type { CompilerPass, CompilerPassId } from "./CompilerPass.js";
import type { CompilerRegistry } from "./CompilerRegistry.js";
import type { DependencyGraph } from "./DependencyGraph.js";
import type { BuildPlan, BuildRequest } from "./BuildPlan.js";
import type { IncrementalCompiler, CacheState } from "./IncrementalCompiler.js";

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly deterministic: boolean;
  readonly cacheEnabled: boolean;
}

/**
 * Pipeline state (read-only)
 */
export interface PipelineState {
  readonly config: PipelineConfig;
  readonly registry: CompilerRegistry;
  readonly graph: DependencyGraph;
  readonly cache?: CacheState;
  readonly lastBuildId?: string;
}

/**
 * Compiler orchestration pipeline
 *
 * Orchestrates the Genesis compilation pipeline without executing it.
 * Planning only. No side effects.
 */
export interface CompilerPipeline {
  /**
   * Pipeline configuration
   */
  readonly config: PipelineConfig;

  /**
   * Get current state (immutable)
   */
  readonly getState: () => PipelineState;

  /**
   * Register a compiler pass
   *
   * @param pass - Pass to register
   * @returns New pipeline with pass registered
   *
   * @throws if pass cannot be registered
   */
  readonly registerPass: (pass: CompilerPass) => CompilerPipeline;

  /**
   * Build a dependency graph from registered passes
   *
   * @returns Dependency graph
   *
   * @throws if graph is cyclic or invalid
   */
  readonly buildDependencyGraph: () => DependencyGraph;

  /**
   * Plan a build without executing it
   *
   * @param request - What to build
   * @returns Build plan (ready to execute, but not executed)
   *
   * @throws if plan cannot be created
   */
  readonly planBuild: (request: BuildRequest) => BuildPlan;

  /**
   * Validate the pipeline configuration
   *
   * @returns Validation result
   */
  readonly validate: () => PipelineValidationResult;

  /**
   * Freeze the pipeline (make immutable)
   */
  readonly freeze: () => void;

  /**
   * Check if pipeline is frozen
   */
  readonly isFrozen: () => boolean;
}

/**
 * Pipeline validation result
 */
export interface PipelineValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly passCount: number;
  readonly graphValid: boolean;
}

/**
 * Create a compiler pipeline
 *
 * @param config - Pipeline configuration
 * @param registry - Compiler registry
 * @param incremental - Incremental compiler
 * @returns Compiler pipeline
 */
export const createCompilerPipeline = (
  config: PipelineConfig,
  registry: CompilerRegistry,
  incremental: IncrementalCompiler,
): CompilerPipeline => {
  let frozen = false;
  let cachedGraph: DependencyGraph | undefined;

  const buildDependencyGraph = (): DependencyGraph => {
    if (cachedGraph) {
      return cachedGraph;
    }

    // Import DependencyGraph creation function
    const { createDependencyGraph } = require("./DependencyGraph.js");
    let graph = createDependencyGraph();

    const passes = registry.getAll();
    passes.forEach((pass) => {
      graph = graph.addNode(pass);
    });

    graph.freeze();
    cachedGraph = graph;

    return graph;
  };

  const getState = (): PipelineState => {
    return {
      config,
      registry,
      graph: buildDependencyGraph(),
      cache: undefined,
      lastBuildId: undefined,
    };
  };

  const registerPass = (pass: CompilerPass): CompilerPipeline => {
    if (frozen) {
      throw new Error("Cannot register pass: pipeline is frozen");
    }

    const newRegistry = registry.register(pass);
    cachedGraph = undefined; // Invalidate cached graph

    return createCompilerPipeline(config, newRegistry, incremental);
  };

  const planBuild = (request: BuildRequest): BuildPlan => {
    const graph = buildDependencyGraph();
    const passes = registry.getAll();

    // Validate graph
    const graphValidation = graph.validate();
    if (!graphValidation.valid) {
      throw new Error(`Invalid dependency graph: ${graphValidation.issues.join(", ")}`);
    }

    // Validate request
    if (!request.buildId || request.buildId.length === 0) {
      throw new Error("Build request must have a buildId");
    }

    // Create build plan
    const { createBuildPlan } = require("./BuildPlan.js");
    const plan = createBuildPlan(request, passes, graph);

    // Validate plan
    const planValidation = plan.validate();
    if (!planValidation.valid) {
      throw new Error(`Invalid build plan: ${planValidation.issues.join(", ")}`);
    }

    return plan;
  };

  const validate = (): PipelineValidationResult => {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate registry
    const registryValidation = registry.validate();
    if (!registryValidation.valid) {
      issues.push(...registryValidation.issues);
    }
    warnings.push(...registryValidation.warnings);

    // Validate graph
    let graphValid = false;
    try {
      const graph = buildDependencyGraph();
      const graphValidation = graph.validate();
      graphValid = graphValidation.valid;

      if (!graphValid) {
        issues.push(...graphValidation.issues);
      }
      if (graphValidation.warnings) {
        warnings.push(...graphValidation.warnings);
      }
    } catch (error) {
      issues.push(`Failed to build graph: ${error instanceof Error ? error.message : "unknown"}`);
      graphValid = false;
    }

    // Validate config
    if (!config.name || config.name.length === 0) {
      issues.push("Pipeline name is required");
    }

    if (!config.version || config.version.length === 0) {
      issues.push("Pipeline version is required");
    }

    return {
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
      passCount: registry.size,
      graphValid,
    };
  };

  const freeze = (): void => {
    frozen = true;
    registry.freeze();
    if (cachedGraph) {
      cachedGraph.freeze();
    }
  };

  const isFrozen = (): boolean => frozen;

  const pipeline: CompilerPipeline = {
    config,
    getState,
    registerPass,
    buildDependencyGraph,
    planBuild,
    validate,
    freeze,
    isFrozen,
  };

  return pipeline;
};
