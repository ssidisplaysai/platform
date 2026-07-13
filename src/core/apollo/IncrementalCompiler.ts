/**
 * IncrementalCompiler.ts
 *
 * Planning logic for incremental compilation.
 * Determines what artifacts need rebuilding based on changes.
 *
 * No execution or side effects. Planning only.
 */

import type { CompilerPassId, CompilerPass } from "./CompilerPass.js";
import type { DependencyGraph } from "./DependencyGraph.js";

/**
 * Cache entry for a compiler pass output
 */
export interface CacheEntry {
  readonly passId: CompilerPassId;
  readonly version: string;
  readonly schemaVersion: string;
  readonly outputHash: string;
  readonly timestamp: number;
}

/**
 * Cache state (what we know about previous builds)
 */
export interface CacheState {
  readonly entries: ReadonlyMap<CompilerPassId, CacheEntry>;
  readonly lastBuildId: string;
  readonly lastBuildTime: number;
}

/**
 * Incremental compilation plan
 */
export interface IncrementalPlan {
  readonly forceRebuild: boolean;
  readonly rebuild: readonly CompilerPassId[];
  readonly cached: readonly CompilerPassId[];
  readonly new: readonly CompilerPassId[];
  readonly invalidated: readonly CompilerPassId[];
}

/**
 * Change set (what changed since last build)
 */
export interface ChangeSet {
  readonly changedPasses: readonly CompilerPassId[];
  readonly changedArtifacts: readonly string[];
  readonly versionChanges: readonly VersionChange[];
  readonly schemaChanges: readonly SchemaChange[];
}

/**
 * Version change for a pass
 */
export interface VersionChange {
  readonly passId: CompilerPassId;
  readonly from: string;
  readonly to: string;
}

/**
 * Schema change for a pass
 */
export interface SchemaChange {
  readonly passId: CompilerPassId;
  readonly from: string;
  readonly to: string;
}

/**
 * Incremental compiler (planning only)
 */
export interface IncrementalCompiler {
  /**
   * Detect changes between cache state and current state
   *
   * @param current - Current passes
   * @param cache - Previous cache state
   * @returns Change set
   */
  readonly detectChanges: (current: readonly CompilerPass[], cache: CacheState | undefined) => ChangeSet;

  /**
   * Plan incremental compilation based on changes
   *
   * @param passes - All available passes
   * @param graph - Dependency graph
   * @param changes - Detected changes
   * @param forceRebuild - Force all passes to rebuild
   * @returns Incremental plan
   */
  readonly plan: (
    passes: readonly CompilerPass[],
    graph: DependencyGraph,
    changes: ChangeSet,
    forceRebuild: boolean,
  ) => IncrementalPlan;

  /**
   * Validate an incremental plan
   *
   * @param plan - Plan to validate
   * @param graph - Dependency graph
   * @returns Validation result
   */
  readonly validate: (plan: IncrementalPlan, graph: DependencyGraph) => PlanValidationResult;
}

/**
 * Plan validation result
 */
export interface PlanValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Create an incremental compiler instance
 *
 * @returns Incremental compiler
 */
export const createIncrementalCompiler = (): IncrementalCompiler => {
  const detectChanges = (current: readonly CompilerPass[], cache: CacheState | undefined): ChangeSet => {
    const changedPasses: CompilerPassId[] = [];
    const versionChanges: VersionChange[] = [];
    const schemaChanges: SchemaChange[] = [];

    if (!cache) {
      // First build - all passes are new
      current.forEach((pass) => {
        changedPasses.push(pass.id);
      });

      return {
        changedPasses: Object.freeze(changedPasses),
        changedArtifacts: Object.freeze([]),
        versionChanges: Object.freeze(versionChanges),
        schemaChanges: Object.freeze(schemaChanges),
      };
    }

    const passMap = new Map(current.map((p) => [p.id, p]));

    current.forEach((pass) => {
      const cached = Array.from(cache.entries.values()).find((e) => e.passId === pass.id);

      if (!cached) {
        // New pass
        changedPasses.push(pass.id);
      } else if (cached.version !== pass.version) {
        // Version changed
        versionChanges.push({
          passId: pass.id,
          from: cached.version,
          to: pass.version,
        });
        changedPasses.push(pass.id);
      } else if (cached.schemaVersion !== pass.schemaVersion) {
        // Schema changed
        schemaChanges.push({
          passId: pass.id,
          from: cached.schemaVersion,
          to: pass.schemaVersion,
        });
        changedPasses.push(pass.id);
      }
    });

    // Check for removed passes
    cache.entries.forEach((entry) => {
      if (!passMap.has(entry.passId)) {
        changedPasses.push(entry.passId);
      }
    });

    return {
      changedPasses: Object.freeze([...new Set(changedPasses)]),
      changedArtifacts: Object.freeze([]),
      versionChanges: Object.freeze(versionChanges),
      schemaChanges: Object.freeze(schemaChanges),
    };
  };

  const plan = (
    passes: readonly CompilerPass[],
    graph: DependencyGraph,
    changes: ChangeSet,
    forceRebuild: boolean,
  ): IncrementalPlan => {
    const rebuild: CompilerPassId[] = [];
    const cached: CompilerPassId[] = [];
    const newPasses: CompilerPassId[] = [];

    if (forceRebuild) {
      // Full rebuild
      passes.forEach((p) => rebuild.push(p.id));
      return {
        forceRebuild: true,
        rebuild: Object.freeze(rebuild),
        cached: Object.freeze([]),
        new: Object.freeze([]),
        invalidated: Object.freeze([]),
      };
    }

    const changedSet = new Set(changes.changedPasses);
    const impacted = new Set<CompilerPassId>();

    // Compute impact of changes
    changes.changedPasses.forEach((passId) => {
      const impact = graph.getImpactSet(passId);
      impact.forEach((p) => impacted.add(p));
    });

    // Classify passes
    passes.forEach((pass) => {
      if (impacted.has(pass.id)) {
        rebuild.push(pass.id);
      } else if (changedSet.has(pass.id)) {
        newPasses.push(pass.id);
      } else {
        cached.push(pass.id);
      }
    });

    return {
      forceRebuild: false,
      rebuild: Object.freeze(rebuild),
      cached: Object.freeze(cached),
      new: Object.freeze(newPasses),
      invalidated: Object.freeze([...impacted]),
    };
  };

  const validate = (plan: IncrementalPlan, graph: DependencyGraph): PlanValidationResult => {
    const issues: string[] = [];
    const warnings: string[] = [];

    const allPasses = new Set([...plan.rebuild, ...plan.cached, ...plan.new]);

    // Check that all passes in plan are in graph
    allPasses.forEach((passId) => {
      const node = graph.getNode(passId);
      if (!node) {
        issues.push(`Pass not in graph: ${passId}`);
      }
    });

    // Check for conflicts
    const rebuiltSet = new Set(plan.rebuild);
    const cachedSet = new Set(plan.cached);
    const newSet = new Set(plan.new);

    rebuiltSet.forEach((p) => {
      if (cachedSet.has(p) || newSet.has(p)) {
        issues.push(`Pass appears in multiple categories: ${p}`);
      }
    });

    cachedSet.forEach((p) => {
      if (newSet.has(p)) {
        issues.push(`Pass appears in both cached and new: ${p}`);
      }
    });

    // Check that invalidated passes are in rebuild
    plan.invalidated.forEach((p) => {
      if (!rebuiltSet.has(p)) {
        warnings.push(`Invalidated pass not in rebuild: ${p}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
    };
  };

  return {
    detectChanges,
    plan,
    validate,
  };
};
