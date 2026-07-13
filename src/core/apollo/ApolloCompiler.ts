/**
 * ApolloCompiler.ts
 *
 * Apollo Compiler Orchestrator - Enterprise Compiler Orchestrator
 *
 * Apollo orchestrates the Genesis compilation pipeline.
 * It determines what changed, what compiler passes must execute,
 * dependency ordering, verification requirements, incremental compilation,
 * and certification gates.
 *
 * Apollo DOES NOT:
 * - Perform LLM reasoning
 * - Execute passes (planning only)
 * - Modify Business Genome
 * - Redesign existing compilers
 * - Implement business logic
 *
 * Apollo manages orchestration infrastructure only.
 */

import type { CompilerPass, CompilerPassId } from "./CompilerPass.js";
import type { CompilerRegistry } from "./CompilerRegistry.js";
import type { DependencyGraph } from "./DependencyGraph.js";
import type { BuildPlan, BuildRequest } from "./BuildPlan.js";
import type { BuildResult } from "./BuildResult.js";
import type { CompilerPipeline, PipelineConfig } from "./CompilerPipeline.js";
import type { IncrementalCompiler, CacheState } from "./IncrementalCompiler.js";

/**
 * Apollo configuration
 */
export interface ApolloConfig {
  readonly name: "Apollo Compiler Orchestrator";
  readonly version: string;
  readonly deterministic: true;
  readonly incrementalBuildSupport: true;
  readonly certificationRequired: true;
  readonly verificationRequired: true;
}

/**
 * Apollo Compiler Orchestrator
 *
 * Manages the entire Genesis compilation orchestration.
 * Stateless. Immutable. Deterministic.
 *
 * Responsibility:
 * - Determine what changed
 * - Compute compiler pass dependencies
 * - Plan execution order
 * - Schedule verifications
 * - Schedule certifications
 * - Support incremental compilation
 * - Produce build plans
 *
 * No execution. No side effects. Planning only.
 */
export interface ApolloCompiler {
  /**
   * Apollo configuration
   */
  readonly config: ApolloConfig;

  /**
   * Register a compiler pass
   *
   * @param pass - Compiler pass to register
   * @returns New Apollo instance with pass registered
   */
  readonly register: (pass: CompilerPass) => ApolloCompiler;

  /**
   * Register multiple compiler passes
   *
   * @param passes - Passes to register
   * @returns New Apollo instance with all passes registered
   */
  readonly registerAll: (passes: readonly CompilerPass[]) => ApolloCompiler;

  /**
   * Get the compiler registry (read-only)
   */
  readonly getRegistry: () => CompilerRegistry;

  /**
   * Build the dependency graph
   *
   * @returns Dependency graph
   *
   * @throws if graph is cyclic
   */
  readonly getDependencyGraph: () => DependencyGraph;

  /**
   * Plan a build
   *
   * Determines what compiler passes must execute to produce requested outputs.
   * Does not execute the passes.
   *
   * @param request - Build request (what to build)
   * @returns Build plan (ordered passes, dependencies, verifications, certifications)
   *
   * @throws if plan cannot be created
   */
  readonly planBuild: (request: BuildRequest) => BuildPlan;

  /**
   * Plan an incremental build
   *
   * Determines minimal set of passes to rebuild based on changes.
   *
   * @param request - Build request
   * @param cache - Previous build cache
   * @returns Build plan
   */
  readonly planIncrementalBuild: (request: BuildRequest, cache: CacheState) => BuildPlan;

  /**
   * Get compilation pipeline
   *
   * @returns Compiler pipeline
   */
  readonly getPipeline: () => CompilerPipeline;

  /**
   * Validate Apollo orchestration
   *
   * @returns Validation result
   */
  readonly validate: () => ApolloValidationResult;

  /**
   * Freeze Apollo (make immutable)
   */
  readonly freeze: () => void;

  /**
   * Check if Apollo is frozen
   */
  readonly isFrozen: () => boolean;
}

/**
 * Apollo validation result
 */
export interface ApolloValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly registeredPasses: number;
  readonly dependencyGraphValid: boolean;
  readonly deterministic: true;
}

/**
 * Create Apollo Compiler Orchestrator
 *
 * @param version - Apollo version
 * @returns Apollo instance
 */
export const createApolloCompiler = (version: string): ApolloCompiler => {
  const config: ApolloConfig = {
    name: "Apollo Compiler Orchestrator",
    version,
    deterministic: true,
    incrementalBuildSupport: true,
    certificationRequired: true,
    verificationRequired: true,
  };

  // Import dependencies
  const { createCompilerRegistry } = require("./CompilerRegistry.js");
  const { createDependencyGraph } = require("./DependencyGraph.js");
  const { createIncrementalCompiler } = require("./IncrementalCompiler.js");
  const { createCompilerPipeline } = require("./CompilerPipeline.js");
  const { createBuildPlan } = require("./BuildPlan.js");

  let registry = createCompilerRegistry();
  let frozen = false;
  let cachedPipeline: CompilerPipeline | undefined;

  const register = (pass: CompilerPass): ApolloCompiler => {
    if (frozen) {
      throw new Error("Cannot register pass: Apollo is frozen");
    }

    registry = registry.register(pass);
    cachedPipeline = undefined; // Invalidate cached pipeline
    return apollo;
  };

  const registerAll = (passes: readonly CompilerPass[]): ApolloCompiler => {
    if (frozen) {
      throw new Error("Cannot register passes: Apollo is frozen");
    }

    let newRegistry = registry;
    passes.forEach((pass: CompilerPass) => {
      newRegistry = newRegistry.register(pass);
    });

    registry = newRegistry;
    cachedPipeline = undefined;
    return apollo;
  };

  const getRegistry = (): CompilerRegistry => registry;

  const getDependencyGraph = (): DependencyGraph => {
    let graph = createDependencyGraph();

    registry.getAll().forEach((pass: CompilerPass) => {
      graph = graph.addNode(pass);
    });

    return graph;
  };

  const getPipeline = (): CompilerPipeline => {
    if (cachedPipeline) {
      return cachedPipeline;
    }

    const pipelineConfig: PipelineConfig = {
      name: "Genesis Compilation Pipeline",
      version: config.version,
      description: "Apollo-orchestrated Genesis compilation pipeline",
      deterministic: true,
      cacheEnabled: true,
    };

    const pipeline = createCompilerPipeline(pipelineConfig, registry, createIncrementalCompiler());
    cachedPipeline = pipeline;
    return pipeline;
  };

  const planBuild = (request: BuildRequest): BuildPlan => {
    const pipeline = getPipeline();
    return pipeline.planBuild(request);
  };

  const planIncrementalBuild = (request: BuildRequest, cache: CacheState): BuildPlan => {
    const pipeline = getPipeline();
    const graph = getDependencyGraph();

    const incremental = createIncrementalCompiler();
    const passes = registry.getAll();

    const changes = incremental.detectChanges(passes, cache);
    const plan = incremental.plan(passes, graph, changes, request.forceRebuild);

    // Validate plan
    const validation = incremental.validate(plan, graph);
    if (!validation.valid) {
      throw new Error(`Invalid incremental plan: ${validation.issues.join(", ")}`);
    }

    // Create build plan
    return createBuildPlan(request, passes, graph);
  };

  const validate = (): ApolloValidationResult => {
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
      const graph = getDependencyGraph();
      const graphValidation = graph.validate();
      graphValid = graphValidation.valid;

      if (!graphValid) {
        issues.push(...graphValidation.issues);
      }
      if (graphValidation.warnings) {
        warnings.push(...graphValidation.warnings);
      }
    } catch (error) {
      issues.push(`Failed to build dependency graph: ${error instanceof Error ? error.message : "unknown"}`);
      graphValid = false;
    }

    // Validate pipeline
    const pipeline = getPipeline();
    const pipelineValidation = pipeline.validate();
    if (!pipelineValidation.valid) {
      issues.push(...pipelineValidation.issues);
    }
    warnings.push(...pipelineValidation.warnings);

    return {
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
      registeredPasses: registry.size,
      dependencyGraphValid: graphValid,
      deterministic: true,
    };
  };

  const freeze = (): void => {
    frozen = true;
    registry.freeze();
    if (cachedPipeline) {
      cachedPipeline.freeze();
    }
  };

  const isFrozen = (): boolean => frozen;

  const apollo: ApolloCompiler = {
    config,
    register,
    registerAll,
    getRegistry,
    getDependencyGraph,
    planBuild,
    planIncrementalBuild,
    getPipeline,
    validate,
    freeze,
    isFrozen,
  };

  return apollo;
};
