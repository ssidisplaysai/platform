import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import {
  RuntimeExecutionContext,
  RuntimeServiceDependencyGraph,
  RuntimeServiceManager,
  RuntimeServiceRegistry,
  RuntimeServiceStateMachine,
  type RuntimeServiceDescriptor,
} from "../../../src/runtime/services";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

let cachedRuntimeIR: EnterpriseRuntimeIR | undefined;

async function getRuntimeIR(): Promise<EnterpriseRuntimeIR> {
  if (cachedRuntimeIR) {
    return cachedRuntimeIR;
  }

  const core = new CompilerCore();
  const result = await core.compile({
    source: {
      id: "runtime-services-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-services-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function createHost(): EnterpriseHost {
  const host = new EnterpriseHost({
    hostId: "genesis-host-003",
    version: "1.0.0",
    defaultEnvironmentId: "prod",
    defaultProfileId: "standard",
  });

  host.bootstrap(
    { id: "prod", displayName: "Production", region: "us-east-1", variables: { STAGE: "prod" } },
    { id: "standard", displayName: "Standard", limits: { cpu: 4, memoryGb: 16 }, featureFlags: { orchestration: true } },
  );

  return host;
}

function descriptor(
  id: string,
  dependencies: readonly string[] = [],
  options?: { failOnActivate?: boolean; metadata?: Readonly<Record<string, string | number | boolean>> },
): RuntimeServiceDescriptor {
  return {
    id,
    version: "1.0.0",
    dependencies,
    failOnActivate: options?.failOnActivate,
    metadata: options?.metadata,
  };
}

function createResolvedContext(runtimeInstanceId = "runtime-instance-0100", runtimeId = "runtime-id-0100"): RuntimeExecutionContext {
  const context = new RuntimeExecutionContext(runtimeInstanceId, runtimeId);
  context.registerServices([
    descriptor("svc-a"),
    descriptor("svc-b", ["svc-a"]),
    descriptor("svc-c", ["svc-b"]),
  ]);
  context.resolveServices();
  return context;
}

test("1 descriptor validation rejects empty id", () => {
  const registry = new RuntimeServiceRegistry();
  assert.throws(() => registry.register({ id: "", version: "1.0.0", dependencies: [] }), /GRT-SVC-REG-003/);
});

test("2 descriptor validation rejects empty version", () => {
  const registry = new RuntimeServiceRegistry();
  assert.throws(() => registry.register({ id: "svc", version: "", dependencies: [] }), /GRT-SVC-REG-004/);
});

test("3 descriptor validation rejects self dependency", () => {
  const registry = new RuntimeServiceRegistry();
  assert.throws(() => registry.register({ id: "svc", version: "1.0.0", dependencies: ["svc"] }), /GRT-SVC-REG-005/);
});

test("4 descriptor validation rejects duplicate dependencies", () => {
  const registry = new RuntimeServiceRegistry();
  assert.throws(() => registry.register({ id: "svc", version: "1.0.0", dependencies: ["a", "a"] }), /GRT-SVC-REG-006/);
});

test("5 deterministic service identity is stable", () => {
  const registry = new RuntimeServiceRegistry();
  registry.register(descriptor("svc-stable", ["svc-dep"], { metadata: { region: "us-east-1" } }));
  const first = registry.identityFor("svc-stable");
  const second = registry.identityFor("svc-stable");
  assert.equal(first, second);
});

test("6 deterministic service identity changes when descriptor changes", () => {
  const first = new RuntimeServiceRegistry();
  first.register({ id: "svc", version: "1.0.0", dependencies: [] });

  const second = new RuntimeServiceRegistry();
  second.register({ id: "svc", version: "1.0.1", dependencies: [] });

  assert.notEqual(first.identityFor("svc"), second.identityFor("svc"));
});

test("7 registry ordering is deterministic", () => {
  const registry = new RuntimeServiceRegistry();
  registry.register(descriptor("svc-c"));
  registry.register(descriptor("svc-a"));
  registry.register(descriptor("svc-b"));
  assert.deepEqual(registry.list().map((entry) => entry.id), ["svc-a", "svc-b", "svc-c"]);
});

test("8 duplicate registration rejection", () => {
  const registry = new RuntimeServiceRegistry();
  registry.register(descriptor("svc"));
  assert.throws(() => registry.register(descriptor("svc")), /GRT-SVC-REG-001/);
});

test("9 missing dependency rejection", () => {
  const graph = new RuntimeServiceDependencyGraph();
  assert.throws(() => graph.build([descriptor("svc-a", ["svc-missing"])]), /GRT-SVC-GRAPH-001/);
});

test("10 dependency cycle detection two nodes", () => {
  const graph = new RuntimeServiceDependencyGraph();
  assert.throws(() => graph.build([descriptor("svc-a", ["svc-b"]), descriptor("svc-b", ["svc-a"])]), /GRT-SVC-GRAPH-002/);
});

test("11 dependency cycle detection three nodes", () => {
  const graph = new RuntimeServiceDependencyGraph();
  assert.throws(
    () => graph.build([descriptor("svc-a", ["svc-b"]), descriptor("svc-b", ["svc-c"]), descriptor("svc-c", ["svc-a"])]),
    /GRT-SVC-GRAPH-002/,
  );
});

test("12 stable topological ordering linear", () => {
  const graph = new RuntimeServiceDependencyGraph().build([
    descriptor("svc-c", ["svc-b"]),
    descriptor("svc-a"),
    descriptor("svc-b", ["svc-a"]),
  ]);
  assert.deepEqual(graph.activationOrder, ["svc-a", "svc-b", "svc-c"]);
});

test("13 stable topological ordering branch", () => {
  const graph = new RuntimeServiceDependencyGraph().build([
    descriptor("svc-z", ["svc-root"]),
    descriptor("svc-a", ["svc-root"]),
    descriptor("svc-root"),
  ]);
  assert.deepEqual(graph.activationOrder, ["svc-root", "svc-a", "svc-z"]);
});

test("14 shutdown ordering is reverse of activation constraints", () => {
  const graph = new RuntimeServiceDependencyGraph().build([
    descriptor("svc-c", ["svc-b"]),
    descriptor("svc-a"),
    descriptor("svc-b", ["svc-a"]),
  ]);
  assert.deepEqual(graph.shutdownOrder, ["svc-c", "svc-b", "svc-a"]);
});

test("15 execution context is keyed by runtime instance id", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0001", "runtime-id-0001");
  assert.equal(context.snapshot().runtimeInstanceId, "runtime-instance-0001");
});

test("16 duplicate execution context creation is rejected", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-0001", "runtime-id-0001");
  assert.throws(() => manager.createExecutionContext("runtime-instance-0001", "runtime-id-0001"), /GRT-SVC-MANAGER-001/);
});

test("17 context registration and resolve transitions", () => {
  const context = createResolvedContext();
  assert.equal(context.stateValue(), "Resolved");
});

test("18 invalid lifecycle transition activate before resolve", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0002", "runtime-id-0002");
  context.registerServices([descriptor("svc-a")]);
  assert.throws(() => context.activateServices(), /GRT-SVC-CTX-003/);
});

test("19 activation order follows dependency graph", () => {
  const context = createResolvedContext();
  const outcome = context.activateServices();
  assert.deepEqual(outcome.activated, ["svc-a", "svc-b", "svc-c"]);
});

test("20 dependent-service blocking when dependency fails", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0003", "runtime-id-0003");
  context.registerServices([
    descriptor("svc-a", [], { failOnActivate: true }),
    descriptor("svc-b", ["svc-a"]),
  ]);
  context.resolveServices();
  const outcome = context.activateServices();
  assert.deepEqual(outcome.failed, ["svc-a"]);
  assert.deepEqual(outcome.blocked, ["svc-b"]);
});

test("21 service failure isolation keeps independent service active", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0004", "runtime-id-0004");
  context.registerServices([
    descriptor("svc-fail", [], { failOnActivate: true }),
    descriptor("svc-independent"),
  ]);
  context.resolveServices();
  const outcome = context.activateServices();
  assert.equal(outcome.activated.includes("svc-independent"), true);
  assert.equal(outcome.failed.includes("svc-fail"), true);
});

test("22 deterministic shutdown uses reverse activation constraints", () => {
  const context = createResolvedContext();
  context.activateServices();
  const shutdown = context.shutdownServices();
  assert.deepEqual(shutdown, ["svc-c", "svc-b", "svc-a"]);
});

test("23 invalid shutdown transition from created context", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0005", "runtime-id-0005");
  assert.throws(() => context.shutdownServices(), /GRT-SVC-CTX-004/);
});

test("24 telemetry updates during lifecycle", () => {
  const context = createResolvedContext();
  context.activateServices();
  context.shutdownServices();
  const counters = context.snapshot().telemetry.counters;
  assert.equal((counters["service.registered"] ?? 0) > 0, true);
  assert.equal((counters["service.resolved"] ?? 0) > 0, true);
  assert.equal((counters["service.activated"] ?? 0) > 0, true);
  assert.equal((counters["service.stopped"] ?? 0) > 0, true);
});

test("25 health reporting is healthy for active services", () => {
  const context = createResolvedContext();
  context.activateServices();
  const health = context.snapshot().services.map((entry) => entry.health);
  assert.equal(health.every((value) => value === "healthy"), true);
});

test("26 health reporting degrades blocked services", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0006", "runtime-id-0006");
  context.registerServices([
    descriptor("svc-fail", [], { failOnActivate: true }),
    descriptor("svc-blocked", ["svc-fail"]),
  ]);
  context.resolveServices();
  context.activateServices();
  const blocked = context.snapshot().services.find((entry) => entry.descriptor.id === "svc-blocked");
  assert.equal(blocked?.health, "degraded");
});

test("27 append-only evidence has monotonic sequences", () => {
  const context = createResolvedContext();
  context.activateServices();
  const evidence = context.snapshot().evidence.map((entry) => entry.sequence);
  const sorted = [...evidence].sort((a, b) => a - b);
  assert.deepEqual(evidence, sorted);
});

test("28 diagnostics capture activation failure", () => {
  const context = new RuntimeExecutionContext("runtime-instance-0007", "runtime-id-0007");
  context.registerServices([descriptor("svc-fail", [], { failOnActivate: true })]);
  context.resolveServices();
  context.activateServices();
  assert.equal(context.snapshot().diagnostics.some((entry) => entry.code === "GRT-SVC-ACT-002"), true);
});

test("29 snapshot is immutable", () => {
  const context = createResolvedContext();
  const snapshot = context.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
});

test("30 snapshot service records are immutable", () => {
  const context = createResolvedContext();
  const snapshot = context.snapshot();
  assert.equal(Object.isFrozen(snapshot.services), true);
});

test("31 snapshot evidence is immutable", () => {
  const context = createResolvedContext();
  const snapshot = context.snapshot();
  assert.equal(Object.isFrozen(snapshot.evidence), true);
});

test("32 snapshot telemetry is immutable", () => {
  const context = createResolvedContext();
  const snapshot = context.snapshot();
  assert.equal(Object.isFrozen(snapshot.telemetry), true);
});

test("33 execution context identity is deterministic", () => {
  const first = createResolvedContext("runtime-instance-a", "runtime-id-common");
  const second = createResolvedContext("runtime-instance-b", "runtime-id-common");
  assert.equal(first.snapshot().logicalContextId, second.snapshot().logicalContextId);
});

test("34 logical identity independent of registration order", () => {
  const first = new RuntimeExecutionContext("runtime-instance-a1", "runtime-id-common");
  first.registerServices([descriptor("svc-a"), descriptor("svc-b", ["svc-a"]) ]);

  const second = new RuntimeExecutionContext("runtime-instance-a2", "runtime-id-common");
  second.registerServices([descriptor("svc-b", ["svc-a"]), descriptor("svc-a")]);

  assert.equal(first.snapshot().logicalContextId, second.snapshot().logicalContextId);
});

test("35 repeated-run determinism for logical snapshot fields", () => {
  const first = createResolvedContext("runtime-instance-r1", "runtime-id-r");
  first.activateServices();
  first.shutdownServices();
  const firstSnapshot = first.snapshot();

  const second = createResolvedContext("runtime-instance-r2", "runtime-id-r");
  second.activateServices();
  second.shutdownServices();
  const secondSnapshot = second.snapshot();

  assert.equal(firstSnapshot.logicalContextId, secondSnapshot.logicalContextId);
  assert.deepEqual(firstSnapshot.dependencyGraph, secondSnapshot.dependencyGraph);
  assert.deepEqual(firstSnapshot.services.map((entry) => entry.descriptor.id), secondSnapshot.services.map((entry) => entry.descriptor.id));
});

test("36 multi-runtime isolation keeps independent snapshots", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-1001", "runtime-id-1001");
  manager.createExecutionContext("runtime-instance-1002", "runtime-id-1002");

  manager.registerServices("runtime-instance-1001", [descriptor("svc-a")]);
  manager.resolveServices("runtime-instance-1001");

  manager.registerServices("runtime-instance-1002", [descriptor("svc-b")]);
  manager.resolveServices("runtime-instance-1002");

  assert.deepEqual(manager.snapshot("runtime-instance-1001").services.map((entry) => entry.descriptor.id), ["svc-a"]);
  assert.deepEqual(manager.snapshot("runtime-instance-1002").services.map((entry) => entry.descriptor.id), ["svc-b"]);
});

test("37 identical services across runtime instances have no shared mutable state", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-2001", "runtime-id-shared");
  manager.createExecutionContext("runtime-instance-2002", "runtime-id-shared");

  const descriptors = [descriptor("svc-a"), descriptor("svc-b", ["svc-a"])];
  manager.registerServices("runtime-instance-2001", descriptors);
  manager.resolveServices("runtime-instance-2001");
  manager.activateServices("runtime-instance-2001");

  manager.registerServices("runtime-instance-2002", descriptors);
  manager.resolveServices("runtime-instance-2002");

  assert.equal(manager.snapshot("runtime-instance-2001").state, "Running");
  assert.equal(manager.snapshot("runtime-instance-2002").state, "Resolved");
});

test("38 modifying one runtime context does not alter another", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-3001", "runtime-id-shared");
  manager.createExecutionContext("runtime-instance-3002", "runtime-id-shared");

  manager.registerServices("runtime-instance-3001", [descriptor("svc-a")]);
  manager.resolveServices("runtime-instance-3001");
  manager.activateServices("runtime-instance-3001");

  manager.registerServices("runtime-instance-3002", [descriptor("svc-a")]);
  manager.resolveServices("runtime-instance-3002");

  assert.equal(manager.snapshot("runtime-instance-3001").telemetry.metrics.activeServiceCount, 1);
  assert.equal(manager.snapshot("runtime-instance-3002").telemetry.metrics.activeServiceCount, 0);
});

test("39 snapshotAll returns contexts sorted by runtime instance id", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-5002", "runtime-id-5002");
  manager.createExecutionContext("runtime-instance-5001", "runtime-id-5001");

  const ids = manager.snapshotAll().map((entry) => entry.runtimeInstanceId);
  assert.deepEqual(ids, ["runtime-instance-5001", "runtime-instance-5002"]);
});

test("40 persisting snapshot starts at revision 1", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-6001", "runtime-id-6001");
  manager.registerServices("runtime-instance-6001", [descriptor("svc-a")]);
  manager.resolveServices("runtime-instance-6001");
  const record = manager.persistSnapshot("runtime-instance-6001");
  assert.equal(record.revision, 1);
});

test("41 persisting snapshot increments revision deterministically", () => {
  const manager = new RuntimeServiceManager();
  manager.createExecutionContext("runtime-instance-6002", "runtime-id-6002");
  manager.registerServices("runtime-instance-6002", [descriptor("svc-a")]);
  manager.resolveServices("runtime-instance-6002");
  assert.equal(manager.persistSnapshot("runtime-instance-6002").revision, 1);
  assert.equal(manager.persistSnapshot("runtime-instance-6002").revision, 2);
});

test("42 restore missing snapshot is rejected", () => {
  const manager = new RuntimeServiceManager();
  assert.throws(() => manager.restoreLatest("runtime-instance-missing"), /GRT-SVC-SNAPSHOT-001/);
});

test("43 manager rejects unknown context operations", () => {
  const manager = new RuntimeServiceManager();
  assert.throws(() => manager.snapshot("runtime-instance-missing"), /GRT-SVC-MANAGER-003/);
});

test("44 state machine rejects invalid transition deterministically", () => {
  const machine = new RuntimeServiceStateMachine("Registered");
  assert.throws(() => machine.transition("Active", "svc-a"), /GRT-SVC-STATE-001/);
});

test("45 state machine supports legal transition path", () => {
  const machine = new RuntimeServiceStateMachine("Registered");
  machine.transition("Resolving", "svc-a");
  machine.transition("Resolved", "svc-a");
  machine.transition("Activating", "svc-a");
  machine.transition("Active", "svc-a");
  machine.transition("Deactivating", "svc-a");
  machine.transition("Stopped", "svc-a");
  assert.equal(machine.current(), "Stopped");
});

test("46 EnterpriseHost integration attaches to hosted runtime", async () => {
  const host = createHost();
  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);

  const manager = new RuntimeServiceManager();
  const context = manager.attachToHostRuntime(host, instanceId);

  assert.equal(context.runtimeInstanceId, instanceId);
  assert.equal(context.runtimeId.length > 0, true);
});

test("47 EnterpriseHost integration rejects unknown runtime instance", () => {
  const host = createHost();
  const manager = new RuntimeServiceManager();
  assert.throws(() => manager.attachToHostRuntime(host, "runtime-instance-missing"), /GRT-SVC-MANAGER-002/);
});

test("48 service layer does not alter EnterpriseHost runtime lifecycle semantics", async () => {
  const host = createHost();
  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);
  const before = host.snapshot();

  const manager = new RuntimeServiceManager();
  manager.attachToHostRuntime(host, instanceId);
  manager.registerServices(instanceId, [descriptor("svc-a")]);
  manager.resolveServices(instanceId);
  manager.activateServices(instanceId);

  const after = host.snapshot();
  assert.equal(after.runtimes[0].state, "Running");
  assert.equal(after.events.length, before.events.length);
  assert.equal(after.telemetry.metrics.hostedRuntimeCount, before.telemetry.metrics.hostedRuntimeCount);
});

test("49 no regression: RuntimeKernel still boots to Running", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().runtimeState, "Running");
});

test("50 no regression: EnterpriseHost activation/deactivation path still works", async () => {
  const host = createHost();
  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);
  const stopped = host.deactivateRuntime(instanceId);
  assert.equal(stopped.state, "Stopped");
});
