/**
 * Apollo.test.ts
 *
 * Comprehensive test suite for Apollo Compiler Orchestrator
 */

import {
  createApolloCompiler,
  createCompilerRegistry,
  createDependencyGraph,
  createBuildPlan,
  createCompilerPipeline,
  createIncrementalCompiler,
} from "./index.js";
import type { CompilerPass, CompilerPassId } from "./CompilerPass.js";
import type { BuildRequest } from "./BuildPlan.js";

/**
 * Mock compiler passes for testing
 */
const createMockPass = (id: CompilerPassId, deps: CompilerPassId[] = []): CompilerPass => ({
  id,
  name: `${id} Pass`,
  description: `Test pass for ${id}`,
  version: "1.0.0",
  schemaVersion: "1.0.0",
  stage: "import",
  dependencies: deps.map((d) => ({
    passId: d,
    stage: "import",
    optional: false,
  })),
  inputs: [
    {
      type: "metadata",
      required: true,
      description: "Input metadata",
    },
  ],
  outputs: [
    {
      type: "document",
      format: "json",
      description: "Output document",
    },
  ],
  tags: ["test"],
  verificationSchedule: {
    gates: [],
    parallel: true,
    stopOnFirstFailure: false,
  },
  certificationSchedule: {
    gates: [],
    parallel: true,
    minimumLevel: "alpha",
    stopOnFirstFailure: true,
  },
  execute: async () => ({}),
  plan: async () => ({
    passId: id,
    outputCount: 1,
    estimatedDuration: 1000,
    dependencies: deps,
    verificationGates: [],
    certificationGates: [],
    deterministic: true,
  }),
});

describe("Apollo Compiler Orchestrator", () => {
  describe("Registration", () => {
    test("Register single pass", () => {
      const apollo = createApolloCompiler("1.0.0");
      const pass = createMockPass("discovery");

      const apollo2 = apollo.register(pass);

      const registry = apollo2.getRegistry();
      expect(registry.size).toBe(1);
      expect(registry.has("discovery")).toBe(true);
      expect(registry.get("discovery")).toBe(pass);
    });

    test("Register multiple passes", () => {
      const apollo = createApolloCompiler("1.0.0");
      const passes = [
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ];

      const apollo2 = apollo.registerAll(passes);

      const registry = apollo2.getRegistry();
      expect(registry.size).toBe(3);
      passes.forEach((p) => {
        expect(registry.has(p.id)).toBe(true);
      });
    });

    test("Cannot register duplicate pass", () => {
      let apollo = createApolloCompiler("1.0.0");
      const pass = createMockPass("discovery");

      apollo = apollo.register(pass);
      expect(() => apollo.register(pass)).toThrow();
    });

    test("Registry is immutable", () => {
      const apollo = createApolloCompiler("1.0.0");
      const pass = createMockPass("discovery");
      const apollo2 = apollo.register(pass);

      const registry = apollo2.getRegistry();
      expect(registry.isFrozen()).toBe(false);

      apollo2.freeze();
      expect(() => apollo2.register(createMockPass("evidence"))).toThrow();
    });
  });

  describe("Dependency Graph", () => {
    test("Build graph with no dependencies", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.register(createMockPass("discovery"));

      const graph = apollo2.getDependencyGraph();
      expect(graph.nodes.size).toBe(1);
      expect(graph.getNode("discovery")).toBeDefined();
    });

    test("Build graph with dependencies", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const graph = apollo2.getDependencyGraph();
      expect(graph.nodes.size).toBe(3);

      const node = graph.getNode("evidence");
      expect(node).toBeDefined();
      expect(node?.dependencies).toContain("discovery");
    });

    test("Topological ordering is deterministic", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const graph = apollo2.getDependencyGraph();
      const order1 = graph.getTopologicalOrder();
      const order2 = graph.getTopologicalOrder();

      expect(order1).toEqual(order2);
      expect(order1[0]).toBe("discovery");
      expect(order1[1]).toBe("evidence");
      expect(order1[2]).toBe("genome");
    });

    test("Detect cycles in dependency graph", () => {
      const apollo = createApolloCompiler("1.0.0");

      // Create cyclic dependencies
      const discovery = createMockPass("discovery", ["evidence"]);
      const evidence = createMockPass("evidence", ["discovery"]);

      const apollo2 = apollo.registerAll([discovery, evidence]);
      const graph = apollo2.getDependencyGraph();

      const validation = graph.validate();
      expect(validation.valid).toBe(false);
      expect(validation.cyclic).toBe(true);
      expect(validation.cycles.length).toBeGreaterThan(0);
    });

    test("Compute transitive dependencies", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
        createMockPass("blueprint", ["genome"]),
      ]);

      const graph = apollo2.getDependencyGraph();
      const deps = graph.getTransitiveDependencies("blueprint");

      expect(deps).toContain("genome");
      expect(deps).toContain("evidence");
      expect(deps).toContain("discovery");
      expect(deps.length).toBe(3);
    });

    test("Compute impact set", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const graph = apollo2.getDependencyGraph();
      const impact = graph.getImpactSet("evidence");

      expect(impact).toContain("evidence");
      expect(impact).toContain("genome");
      expect(impact).not.toContain("discovery");
    });

    test("Execution levels are correct", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const graph = apollo2.getDependencyGraph();
      const levels = graph.getExecutionLevels();

      expect(levels.length).toBe(3);
      expect(levels[0]).toContain("discovery");
      expect(levels[1]).toContain("evidence");
      expect(levels[2]).toContain("genome");
    });
  });

  describe("Build Planning", () => {
    test("Plan a simple build", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
      ]);

      const request: BuildRequest = {
        buildId: "build-001",
        timestamp: Date.now(),
        targetOutputs: ["evidence.json"],
        changedArtifacts: [],
        forceRebuild: false,
      };

      const plan = apollo2.planBuild(request);

      expect(plan.buildId).toBe("build-001");
      expect(plan.passes.length).toBe(2);
      expect(plan.passes[0]).toBe("discovery");
      expect(plan.passes[1]).toBe("evidence");
    });

    test("Plan includes proper phases", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
      ]);

      const request: BuildRequest = {
        buildId: "build-001",
        timestamp: Date.now(),
        targetOutputs: ["evidence.json"],
        changedArtifacts: [],
        forceRebuild: false,
      };

      const plan = apollo2.planBuild(request);

      expect(plan.phases.length).toBe(2);
      expect(plan.phases[0].parallel).toBe(false);
      expect(plan.phases[0].passes[0]).toBe("discovery");
      expect(plan.phases[1].passes[0]).toBe("evidence");
    });

    test("Build plan is immutable", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.register(createMockPass("discovery"));

      const request: BuildRequest = {
        buildId: "build-001",
        timestamp: Date.now(),
        targetOutputs: [],
        changedArtifacts: [],
        forceRebuild: false,
      };

      const plan = apollo2.planBuild(request);

      expect(plan.readonly).toBe(true);
      expect(() => {
        (plan as any).passes.push("new-pass");
      }).toThrow();
    });

    test("Incremental build planning", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const request: BuildRequest = {
        buildId: "build-002",
        timestamp: Date.now(),
        targetOutputs: ["genome.json"],
        changedArtifacts: ["evidence"],
        forceRebuild: false,
      };

      const cache = {
        entries: new Map(),
        lastBuildId: "build-001",
        lastBuildTime: Date.now() - 1000,
      };

      const plan = apollo2.planIncrementalBuild(request, cache);

      expect(plan.buildId).toBe("build-002");
      expect(plan.incremental).toBe(true);
    });
  });

  describe("Validation", () => {
    test("Validate empty registry", () => {
      const apollo = createApolloCompiler("1.0.0");
      const result = apollo.validate();

      expect(result.valid).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.registeredPasses).toBe(0);
    });

    test("Validate registry with passes", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
      ]);

      const result = apollo2.validate();

      expect(result.valid).toBe(true);
      expect(result.registeredPasses).toBe(2);
      expect(result.dependencyGraphValid).toBe(true);
    });

    test("Validate detects invalid graph", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.registerAll([
        createMockPass("discovery", ["evidence"]),
        createMockPass("evidence", ["discovery"]),
      ]);

      const result = apollo2.validate();

      expect(result.valid).toBe(false);
      expect(result.dependencyGraphValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("Immutability", () => {
    test("Apollo is immutable when frozen", () => {
      const apollo = createApolloCompiler("1.0.0");
      apollo.freeze();

      expect(() => apollo.register(createMockPass("discovery"))).toThrow();
      expect(apollo.isFrozen()).toBe(true);
    });

    test("Registry is immutable when frozen", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.register(createMockPass("discovery"));

      apollo2.freeze();

      expect(() => apollo2.register(createMockPass("evidence"))).toThrow();
    });
  });

  describe("Determinism", () => {
    test("Same passes produce same topological order", () => {
      const passes = [
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ];

      const apollo1 = createApolloCompiler("1.0.0").registerAll(passes);
      const apollo2 = createApolloCompiler("1.0.0").registerAll(passes);

      const graph1 = apollo1.getDependencyGraph();
      const graph2 = apollo2.getDependencyGraph();

      expect(graph1.getTopologicalOrder()).toEqual(graph2.getTopologicalOrder());
    });

    test("Build plans are deterministic", () => {
      const passes = [
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
      ];

      const apollo1 = createApolloCompiler("1.0.0").registerAll(passes);
      const apollo2 = createApolloCompiler("1.0.0").registerAll(passes);

      const request: BuildRequest = {
        buildId: "build-001",
        timestamp: 1000,
        targetOutputs: [],
        changedArtifacts: [],
        forceRebuild: false,
      };

      const plan1 = apollo1.planBuild(request);
      const plan2 = apollo2.planBuild(request);

      expect(plan1.passes).toEqual(plan2.passes);
      expect(plan1.phases.length).toEqual(plan2.phases.length);
    });
  });

  describe("Pipeline Integration", () => {
    test("Get pipeline from Apollo", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.register(createMockPass("discovery"));

      const pipeline = apollo2.getPipeline();

      expect(pipeline).toBeDefined();
      expect(pipeline.config.name).toContain("Pipeline");
      expect(pipeline.isFrozen()).toBe(false);
    });

    test("Freeze propagates to pipeline", () => {
      const apollo = createApolloCompiler("1.0.0");
      const apollo2 = apollo.register(createMockPass("discovery"));

      const pipeline = apollo2.getPipeline();
      apollo2.freeze();

      expect(pipeline.isFrozen()).toBe(true);
    });
  });

  describe("Incremental Compilation", () => {
    test("Detect first-time build", () => {
      const incremental = createIncrementalCompiler();
      const passes = [
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
      ];

      const changes = incremental.detectChanges(passes, undefined);

      expect(changes.changedPasses.length).toBe(2);
    });

    test("Plan incremental rebuild with changes", () => {
      const incremental = createIncrementalCompiler();
      const apollo = createApolloCompiler("1.0.0").registerAll([
        createMockPass("discovery"),
        createMockPass("evidence", ["discovery"]),
        createMockPass("genome", ["evidence"]),
      ]);

      const graph = apollo.getDependencyGraph();
      const passes = apollo.getRegistry().getAll();

      const changes = {
        changedPasses: ["evidence" as CompilerPassId],
        changedArtifacts: [],
        versionChanges: [],
        schemaChanges: [],
      };

      const plan = incremental.plan(passes, graph, changes, false);

      expect(plan.rebuild).toContain("evidence");
      expect(plan.rebuild).toContain("genome"); // Dependent on evidence
      expect(plan.cached).toContain("discovery");
    });
  });
});
