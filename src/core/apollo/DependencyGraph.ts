/**
 * DependencyGraph.ts
 *
 * Immutable dependency graph for compiler passes.
 * Manages topological ordering and detects cycles.
 *
 * The graph is deterministic: same passes always produce same ordering.
 */

import type { CompilerPassId, CompilerPass } from "./CompilerPass.js";

/**
 * Node in the dependency graph
 */
export interface DependencyNode {
  readonly passId: CompilerPassId;
  readonly dependencies: readonly CompilerPassId[];
  readonly dependents: readonly CompilerPassId[];
}

/**
 * Result of graph analysis
 */
export interface GraphAnalysisResult {
  readonly valid: boolean;
  readonly cyclic: boolean;
  readonly cycles: readonly (readonly CompilerPassId[])[];
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly topologicalOrder: readonly CompilerPassId[];
}

/**
 * Immutable dependency graph for compiler passes
 */
export interface DependencyGraph {
  /**
   * All nodes in the graph (immutable)
   */
  readonly nodes: ReadonlyMap<CompilerPassId, DependencyNode>;

  /**
   * Add a node to the graph
   *
   * @param pass - Compiler pass to add
   * @returns New graph with node added (original unchanged)
   *
   * @throws if pass already exists
   */
  readonly addNode: (pass: CompilerPass) => DependencyGraph;

  /**
   * Get node by pass ID
   *
   * @param passId - ID to look up
   * @returns Node or undefined
   */
  readonly getNode: (passId: CompilerPassId) => DependencyNode | undefined;

  /**
   * Compute topological order (deterministic)
   *
   * @returns Passes ordered for compilation
   *
   * Same graph always produces same order (alphabetical for ties).
   * Throws if graph is cyclic.
   */
  readonly getTopologicalOrder: () => readonly CompilerPassId[];

  /**
   * Check if graph is valid (no cycles)
   *
   * @returns Analysis result
   */
  readonly validate: () => GraphAnalysisResult;

  /**
   * Get all passes that must execute before a given pass
   *
   * @param passId - Target pass
   * @returns Transitive closure of dependencies
   */
  readonly getTransitiveDependencies: (passId: CompilerPassId) => readonly CompilerPassId[];

  /**
   * Get all passes that depend on a given pass
   *
   * @param passId - Target pass
   * @returns All dependents (transitive closure)
   */
  readonly getTransitiveDependents: (passId: CompilerPassId) => readonly CompilerPassId[];

  /**
   * Determine what must rebuild if a pass changed
   *
   * @param changedPassId - Pass that changed
   * @returns All passes that need rebuild (including the changed pass)
   */
  readonly getImpactSet: (changedPassId: CompilerPassId) => readonly CompilerPassId[];

  /**
   * Get execution levels (passes that can run in parallel)
   *
   * @returns Levels, where each level can execute in parallel
   */
  readonly getExecutionLevels: () => readonly (readonly CompilerPassId[])[];

  /**
   * Freeze the graph (make immutable)
   *
   * @returns Immutable graph
   */
  readonly freeze: () => DependencyGraph;
}

/**
 * Create an empty dependency graph
 *
 * @returns New empty graph
 */
export const createDependencyGraph = (): DependencyGraph => {
  const nodes = new Map<CompilerPassId, DependencyNode>();
  let frozen = false;

  const addNode = (pass: CompilerPass): DependencyGraph => {
    if (frozen) {
      throw new Error("Cannot modify frozen graph");
    }

    if (nodes.has(pass.id)) {
      throw new Error(`Pass already exists: ${pass.id}`);
    }

    const newGraph = createDependencyGraph();
    nodes.forEach((node, id) => {
      const newNodes = (newGraph as any).nodes;
      newNodes.set(id, node);
    });

    const deps = pass.dependencies.map((d) => d.passId);
    const newNode: DependencyNode = {
      passId: pass.id,
      dependencies: deps,
      dependents: [],
    };

    (newGraph as any).nodes.set(pass.id, newNode);

    // Update dependents in all dependency nodes
    deps.forEach((depId) => {
      const depNode = (newGraph as any).nodes.get(depId);
      if (depNode) {
        const updated: DependencyNode = {
          ...depNode,
          dependents: [...depNode.dependents, pass.id].sort(),
        };
        (newGraph as any).nodes.set(depId, updated);
      }
    });

    return newGraph;
  };

  const getNode = (passId: CompilerPassId): DependencyNode | undefined => {
    return nodes.get(passId);
  };

  const getTopologicalOrder = (): readonly CompilerPassId[] => {
    const result: CompilerPassId[] = [];
    const visited = new Set<CompilerPassId>();
    const visiting = new Set<CompilerPassId>();

    const visit = (id: CompilerPassId): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Cycle detected involving: ${id}`);
      }

      visiting.add(id);
      const node = nodes.get(id);

      if (node) {
        const sortedDeps = [...node.dependencies].sort();
        sortedDeps.forEach(visit);
      }

      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    const sorted = Array.from(nodes.keys()).sort();
    sorted.forEach(visit);

    return Object.freeze(result);
  };

  const validate = (): GraphAnalysisResult => {
    const cycles: (readonly CompilerPassId[])[] = [];
    const issues: string[] = [];
    const warnings: string[] = [];
    let topologicalOrder: readonly CompilerPassId[] = [];

    try {
      topologicalOrder = getTopologicalOrder();
    } catch (error) {
      issues.push(`Cycle detected: ${error instanceof Error ? error.message : "unknown"}`);
      cycles.push([]);
    }

    return {
      valid: issues.length === 0,
      cyclic: cycles.length > 0,
      cycles: Object.freeze(cycles),
      issues: Object.freeze(issues),
      warnings: Object.freeze(warnings),
      topologicalOrder: Object.freeze(topologicalOrder),
    };
  };

  const getTransitiveDependencies = (passId: CompilerPassId): readonly CompilerPassId[] => {
    const result = new Set<CompilerPassId>();
    const visited = new Set<CompilerPassId>();

    const visit = (id: CompilerPassId): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = nodes.get(id);
      if (node) {
        node.dependencies.forEach((depId) => {
          result.add(depId);
          visit(depId);
        });
      }
    };

    visit(passId);
    return Object.freeze(Array.from(result).sort());
  };

  const getTransitiveDependents = (passId: CompilerPassId): readonly CompilerPassId[] => {
    const result = new Set<CompilerPassId>();
    const visited = new Set<CompilerPassId>();

    const visit = (id: CompilerPassId): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = nodes.get(id);
      if (node) {
        node.dependents.forEach((depId) => {
          result.add(depId);
          visit(depId);
        });
      }
    };

    visit(passId);
    return Object.freeze(Array.from(result).sort());
  };

  const getImpactSet = (changedPassId: CompilerPassId): readonly CompilerPassId[] => {
    const result = new Set<CompilerPassId>([changedPassId]);
    const dependents = getTransitiveDependents(changedPassId);
    dependents.forEach((d) => result.add(d));
    return Object.freeze(Array.from(result).sort());
  };

  const getExecutionLevels = (): readonly (readonly CompilerPassId[])[] => {
    const levels: CompilerPassId[][] = [];
    const assigned = new Set<CompilerPassId>();

    while (assigned.size < nodes.size) {
      const level: CompilerPassId[] = [];

      Array.from(nodes.keys())
        .sort()
        .forEach((id) => {
          if (assigned.has(id)) return;

          const deps = getTransitiveDependencies(id);
          const unresolved = deps.filter((d) => !assigned.has(d));

          if (unresolved.length === 0) {
            level.push(id);
          }
        });

      if (level.length === 0) {
        throw new Error("Circular dependency detected in execution levels");
      }

      level.forEach((id) => assigned.add(id));
      levels.push(level);
    }

    return Object.freeze(levels.map((l) => Object.freeze(l)));
  };

  const freeze = (): DependencyGraph => {
    frozen = true;
    Object.freeze(nodes);
    return graph;
  };

  const graph: DependencyGraph = {
    nodes: nodes as ReadonlyMap<CompilerPassId, DependencyNode>,
    addNode,
    getNode,
    getTopologicalOrder,
    validate,
    getTransitiveDependencies,
    getTransitiveDependents,
    getImpactSet,
    getExecutionLevels,
    freeze,
  };

  return graph;
};
