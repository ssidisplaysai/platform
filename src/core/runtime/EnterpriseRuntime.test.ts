/**
 * EnterpriseRuntime.test.ts
 *
 * Comprehensive test suite for the Enterprise Runtime Core.
 *
 * Coverage:
 * - Runtime creation and configuration
 * - Immutable execution context
 * - Status model and valid/invalid transitions
 * - Pass execution ordering
 * - Artifact registration and registry immutability
 * - Event publication and subscription
 * - Execution report generation
 * - Metrics collection
 * - Pipeline execution
 * - Failure handling and stopOnFirstFailure
 * - Cancellation
 * - Determinism
 */

import {
  createEnterpriseRuntime,
  createArtifactRegistry,
  createRuntimeEventBus,
  createRuntimeMetrics,
  createRuntimeConfiguration,
  createExecutionContext,
  createPassExecutor,
  createRuntimePipeline,
  computeRuntimeStatistics,
  isValidTransition,
  isTerminal,
  isActive,
  assertValidTransition,
  RUNTIME_VERSION,
  DEFAULT_RUNTIME_CONFIGURATION,
} from "./index.js";

import type { CompilerPass, CompilerPassId } from "../apollo/CompilerPass.js";
import type { BuildPlan } from "../apollo/BuildPlan.js";
import type { AnyRuntimeEvent } from "./RuntimeEvents.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Create a minimal synchronous mock CompilerPass.
 *
 * execute() returns a plain object (not a Promise) cast to the required type.
 * The Enterprise Runtime checks instanceof Promise and uses the result directly
 * when it is not a Promise, enabling synchronous test execution.
 */
const createMockPass = (
  id: CompilerPassId,
  deps: CompilerPassId[] = [],
  outputs: Record<string, unknown> = {},
): CompilerPass => ({
  id,
  name: `${id} Pass`,
  description: `Test pass: ${id}`,
  version: "1.0.0",
  schemaVersion: "1.0.0",
  stage: "transform",
  dependencies: deps.map((d) => ({ passId: d, stage: "transform", optional: false })),
  inputs: [{ type: "metadata", required: true, description: "Input" }],
  outputs: [{ type: "document", format: "json", description: "Output" }],
  tags: ["test"],
  verificationSchedule: { gates: [], parallel: false, stopOnFirstFailure: false },
  certificationSchedule: {
    gates: [],
    parallel: false,
    minimumLevel: "alpha",
    stopOnFirstFailure: false,
  },
  // Synchronous return — cast to satisfy interface type while returning a plain object
  execute: (_inputs, _ctx) => outputs as unknown as Promise<Record<string, unknown>>,
  plan: async () => ({
    passId: id,
    outputCount: 1,
    estimatedDuration: 1,
    dependencies: deps,
    verificationGates: [],
    certificationGates: [],
    deterministic: true,
  }),
});

/**
 * Create a mock pass whose execute throws.
 */
const createFailingPass = (id: CompilerPassId): CompilerPass => ({
  ...createMockPass(id),
  execute: () => { throw new Error(`${id} execution failed`); },
});

/**
 * Create a minimal BuildPlan with the given pass IDs in order.
 */
const createMockBuildPlan = (
  buildId: string,
  passIds: CompilerPassId[],
  timestamp = 1_000_000,
): BuildPlan => ({
  buildId,
  timestamp,
  request: {
    buildId,
    timestamp,
    targetOutputs: ["document"],
    changedArtifacts: [],
    forceRebuild: false,
  },
  passes: passIds,
  phases: [],
  graph: {
    nodes: new Map(),
    addNode: () => { throw new Error("mock — addNode"); },
    getNode: () => undefined,
    getTopologicalOrder: () => passIds,
    getTransitiveDependencies: () => [],
    getTransitiveDependents: () => [],
    getImpactSet: () => [],
    getExecutionLevels: () => [passIds],
    freeze: function(this: BuildPlan["graph"]) { return this; },
    validate: () => ({
      valid: true,
      cyclic: false,
      cycles: [],
      issues: [],
      warnings: [],
      topologicalOrder: passIds,
    }),
  },
  expectedOutputs: ["document"],
  estimatedDuration: passIds.length,
  incremental: false,
  cachedPasses: [],
  dirtyPasses: passIds,
  newPasses: [],
  readonly: true,
  freeze: () => { /* no-op */ },
  summary: () => ({
    buildId,
    totalPasses: passIds.length,
    phases: 1,
    cachedPasses: 0,
    dirtyPasses: passIds.length,
    newPasses: 0,
    estimatedDuration: passIds.length,
    incremental: false,
  }),
  validate: () => ({ valid: true, issues: [], warnings: [] }),
});

// ─── RuntimeStatus tests ──────────────────────────────────────────────────────

describe("RuntimeStatus", () => {
  test("isValidTransition — valid forward transitions", () => {
    expect(isValidTransition("created", "preparing")).toBe(true);
    expect(isValidTransition("preparing", "executing")).toBe(true);
    expect(isValidTransition("executing", "verifying")).toBe(true);
    expect(isValidTransition("verifying", "certifying")).toBe(true);
    expect(isValidTransition("certifying", "completed")).toBe(true);
  });

  test("isValidTransition — valid failure/cancellation transitions", () => {
    expect(isValidTransition("preparing", "failed")).toBe(true);
    expect(isValidTransition("executing", "cancelled")).toBe(true);
    expect(isValidTransition("verifying", "failed")).toBe(true);
  });

  test("isValidTransition — invalid reverse transitions", () => {
    expect(isValidTransition("executing", "created")).toBe(false);
    expect(isValidTransition("completed", "executing")).toBe(false);
    expect(isValidTransition("failed", "preparing")).toBe(false);
  });

  test("isTerminal — terminal states", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  test("isTerminal — non-terminal states", () => {
    expect(isTerminal("created")).toBe(false);
    expect(isTerminal("executing")).toBe(false);
    expect(isTerminal("verifying")).toBe(false);
  });

  test("isActive — active states", () => {
    expect(isActive("preparing")).toBe(true);
    expect(isActive("executing")).toBe(true);
    expect(isActive("verifying")).toBe(true);
    expect(isActive("certifying")).toBe(true);
  });

  test("isActive — inactive states", () => {
    expect(isActive("created")).toBe(false);
    expect(isActive("completed")).toBe(false);
  });

  test("assertValidTransition — throws on invalid transition", () => {
    expect(() => assertValidTransition("completed", "executing")).toThrow(
      /Invalid runtime status transition/,
    );
  });

  test("assertValidTransition — does not throw on valid transition", () => {
    expect(() => assertValidTransition("created", "preparing")).not.toThrow();
  });
});

// ─── RuntimeConfiguration tests ──────────────────────────────────────────────

describe("RuntimeConfiguration", () => {
  test("DEFAULT_RUNTIME_CONFIGURATION is frozen", () => {
    expect(Object.isFrozen(DEFAULT_RUNTIME_CONFIGURATION)).toBe(true);
  });

  test("parallelExecution is always false", () => {
    expect(DEFAULT_RUNTIME_CONFIGURATION.parallelExecution).toBe(false);
  });

  test("createRuntimeConfiguration merges overrides", () => {
    const cfg = createRuntimeConfiguration({ verificationEnabled: false, loggingLevel: "debug" });
    expect(cfg.verificationEnabled).toBe(false);
    expect(cfg.loggingLevel).toBe("debug");
    expect(cfg.parallelExecution).toBe(false);
    expect(cfg.certificationEnabled).toBe(true); // default
  });

  test("createRuntimeConfiguration returns frozen object", () => {
    const cfg = createRuntimeConfiguration({});
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test("createRuntimeConfiguration always sets parallelExecution to false", () => {
    // Even if caller tried to override it
    const cfg = createRuntimeConfiguration({} as Parameters<typeof createRuntimeConfiguration>[0]);
    expect(cfg.parallelExecution).toBe(false);
  });
});

// ─── ExecutionContext tests ───────────────────────────────────────────────────

describe("ExecutionContext", () => {
  const cfg = createRuntimeConfiguration();

  test("createExecutionContext returns frozen object", () => {
    const ctx = createExecutionContext({
      buildId: "build-001",
      companyId: "company-001",
      workspace: "/workspace",
      environment: "production",
      compilerVersion: "1.0.0",
      runtimeVersion: RUNTIME_VERSION,
      requestedTargets: ["document"],
      startTime: 1_000_000,
      configuration: cfg,
    });
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.requestedTargets)).toBe(true);
  });

  test("execution context is immutable — mutation rejected in strict mode", () => {
    const ctx = createExecutionContext({
      buildId: "build-001",
      companyId: "company-001",
      workspace: "/workspace",
      environment: "test",
      compilerVersion: "1.0.0",
      runtimeVersion: RUNTIME_VERSION,
      requestedTargets: [],
      startTime: 0,
      configuration: cfg,
    });
    expect(() => {
      (ctx as unknown as Record<string, string>)["buildId"] = "tampered";
    }).toThrow();
  });

  test("requestedTargets array is frozen", () => {
    const ctx = createExecutionContext({
      buildId: "b",
      companyId: "c",
      workspace: "/w",
      environment: "test",
      compilerVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      requestedTargets: ["a", "b"],
      startTime: 0,
      configuration: cfg,
    });
    expect(Object.isFrozen(ctx.requestedTargets)).toBe(true);
  });
});

// ─── ArtifactRegistry tests ───────────────────────────────────────────────────

describe("ArtifactRegistry", () => {
  test("register and retrieve an artifact", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "document",
      producerPassId: "discovery",
      checksum: "abc123",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 100,
      path: "/artifacts/a1",
    });
    const entry = reg.get("a1");
    expect(entry).toBeDefined();
    expect(entry?.verificationState).toBe("pending");
    expect(entry?.certificationState).toBe("pending");
  });

  test("register duplicate throws", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "document",
      producerPassId: "discovery",
      checksum: "x",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    expect(() =>
      reg.register({
        artifactId: "a1",
        type: "document",
        producerPassId: "evidence",
        checksum: "y",
        version: "1.0.0",
        dependencies: [],
        generationTime: 0,
        size: 0,
        path: "/",
      }),
    ).toThrow(/already registered/);
  });

  test("setVerificationState updates entry immutably", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "doc",
      producerPassId: "discovery",
      checksum: "x",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    reg.setVerificationState("a1", "passed");
    const entry = reg.get("a1");
    expect(entry?.verificationState).toBe("passed");
    expect(Object.isFrozen(entry)).toBe(true);
  });

  test("setCertificationState updates entry immutably", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "doc",
      producerPassId: "discovery",
      checksum: "x",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    reg.setCertificationState("a1", "certified");
    expect(reg.get("a1")?.certificationState).toBe("certified");
  });

  test("snapshot returns immutable artifact list", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "doc",
      producerPassId: "discovery",
      checksum: "x",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    const snap = reg.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.artifacts)).toBe(true);
    expect(snap.count).toBe(1);
  });

  test("byPass filters correctly", () => {
    const reg = createArtifactRegistry();
    reg.register({
      artifactId: "a1",
      type: "doc",
      producerPassId: "discovery",
      checksum: "x",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    reg.register({
      artifactId: "a2",
      type: "doc",
      producerPassId: "evidence",
      checksum: "y",
      version: "1.0.0",
      dependencies: [],
      generationTime: 0,
      size: 0,
      path: "/",
    });
    const discoveryArtifacts = reg.byPass("discovery");
    expect(discoveryArtifacts.length).toBe(1);
    expect(discoveryArtifacts[0].artifactId).toBe("a1");
  });
});

// ─── RuntimeEventBus tests ────────────────────────────────────────────────────

describe("RuntimeEventBus", () => {
  test("subscribe and receive typed events", () => {
    const bus = createRuntimeEventBus();
    const received: AnyRuntimeEvent[] = [];
    bus.subscribe("PassStarted", (e) => received.push(e));
    bus.publish(Object.freeze({
      type: "PassStarted",
      buildId: "b1",
      sequenceNumber: 0,
      passId: "discovery",
      passName: "Discovery Pass",
      passIndex: 0,
      totalPasses: 1,
    }));
    expect(received.length).toBe(1);
    expect(received[0].type).toBe("PassStarted");
  });

  test("subscribeAll receives every event", () => {
    const bus = createRuntimeEventBus();
    const all: AnyRuntimeEvent[] = [];
    bus.subscribeAll((e) => all.push(e));
    bus.publish(Object.freeze({ type: "RuntimeStarted", buildId: "b", sequenceNumber: 0, companyId: "c", runtimeVersion: "1.0.0", passCount: 1 }));
    bus.publish(Object.freeze({ type: "RuntimeCompleted", buildId: "b", sequenceNumber: 1, totalPasses: 1, totalArtifacts: 0, totalDurationMs: 1, verificationsPassed: true, certificationsPassed: true }));
    expect(all.length).toBe(2);
  });

  test("events are published synchronously in registration order", () => {
    const bus = createRuntimeEventBus();
    const order: string[] = [];
    bus.subscribeAll(() => order.push("first"));
    bus.subscribeAll(() => order.push("second"));
    bus.publish(Object.freeze({ type: "RuntimeStarted", buildId: "b", sequenceNumber: 0, companyId: "c", runtimeVersion: "1.0.0", passCount: 0 }));
    expect(order).toEqual(["first", "second"]);
  });

  test("history returns immutable snapshot of all events", () => {
    const bus = createRuntimeEventBus();
    bus.publish(Object.freeze({ type: "RuntimeStarted", buildId: "b", sequenceNumber: 0, companyId: "c", runtimeVersion: "1.0.0", passCount: 0 }));
    const hist = bus.history();
    expect(Object.isFrozen(hist)).toBe(true);
    expect(hist.length).toBe(1);
  });

  test("eventCount increments on publish", () => {
    const bus = createRuntimeEventBus();
    expect(bus.eventCount()).toBe(0);
    bus.publish(Object.freeze({ type: "RuntimeStarted", buildId: "b", sequenceNumber: 0, companyId: "c", runtimeVersion: "1.0.0", passCount: 0 }));
    expect(bus.eventCount()).toBe(1);
  });
});

// ─── RuntimeMetrics tests ─────────────────────────────────────────────────────

describe("RuntimeMetrics", () => {
  test("snapshot reflects accumulated counts", () => {
    const m = createRuntimeMetrics();
    m.setTotalPasses(3);
    m.recordPassSucceeded(false);
    m.recordPassSucceeded(true); // cache hit
    m.recordPassFailed();
    m.recordArtifact();
    m.recordArtifact();
    m.recordVerification(true);
    m.recordVerification(false);
    m.recordCertification(true);
    m.recordWarning();
    m.recordError();
    m.setDurationMs(42);

    const snap = m.snapshot();
    expect(snap.passCount).toBe(3);
    expect(snap.passesSucceeded).toBe(2);
    expect(snap.passesFailed).toBe(1);
    expect(snap.cacheHitCount).toBe(1);
    expect(snap.artifactCount).toBe(2);
    expect(snap.verificationCount).toBe(2);
    expect(snap.verificationPassCount).toBe(1);
    expect(snap.verificationFailCount).toBe(1);
    expect(snap.certificationCount).toBe(1);
    expect(snap.certificationPassCount).toBe(1);
    expect(snap.warningCount).toBe(1);
    expect(snap.errorCount).toBe(1);
    expect(snap.executionDurationMs).toBe(42);
  });

  test("successRate is computed correctly", () => {
    const m = createRuntimeMetrics();
    m.recordPassSucceeded(false);
    m.recordPassSucceeded(false);
    m.recordPassFailed();
    const snap = m.snapshot();
    expect(snap.successRate).toBeCloseTo(2 / 3);
  });

  test("cacheHitRate is computed correctly", () => {
    const m = createRuntimeMetrics();
    m.recordPassSucceeded(true);
    m.recordPassSucceeded(false);
    m.recordPassSucceeded(false);
    const snap = m.snapshot();
    expect(snap.cacheHitRate).toBeCloseTo(1 / 3);
  });

  test("snapshot returns frozen object", () => {
    const m = createRuntimeMetrics();
    expect(Object.isFrozen(m.snapshot())).toBe(true);
  });
});

// ─── EnterpriseRuntime — main lifecycle ───────────────────────────────────────

describe("EnterpriseRuntime", () => {
  const buildRuntime = (passes: CompilerPass[]) =>
    createEnterpriseRuntime({
      registeredPasses: passes,
      companyId: "stoner-001",
      workspace: "/workspace",
      compilerVersion: "1.0.0",
    });

  test("initial status is 'created'", () => {
    const rt = buildRuntime([]);
    expect(rt.status()).toBe("created");
  });

  test("version matches RUNTIME_VERSION", () => {
    const rt = buildRuntime([]);
    expect(rt.version).toBe(RUNTIME_VERSION);
  });

  test("context is undefined before execute", () => {
    const rt = buildRuntime([]);
    expect(rt.context()).toBeUndefined();
  });

  test("report and statistics are undefined before execute", () => {
    const rt = buildRuntime([]);
    expect(rt.report()).toBeUndefined();
    expect(rt.statistics()).toBeUndefined();
  });

  test("execute transitions to 'completed' on success", () => {
    const pass = createMockPass("discovery");
    const rt = buildRuntime([pass]);
    const plan = createMockBuildPlan("build-001", ["discovery"]);
    rt.execute(plan);
    expect(rt.status()).toBe("completed");
  });

  test("execute returns immutable ExecutionReport", () => {
    const pass = createMockPass("discovery");
    const rt = buildRuntime([pass]);
    const plan = createMockBuildPlan("build-001", ["discovery"]);
    const report = rt.execute(plan);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
    expect(Object.isFrozen(report.passResults)).toBe(true);
  });

  test("execute sets report and statistics after completion", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(rt.report()).toBeDefined();
    expect(rt.statistics()).toBeDefined();
  });

  test("execute throws if called twice on same instance", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(() => rt.execute(createMockBuildPlan("b2", ["discovery"]))).toThrow(
      /only execute once/,
    );
  });

  test("pass execution ordering matches plan order", () => {
    const order: string[] = [];
    const makeOrderingPass = (id: CompilerPassId, dep?: CompilerPassId): CompilerPass => ({
      ...createMockPass(id, dep ? [dep] : []),
      execute: (_i, _c) => {
        order.push(id);
        return {} as unknown as Promise<Record<string, unknown>>;
      },
    });

    const passes = [
      makeOrderingPass("discovery"),
      makeOrderingPass("evidence", "discovery"),
      makeOrderingPass("genome", "evidence"),
    ];
    const rt = createEnterpriseRuntime({
      registeredPasses: passes,
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
      configuration: { enforcePassDependencies: false },
    });
    rt.execute(createMockBuildPlan("b1", ["discovery", "evidence", "genome"]));
    expect(order).toEqual(["discovery", "evidence", "genome"]);
  });

  test("event publication — RuntimeStarted emitted", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    const events: AnyRuntimeEvent[] = [];
    rt.subscribe((e) => events.push(e));
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const started = events.find((e) => e.type === "RuntimeStarted");
    expect(started).toBeDefined();
  });

  test("event publication — RuntimeCompleted emitted on success", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    const events: AnyRuntimeEvent[] = [];
    rt.subscribe((e) => events.push(e));
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const completed = events.find((e) => e.type === "RuntimeCompleted");
    expect(completed).toBeDefined();
  });

  test("event publication — PassStarted and PassCompleted emitted per pass", () => {
    const rt = buildRuntime([createMockPass("discovery"), createMockPass("evidence")]);
    const events: AnyRuntimeEvent[] = [];
    rt.subscribe((e) => events.push(e));
    rt.execute(createMockBuildPlan("b1", ["discovery", "evidence"]));
    const passStarted = events.filter((e) => e.type === "PassStarted");
    const passCompleted = events.filter((e) => e.type === "PassCompleted");
    expect(passStarted.length).toBe(2);
    expect(passCompleted.length).toBe(2);
  });

  test("events() returns immutable history", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const ev = rt.events();
    expect(Object.isFrozen(ev)).toBe(true);
    expect(ev.length).toBeGreaterThan(0);
  });

  test("artifacts are registered when pass produces outputs", () => {
    const pass = createMockPass("discovery", [], { document: { id: "doc-001" } });
    const rt = buildRuntime([pass]);
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(report.artifacts.length).toBe(1);
    expect(report.artifacts[0].producerPassId).toBe("discovery");
    expect(report.artifacts[0].type).toBe("document");
  });

  test("artifact checksums are deterministic", () => {
    const outputs = { document: { id: "doc-001", name: "Test" } };
    const pass = createMockPass("discovery", [], outputs);

    const rt1 = buildRuntime([pass]);
    const rt2 = buildRuntime([pass]);
    const plan = createMockBuildPlan("same-build", ["discovery"], 1_000_000);

    const rep1 = rt1.execute(plan);
    const rep2 = rt2.execute(plan);

    expect(rep1.artifacts[0].checksum).toBe(rep2.artifacts[0].checksum);
  });

  test("execution report checksums map matches artifacts", () => {
    const pass = createMockPass("discovery", [], { document: { id: "x" } });
    const rt = buildRuntime([pass]);
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    for (const artifact of report.artifacts) {
      expect(report.artifactChecksums.get(artifact.artifactId)).toBe(artifact.checksum);
    }
  });

  test("metrics collected correctly in report", () => {
    const passes = [
      createMockPass("discovery"),
      createMockPass("evidence"),
    ];
    const rt = buildRuntime(passes);
    const report = rt.execute(createMockBuildPlan("b1", ["discovery", "evidence"]));
    expect(report.metrics.passCount).toBe(2);
    expect(report.metrics.passesSucceeded).toBe(2);
    expect(report.metrics.passesFailed).toBe(0);
  });

  test("failure handling — failing pass produces failed report", () => {
    const rt = buildRuntime([createFailingPass("discovery")]);
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(report.summary.successful).toBe(false);
    expect(report.summary.passesFailed).toBe(1);
    expect(rt.status()).toBe("failed");
  });

  test("failure handling — RuntimeFailed event emitted", () => {
    const rt = buildRuntime([createFailingPass("discovery")]);
    const events: AnyRuntimeEvent[] = [];
    rt.subscribe((e) => events.push(e));
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const failed = events.find((e) => e.type === "RuntimeFailed");
    expect(failed).toBeDefined();
  });

  test("unknown pass in plan produces failed result for that pass", () => {
    const rt = buildRuntime([]); // no passes registered
    const report = rt.execute(createMockBuildPlan("b1", ["discovery" as CompilerPassId]));
    expect(report.summary.passesFailed).toBe(1);
    expect(report.passResults[0].errors[0]).toMatch(/not registered/i);
  });

  test("stopOnFirstFailure — halts after first failure", () => {
    const executedPasses: string[] = [];
    const makePass = (id: CompilerPassId, fail: boolean): CompilerPass => ({
      ...createMockPass(id),
      execute: () => {
        executedPasses.push(id);
        if (fail) throw new Error(`${id} failed`);
        return {} as unknown as Promise<Record<string, unknown>>;
      },
    });
    const rt = createEnterpriseRuntime({
      registeredPasses: [makePass("discovery", true), makePass("evidence", false)],
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
      configuration: { stopOnFirstFailure: true },
    });
    rt.execute(createMockBuildPlan("b1", ["discovery", "evidence"]));
    expect(executedPasses).toEqual(["discovery"]);
    expect(rt.status()).toBe("failed");
  });

  test("cancellation before execute — status becomes 'cancelled'", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    rt.cancel("test cancellation");
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(rt.status()).toBe("cancelled");
    expect(report.summary.successful).toBe(false);
  });

  test("cancellation — RuntimeCancelled event emitted", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    const events: AnyRuntimeEvent[] = [];
    rt.subscribe((e) => events.push(e));
    rt.cancel("user request");
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const cancelled = events.find((e) => e.type === "RuntimeCancelled");
    expect(cancelled).toBeDefined();
  });

  test("cancel on completed runtime is no-op", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(rt.status()).toBe("completed");
    rt.cancel("too late");
    expect(rt.status()).toBe("completed"); // unchanged
  });

  test("status transitions follow correct sequence", () => {
    const rt = buildRuntime([createMockPass("discovery")]);
    const statuses: string[] = [];
    rt.subscribe((e) => {
      if (e.type === "StatusChanged") statuses.push(e.to);
    });
    rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(statuses).toEqual(["preparing", "executing", "verifying", "certifying", "completed"]);
  });

  test("execution report is deterministic — identical plans produce identical structure", () => {
    const pass = createMockPass("discovery", [], { document: { id: "d1" } });
    const plan = createMockBuildPlan("same-id", ["discovery"], 1_000_000);

    const rt1 = createEnterpriseRuntime({
      registeredPasses: [pass],
      companyId: "co",
      workspace: "/w",
      compilerVersion: "1.0.0",
    });
    const rt2 = createEnterpriseRuntime({
      registeredPasses: [pass],
      companyId: "co",
      workspace: "/w",
      compilerVersion: "1.0.0",
    });

    const r1 = rt1.execute(plan);
    const r2 = rt2.execute(plan);

    expect(r1.buildId).toBe(r2.buildId);
    expect(r1.summary.passesSucceeded).toBe(r2.summary.passesSucceeded);
    expect(r1.artifacts.length).toBe(r2.artifacts.length);
    expect(r1.artifacts[0]?.checksum).toBe(r2.artifacts[0]?.checksum);
  });

  test("pipeline execution — multiple passes all complete", () => {
    const passes = [
      createMockPass("discovery"),
      createMockPass("evidence"),
      createMockPass("genome"),
      createMockPass("blueprint"),
    ];
    const rt = createEnterpriseRuntime({
      registeredPasses: passes,
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
      configuration: { enforcePassDependencies: false },
    });
    const plan = createMockBuildPlan("b1", ["discovery", "evidence", "genome", "blueprint"]);
    const report = rt.execute(plan);
    expect(report.summary.passesExecuted).toBe(4);
    expect(report.summary.passesSucceeded).toBe(4);
    expect(report.summary.passesFailed).toBe(0);
  });
});

// ─── RuntimeStatistics tests ──────────────────────────────────────────────────

describe("RuntimeStatistics", () => {
  test("computeRuntimeStatistics produces isFullSuccess true on clean run", () => {
    const rt = createEnterpriseRuntime({
      registeredPasses: [createMockPass("discovery")],
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
    });
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const stats = computeRuntimeStatistics(report);
    expect(stats.isFullSuccess).toBe(true);
    expect(stats.failedPasses).toBe(0);
  });

  test("computeRuntimeStatistics produces isFullSuccess false on failure", () => {
    const rt = createEnterpriseRuntime({
      registeredPasses: [createFailingPass("discovery")],
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
    });
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    const stats = computeRuntimeStatistics(report);
    expect(stats.isFullSuccess).toBe(false);
    expect(stats.failedPasses).toBeGreaterThan(0);
  });

  test("computeRuntimeStatistics returns frozen object", () => {
    const rt = createEnterpriseRuntime({
      registeredPasses: [createMockPass("discovery")],
      companyId: "c",
      workspace: "/w",
      compilerVersion: "1.0.0",
    });
    const report = rt.execute(createMockBuildPlan("b1", ["discovery"]));
    expect(Object.isFrozen(computeRuntimeStatistics(report))).toBe(true);
  });
});

// ─── PassExecutor + RuntimePipeline isolated tests ───────────────────────────

describe("PassExecutor", () => {
  const cfg = createRuntimeConfiguration({ enforcePassDependencies: false });

  test("executePass produces immutable PassExecutionRecord", () => {
    const executor = createPassExecutor();
    const bus = createRuntimeEventBus();
    const metrics = createRuntimeMetrics();
    const registry = createArtifactRegistry();
    const ctx = createExecutionContext({
      buildId: "b1",
      companyId: "c",
      workspace: "/w",
      environment: "test",
      compilerVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      requestedTargets: [],
      startTime: 0,
      configuration: cfg,
    });
    const pass = createMockPass("discovery");
    const record = executor.executePass(pass, 0, 1, new Set(), ctx, registry, bus, metrics);
    expect(Object.isFrozen(record)).toBe(true);
    expect(record.passId).toBe("discovery");
  });

  test("executePass records outputs in artifact registry", () => {
    const executor = createPassExecutor();
    const bus = createRuntimeEventBus();
    const metrics = createRuntimeMetrics();
    const registry = createArtifactRegistry();
    const ctx = createExecutionContext({
      buildId: "b1",
      companyId: "c",
      workspace: "/w",
      environment: "test",
      compilerVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      requestedTargets: [],
      startTime: 0,
      configuration: cfg,
    });
    const pass = createMockPass("discovery", [], { document: { id: "d1" } });
    executor.executePass(pass, 0, 1, new Set(), ctx, registry, bus, metrics);
    expect(registry.count()).toBe(1);
  });
});
