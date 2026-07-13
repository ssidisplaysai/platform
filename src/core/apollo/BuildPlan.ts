/**
 * BuildPlan.ts
 *
 * Immutable build plan representing the sequence of compiler passes
 * that must execute to produce target outputs.
 *
 * A BuildPlan is deterministic: same inputs always produce same plan.
 * A BuildPlan is never executed - it only represents what should execute.
 */

import type { CompilerPassId, CompilerPass } from "./CompilerPass.js";
import type { DependencyGraph } from "./DependencyGraph.js";
import type { VerificationSchedule } from "./VerificationGate.js";
import type { CertificationSchedule } from "./CertificationGate.js";

/**
 * Build request (what we want to build)
 */
export interface BuildRequest {
  readonly buildId: string;
  readonly timestamp: number;
  readonly targetOutputs: readonly string[];
  readonly changedArtifacts: readonly string[];
  readonly forceRebuild: boolean;
}

/**
 * Build phase in the pipeline
 */
export interface BuildPhase {
  readonly phaseId: string;
  readonly stageName: string;
  readonly passes: readonly CompilerPassId[];
  readonly parallel: boolean;
  readonly verifications: VerificationSchedule;
  readonly certifications: CertificationSchedule;
}

/**
 * Immutable build plan
 *
 * Represents the sequence of compiler passes that must execute
 * to produce requested outputs. Never modified after creation.
 */
export interface BuildPlan {
  readonly buildId: string;
  readonly timestamp: number;
  readonly request: BuildRequest;

  /**
   * All passes that must execute (in topological order)
   */
  readonly passes: readonly CompilerPassId[];

  /**
   * Grouped phases (passes that can run in parallel)
   */
  readonly phases: readonly BuildPhase[];

  /**
   * Dependency graph (read-only)
   */
  readonly graph: DependencyGraph;

  /**
   * Expected output artifacts
   */
  readonly expectedOutputs: readonly string[];

  /**
   * Total estimated duration (milliseconds)
   */
  readonly estimatedDuration: number;

  /**
   * Whether this plan involves incremental compilation
   */
  readonly incremental: boolean;

  /**
   * Passes that are cached (no rebuild needed)
   */
  readonly cachedPasses: readonly CompilerPassId[];

  /**
   * Passes that need rebuild
   */
  readonly dirtyPasses: readonly CompilerPassId[];

  /**
   * Passes that haven't been built yet
   */
  readonly newPasses: readonly CompilerPassId[];

  /**
   * Immutability marker
   */
  readonly readonly: true;

  /**
   * Freeze the plan (make immutable)
   */
  readonly freeze: () => void;

  /**
   * Get a summary of the plan
   */
  readonly summary: () => BuildPlanSummary;

  /**
   * Validate that the plan is consistent
   */
  readonly validate: () => PlanValidationResult;
}

/**
 * Summary of a build plan
 */
export interface BuildPlanSummary {
  readonly buildId: string;
  readonly totalPasses: number;
  readonly phases: number;
  readonly cachedPasses: number;
  readonly dirtyPasses: number;
  readonly newPasses: number;
  readonly estimatedDuration: number;
  readonly incremental: boolean;
}

/**
 * Result of plan validation
 */
export interface PlanValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Create an immutable build plan
 *
 * @param request - Build request
 * @param passes - All available passes
 * @param graph - Dependency graph
 * @returns Immutable build plan
 */
export const createBuildPlan = (
  request: BuildRequest,
  passes: readonly CompilerPass[],
  graph: DependencyGraph,
): BuildPlan => {
  const passMap = new Map(passes.map((p) => [p.id, p]));
  let frozen = false;

  // Compute topological order
  const topoOrder = graph.getTopologicalOrder();

  // Compute phases (execution levels)
  const levels = graph.getExecutionLevels();
  const phases: BuildPhase[] = levels.map((levelPasses, index) => ({
    phaseId: `phase-${index}`,
    stageName: computeStageName(index, levels.length),
    passes: Object.freeze([...levelPasses]),
    parallel: levelPasses.length > 1,
    verifications: {
      gates: [],
      parallel: true,
      stopOnFirstFailure: false,
    },
    certifications: {
      gates: [],
      parallel: false,
      minimumLevel: "alpha",
      stopOnFirstFailure: true,
    },
  }));

  // Determine cache status
  const changedSet = new Set(request.changedArtifacts);
  const cachedPasses: CompilerPassId[] = [];
  const dirtyPasses: CompilerPassId[] = [];
  const newPasses: CompilerPassId[] = [];

  topoOrder.forEach((passId) => {
    if (request.forceRebuild) {
      dirtyPasses.push(passId);
    } else if (changedSet.has(passId)) {
      dirtyPasses.push(passId);
    } else if (graph.getImpactSet(passId).some((p) => dirtyPasses.includes(p))) {
      dirtyPasses.push(passId);
    } else {
      cachedPasses.push(passId);
    }
  });

  // Compute estimated duration
  const estimatedDuration = topoOrder.reduce((sum, passId) => {
    const pass = passMap.get(passId);
    return sum + (pass ? 1000 : 0); // Placeholder: 1s per pass
  }, 0);

  const freeze = (): void => {
    frozen = true;
    Object.freeze(plan);
  };

  const summary = (): BuildPlanSummary => ({
    buildId: request.buildId,
    totalPasses: topoOrder.length,
    phases: phases.length,
    cachedPasses: cachedPasses.length,
    dirtyPasses: dirtyPasses.length,
    newPasses: newPasses.length,
    estimatedDuration,
    incremental: !request.forceRebuild,
  });

  const validate = (): PlanValidationResult => {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check that all passes exist
    topoOrder.forEach((passId) => {
      if (!passMap.has(passId)) {
        issues.push(`Pass not found: ${passId}`);
      }
    });

    // Check that dependency graph is valid
    const graphValidation = graph.validate();
    if (!graphValidation.valid) {
      issues.push(...graphValidation.issues);
    }

    // Check that phases are consistent with topological order
    const allPhasePasses = phases.flatMap((p) => p.passes);
    if (allPhasePasses.length !== topoOrder.length) {
      warnings.push("Phase pass count mismatch");
    }

    return {
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
    };
  };

  const plan: BuildPlan = {
    buildId: request.buildId,
    timestamp: request.timestamp,
    request,
    passes: Object.freeze([...topoOrder]),
    phases: Object.freeze(phases.map((p) => Object.freeze(p))),
    graph,
    expectedOutputs: Object.freeze([...request.targetOutputs]),
    estimatedDuration,
    incremental: !request.forceRebuild && dirtyPasses.length < topoOrder.length,
    cachedPasses: Object.freeze([...cachedPasses]),
    dirtyPasses: Object.freeze([...dirtyPasses]),
    newPasses: Object.freeze([...newPasses]),
    readonly: true,
    freeze,
    summary,
    validate,
  };

  return plan;
};

/**
 * Compute human-readable stage name based on phase index
 */
const computeStageName = (index: number, total: number): string => {
  const stages = [
    "Import & Parse",
    "Transform & Normalize",
    "Validate & Verify",
    "Generate Artifacts",
    "Verify Outputs",
    "Certify Results",
    "Deploy",
  ];

  return stages[index] ?? `Stage ${index + 1}`;
};
