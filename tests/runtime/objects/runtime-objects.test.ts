import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import { RuntimeExecutionContext, RuntimeServiceManager } from "../../../src/runtime/services";
import {
  RuntimeObjectFactory,
  RuntimeObjectManager,
  RuntimePermissionEvaluator,
  RuntimeRelationshipEngine,
  RuntimeBehaviorRegistry,
  RuntimeObjectStateMachine,
  RuntimeObjectRegistry,
  type RuntimeObjectDescriptor,
} from "../../../src/runtime/objects";

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
      id: "runtime-objects-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-objects-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function descriptor(
  descriptorId: string,
  classification = "Customer",
  extras?: Partial<RuntimeObjectDescriptor>,
): RuntimeObjectDescriptor {
  return {
    descriptorId,
    classification,
    version: "1.0.0",
    metadata: { domain: "enterprise", tier: 1 },
    initialState: { status: "new", score: 0 },
    behaviorRefs: ["behavior.activate", "behavior.archive"],
    capabilityRefs: ["capability.activate", "capability.archive"],
    relationshipRefs: [],
    ...extras,
  };
}

function createManager(runtimeInstanceId = "runtime-instance-obj-001", runtimeId = "runtime-id-obj-001"): RuntimeObjectManager {
  return new RuntimeObjectManager(runtimeInstanceId, runtimeId);
}

function configureDispatch(manager: RuntimeObjectManager, classification = "Customer"): void {
  manager.registerCapability({
    capabilityId: "capability.activate",
    action: "activate",
    resourcePattern: "*",
    allowedStates: ["Ready", "Suspended"],
    requiredPermissions: ["perm.activate"],
  });

  manager.registerCapability({
    capabilityId: "capability.archive",
    action: "archive",
    resourcePattern: "*",
    allowedStates: ["Active", "Suspended", "Failed", "Ready", "Materialized", "Initialized"],
    requiredPermissions: ["perm.archive"],
  });

  manager.registerBehavior({
    behaviorId: "behavior.activate",
    capabilityId: "capability.activate",
    objectClassification: classification,
    version: "1.0.0",
  }, (object) => ({
    output: { activated: true },
    nextState: { ...object.state, status: "active" },
    nextLifecycleState: "Active",
    health: "healthy",
  }));

  manager.registerBehavior({
    behaviorId: "behavior.archive",
    capabilityId: "capability.archive",
    objectClassification: classification,
    version: "1.0.0",
  }, (object) => ({
    output: { archived: true },
    nextState: { ...object.state, status: "archived" },
    nextLifecycleState: "Archived",
    health: "healthy",
  }));
}

test("1 deterministic identity stable for same descriptor", () => {
  const factory = new RuntimeObjectFactory();
  const a = factory.identityFor(descriptor("d-1"));
  const b = factory.identityFor(descriptor("d-1"));
  assert.equal(a, b);
});

test("2 deterministic identity differs for different descriptor", () => {
  const factory = new RuntimeObjectFactory();
  assert.notEqual(factory.identityFor(descriptor("d-1")), factory.identityFor(descriptor("d-2")));
});

test("3 descriptor validation requires descriptorId", () => {
  const factory = new RuntimeObjectFactory();
  assert.throws(() => factory.create(descriptor("", "Customer")), /GRT-OBJ-FACTORY-001/);
});

test("4 descriptor validation requires classification", () => {
  const factory = new RuntimeObjectFactory();
  assert.throws(() => factory.create(descriptor("d-1", "")), /GRT-OBJ-FACTORY-002/);
});

test("5 descriptor validation requires version", () => {
  const factory = new RuntimeObjectFactory();
  assert.throws(() => factory.create(descriptor("d-1", "Customer", { version: "" })), /GRT-OBJ-FACTORY-003/);
});

test("6 registry rejects duplicate object registration", () => {
  const registry = new RuntimeObjectRegistry();
  registry.register(descriptor("d-1"));
  assert.throws(() => registry.register(descriptor("d-1")), /GRT-OBJ-REG-001/);
});

test("7 registry ordering deterministic by objectId", () => {
  const registry = new RuntimeObjectRegistry();
  registry.register(descriptor("d-z"));
  registry.register(descriptor("d-a"));
  const ids = registry.list().map((entry) => entry.objectId);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted);
});

test("8 state machine allows canonical transitions", () => {
  const sm = new RuntimeObjectStateMachine();
  assert.equal(sm.canTransition("Declared", "Materialized"), true);
  assert.equal(sm.canTransition("Materialized", "Initialized"), true);
  assert.equal(sm.canTransition("Initialized", "Ready"), true);
  assert.equal(sm.canTransition("Ready", "Active"), true);
  assert.equal(sm.canTransition("Active", "Suspended"), true);
  assert.equal(sm.canTransition("Suspended", "Archived"), true);
});

test("9 state machine rejects invalid transition", () => {
  const sm = new RuntimeObjectStateMachine();
  assert.throws(() => sm.transition("Declared", "Active", "obj-1"), /GRT-OBJ-STATE-001/);
});

test("10 manager registers object as Materialized", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  assert.equal(obj.lifecycleState, "Materialized");
});

test("11 manager initialize transitions to Initialized", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  assert.equal(manager.initializeObject(obj.objectId).lifecycleState, "Initialized");
});

test("12 manager ready transitions to Ready", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  assert.equal(manager.readyObject(obj.objectId).lifecycleState, "Ready");
});

test("13 manager activate transitions to Active", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  assert.equal(manager.activateObject(obj.objectId).lifecycleState, "Active");
});

test("14 manager suspend transitions to Suspended", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  manager.activateObject(obj.objectId);
  assert.equal(manager.suspendObject(obj.objectId).lifecycleState, "Suspended");
});

test("15 manager archive transitions to Archived", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  manager.activateObject(obj.objectId);
  assert.equal(manager.archiveObject(obj.objectId).lifecycleState, "Archived");
});

test("16 manager fail transitions to Failed", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  const failed = manager.failObject(obj.objectId, "simulated");
  assert.equal(failed.lifecycleState, "Failed");
  assert.equal(failed.lastFailure, "simulated");
});

test("17 invalid lifecycle transition is rejected by manager", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  assert.throws(() => manager.activateObject(obj.objectId), /GRT-OBJ-STATE-001/);
});

test("18 object metadata is immutable", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  assert.equal(Object.isFrozen(obj.metadata), true);
});

test("19 object state is immutable", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("d-1"));
  assert.equal(Object.isFrozen(obj.state), true);
});

test("20 relationship engine adds deterministic edge id", () => {
  const engine = new RuntimeRelationshipEngine();
  const edge = engine.addRelationship("a", "owns", "b", { role: "primary" });
  assert.equal(edge.relationshipId.startsWith("relationship-"), true);
});

test("21 relationship engine rejects duplicate edge", () => {
  const engine = new RuntimeRelationshipEngine();
  engine.addRelationship("a", "owns", "b", { role: "primary" });
  assert.throws(() => engine.addRelationship("a", "owns", "b", { role: "primary" }), /GRT-OBJ-REL-002/);
});

test("22 relationship engine validates object existence via hook", () => {
  const engine = new RuntimeRelationshipEngine();
  assert.throws(() => engine.addRelationship("a", "owns", "b", {}, () => false), /GRT-OBJ-REL-001/);
});

test("23 relationship ordering deterministic", () => {
  const engine = new RuntimeRelationshipEngine();
  engine.addRelationship("obj-c", "links", "obj-d");
  engine.addRelationship("obj-a", "links", "obj-b");
  const edges = engine.list();
  const sorted = [...edges].sort((a, b) => `${a.sourceObjectId}|${a.relationshipType}|${a.targetObjectId}`.localeCompare(`${b.sourceObjectId}|${b.relationshipType}|${b.targetObjectId}`));
  assert.deepEqual(edges, sorted);
});

test("24 relationship attributes immutable", () => {
  const edge = new RuntimeRelationshipEngine().addRelationship("a", "links", "b", { secure: true });
  assert.equal(Object.isFrozen(edge.attributes), true);
});

test("25 behavior registry requires capability before behavior", () => {
  const registry = new RuntimeBehaviorRegistry();
  assert.throws(() => {
    registry.registerBehavior({
      behaviorId: "b-1",
      capabilityId: "cap-1",
      objectClassification: "Customer",
      version: "1.0.0",
    }, () => ({ output: {} }));
  }, /GRT-OBJ-BEH-002/);
});

test("26 capability duplicate rejection", () => {
  const registry = new RuntimeBehaviorRegistry();
  registry.registerCapability({ capabilityId: "cap-1", action: "act", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: ["p"] });
  assert.throws(() => registry.registerCapability({ capabilityId: "cap-1", action: "act", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: ["p"] }), /GRT-OBJ-BEH-001/);
});

test("27 behavior duplicate rejection", () => {
  const registry = new RuntimeBehaviorRegistry();
  registry.registerCapability({ capabilityId: "cap-1", action: "act", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: ["p"] });
  const descriptorValue = { behaviorId: "b-1", capabilityId: "cap-1", objectClassification: "Customer", version: "1.0.0" };
  registry.registerBehavior(descriptorValue, () => ({ output: {} }));
  assert.throws(() => registry.registerBehavior(descriptorValue, () => ({ output: {} })), /GRT-OBJ-BEH-003/);
});

test("28 behavior resolve by capability and classification", () => {
  const registry = new RuntimeBehaviorRegistry();
  registry.registerCapability({ capabilityId: "cap-1", action: "act", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: ["p"] });
  registry.registerBehavior({ behaviorId: "b-1", capabilityId: "cap-1", objectClassification: "Customer", version: "1.0.0" }, () => ({ output: {} }));
  const resolved = registry.resolveBehavior("cap-1", "Customer");
  assert.equal(resolved.descriptor.behaviorId, "b-1");
});

test("29 permission evaluator deterministic allow", () => {
  const evaluator = new RuntimePermissionEvaluator();
  evaluator.registerRule({ ruleId: "r-allow", principal: "alice", action: "activate", resource: "*", effect: "allow" });
  const result = evaluator.evaluate({ principal: "alice", action: "activate", resource: "obj-1" });
  assert.equal(result.granted, true);
});

test("30 permission evaluator deny overrides allow", () => {
  const evaluator = new RuntimePermissionEvaluator();
  evaluator.registerRule({ ruleId: "r-allow", principal: "alice", action: "activate", resource: "*", effect: "allow" });
  evaluator.registerRule({ ruleId: "r-deny", principal: "alice", action: "activate", resource: "obj-1", effect: "deny" });
  const result = evaluator.evaluate({ principal: "alice", action: "activate", resource: "obj-1" });
  assert.equal(result.granted, false);
  assert.equal(result.denyRuleIds.includes("r-deny"), true);
});

test("31 permission evaluator respects constraints", () => {
  const evaluator = new RuntimePermissionEvaluator();
  evaluator.registerRule({ ruleId: "r-allow", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate" } });
  const granted = evaluator.evaluate({ principal: "alice", action: "activate", resource: "obj-1", constraints: { capabilityId: "capability.activate" } });
  const denied = evaluator.evaluate({ principal: "alice", action: "activate", resource: "obj-1", constraints: { capabilityId: "capability.archive" } });
  assert.equal(granted.granted, true);
  assert.equal(denied.granted, false);
});

test("32 manager dispatch success path", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);

  manager.registerPermission({ ruleId: "allow-activate", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate", classification: "Customer" } });

  const result = manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, true);
  assert.equal(manager.getObject(obj.objectId).lifecycleState, "Active");
});

test("33 manager dispatch denied by permission", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);

  const result = manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, false);
  assert.equal(result.permissionGranted, false);
});

test("34 manager dispatch denied by lifecycle", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.registerPermission({ ruleId: "allow-activate", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate", classification: "Customer" } });

  const result = manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, false);
  assert.equal(result.diagnosticsCode, "GRT-OBJ-DISPATCH-002");
});

test("35 manager dispatch archive capability transitions to Archived", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  manager.registerPermission({ ruleId: "allow-archive", principal: "alice", action: "archive", resource: "*", effect: "allow", constraints: { capabilityId: "capability.archive", classification: "Customer" } });

  const result = manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.archive", payload: {} });
  assert.equal(result.success, true);
  assert.equal(manager.getObject(obj.objectId).lifecycleState, "Archived");
});

test("36 manager dispatch records evidence", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  manager.registerPermission({ ruleId: "allow-activate", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate", classification: "Customer" } });
  manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });

  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "DispatchSucceeded"), true);
});

test("37 manager dispatch updates telemetry counters", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.initializeObject(obj.objectId);
  manager.readyObject(obj.objectId);
  manager.registerPermission({ ruleId: "allow-activate", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate", classification: "Customer" } });
  manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });

  const counters = manager.snapshot().telemetry.counters;
  assert.equal((counters["object.dispatch.success"] ?? 0) > 0, true);
});

test("38 manager dispatch failure updates diagnostics", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  const result = manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, false);
  assert.equal(manager.snapshot().diagnostics.length > 0, true);
});

test("39 add relationship validates object existence", () => {
  const manager = createManager();
  const a = manager.registerObject(descriptor("a"));
  assert.throws(() => manager.addRelationship(a.objectId, "links", "missing"), /GRT-OBJ-REL-001/);
});

test("40 add relationship updates relationship refs", () => {
  const manager = createManager();
  const a = manager.registerObject(descriptor("a"));
  const b = manager.registerObject(descriptor("b"));
  manager.addRelationship(a.objectId, "links", b.objectId, { role: "peer" });
  assert.equal(manager.getObject(a.objectId).relationshipRefs.length, 1);
});

test("41 relationship count appears in snapshot metrics", () => {
  const manager = createManager();
  const a = manager.registerObject(descriptor("a"));
  const b = manager.registerObject(descriptor("b"));
  manager.addRelationship(a.objectId, "links", b.objectId);
  assert.equal(manager.snapshot().telemetry.metrics.relationshipCount, 1);
});

test("42 snapshot is deep frozen", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  const snap = manager.snapshot();
  assert.equal(Object.isFrozen(snap), true);
  assert.equal(Object.isFrozen(snap.objects), true);
  assert.equal(Object.isFrozen(snap.relationships), true);
});

test("43 snapshot object ordering deterministic", () => {
  const manager = createManager();
  manager.registerObject(descriptor("z"));
  manager.registerObject(descriptor("a"));
  const ids = manager.snapshot().objects.map((entry) => entry.objectId);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted);
});

test("44 evidence sequence monotonic", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  manager.persistSnapshot();
  const sequences = manager.snapshot().evidence.map((entry) => entry.sequence);
  const sorted = [...sequences].sort((a, b) => a - b);
  assert.deepEqual(sequences, sorted);
});

test("45 diagnostics sequence monotonic", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("a"));
  manager.failObject(obj.objectId, "boom");
  const sequences = manager.snapshot().diagnostics.map((entry) => entry.sequence);
  const sorted = [...sequences].sort((a, b) => a - b);
  assert.deepEqual(sequences, sorted);
});

test("46 persist snapshot starts at revision 1", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  assert.equal(manager.persistSnapshot().revision, 1);
});

test("47 persist snapshot increments revision deterministically", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  assert.equal(manager.persistSnapshot().revision, 1);
  assert.equal(manager.persistSnapshot().revision, 2);
});

test("48 restore latest snapshot returns highest revision", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  manager.persistSnapshot();
  manager.persistSnapshot();
  assert.equal(manager.restoreLatestSnapshot().revision, 2);
});

test("49 restore without snapshots is rejected", () => {
  const manager = createManager();
  assert.throws(() => manager.restoreLatestSnapshot(), /GRT-OBJ-SNAPSHOT-001/);
});

test("50 snapshot history immutable ordering", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  manager.persistSnapshot();
  manager.persistSnapshot();
  const history = manager.snapshotHistory();
  assert.deepEqual(history.map((entry) => entry.revision), [1, 2]);
  assert.equal(Object.isFrozen(history), true);
});

test("51 factory determinism for evolved object", () => {
  const factory = new RuntimeObjectFactory();
  const base = factory.create(descriptor("d-1")).snapshot();
  const a = factory.evolve(base, { state: { status: "x" } }).snapshot();
  const b = factory.evolve(base, { state: { status: "x" } }).snapshot();
  assert.deepEqual(a.state, b.state);
});

test("52 execution context integration via fromExecutionContext", () => {
  const context = new RuntimeExecutionContext("runtime-instance-ctx-1", "runtime-id-ctx-1");
  const manager = RuntimeObjectManager.fromExecutionContext(context);
  assert.equal(manager.runtimeInstanceId, "runtime-instance-ctx-1");
  assert.equal(manager.runtimeId, "runtime-id-ctx-1");
});

test("53 multi-runtime isolation separate managers", () => {
  const a = createManager("runtime-instance-a", "runtime-id-shared");
  const b = createManager("runtime-instance-b", "runtime-id-shared");
  a.registerObject(descriptor("obj"));
  b.registerObject(descriptor("obj"));
  assert.equal(a.listObjects().length, 1);
  assert.equal(b.listObjects().length, 1);
  assert.notDeepEqual(a.snapshot().runtimeInstanceId, b.snapshot().runtimeInstanceId);
});

test("54 identical descriptors across instances remain isolated", () => {
  const a = createManager("runtime-instance-a", "runtime-id-shared");
  const b = createManager("runtime-instance-b", "runtime-id-shared");
  const objA = a.registerObject(descriptor("same"));
  const objB = b.registerObject(descriptor("same"));
  assert.equal(objA.objectId, objB.objectId);
  a.initializeObject(objA.objectId);
  assert.equal(a.getObject(objA.objectId).lifecycleState, "Initialized");
  assert.equal(b.getObject(objB.objectId).lifecycleState, "Materialized");
});

test("55 repeated-run determinism snapshot equivalence", () => {
  const run = (): ReturnType<RuntimeObjectManager["snapshot"]> => {
    const m = createManager("runtime-instance-det", "runtime-id-det");
    configureDispatch(m);
    const obj = m.registerObject(descriptor("det-1"));
    m.initializeObject(obj.objectId);
    m.readyObject(obj.objectId);
    m.registerPermission({ ruleId: "allow", principal: "alice", action: "activate", resource: "*", effect: "allow", constraints: { capabilityId: "capability.activate", classification: "Customer" } });
    m.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
    return m.snapshot();
  };

  const first = run();
  const second = run();
  assert.deepEqual(first.objects, second.objects);
  assert.deepEqual(first.relationships, second.relationships);
  assert.deepEqual(first.telemetry.metrics, second.telemetry.metrics);
});

test("56 behavior registry capability ordering deterministic", () => {
  const manager = createManager();
  manager.registerCapability({ capabilityId: "cap-z", action: "z", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: [] });
  manager.registerCapability({ capabilityId: "cap-a", action: "a", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: [] });
  const ids = manager.snapshot().capabilities.map((entry) => entry.capabilityId);
  assert.deepEqual(ids, ["cap-a", "cap-z"]);
});

test("57 behavior registry behavior ordering deterministic", () => {
  const manager = createManager();
  manager.registerCapability({ capabilityId: "cap-a", action: "a", resourcePattern: "*", allowedStates: ["Ready"], requiredPermissions: [] });
  manager.registerBehavior({ behaviorId: "b-z", capabilityId: "cap-a", objectClassification: "Customer", version: "1" }, () => ({ output: {} }));
  manager.registerBehavior({ behaviorId: "b-a", capabilityId: "cap-a", objectClassification: "Customer", version: "1" }, () => ({ output: {} }));
  const ids = manager.snapshot().behaviors.map((entry) => entry.behaviorId);
  assert.deepEqual(ids, ["b-a", "b-z"]);
});

test("58 capability dispatch does not expose direct object methods", () => {
  const manager = createManager();
  const obj = manager.registerObject(descriptor("a"));
  assert.equal(typeof (obj as unknown as { activate?: unknown }).activate, "undefined");
});

test("59 no regression to GRT-0001 runtime kernel", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().runtimeState, "Running");
});

test("60 no regression to GRT-0002 enterprise host", async () => {
  const host = new EnterpriseHost({
    hostId: "host-obj-regression",
    version: "1.0.0",
    defaultEnvironmentId: "prod",
    defaultProfileId: "standard",
  });
  host.bootstrap(
    { id: "prod", displayName: "Production", region: "us-east-1", variables: { STAGE: "prod" } },
    { id: "standard", displayName: "Standard", limits: { cpu: 4, memoryGb: 16 }, featureFlags: { orchestration: true } },
  );

  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);
  const stopped = host.deactivateRuntime(instanceId);
  assert.equal(stopped.state, "Stopped");
});

test("61 no regression to GRT-0003 runtime services", () => {
  const serviceManager = new RuntimeServiceManager();
  const context = serviceManager.createExecutionContext("runtime-instance-svc-1", "runtime-id-svc-1");
  serviceManager.registerServices(context.runtimeInstanceId, [
    { id: "svc-a", version: "1.0.0", dependencies: [] },
    { id: "svc-b", version: "1.0.0", dependencies: ["svc-a"] },
  ]);
  serviceManager.resolveServices(context.runtimeInstanceId);
  serviceManager.activateServices(context.runtimeInstanceId);
  assert.equal(serviceManager.snapshot(context.runtimeInstanceId).state, "Running");
});

test("62 dispatch failure increments failure metric", () => {
  const manager = createManager();
  configureDispatch(manager);
  const obj = manager.registerObject(descriptor("d-1"));
  manager.dispatch({ principal: "alice", objectId: obj.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(manager.snapshot().telemetry.metrics.dispatchFailureCount > 0, true);
});

test("63 relationship additions are append-only", () => {
  const manager = createManager();
  const a = manager.registerObject(descriptor("a"));
  const b = manager.registerObject(descriptor("b"));
  manager.addRelationship(a.objectId, "links", b.objectId);
  const first = manager.snapshot().relationships.length;
  manager.addRelationship(a.objectId, "depends-on", b.objectId);
  const second = manager.snapshot().relationships.length;
  assert.equal(second > first, true);
});

test("64 snapshot serializable and deterministic key presence", () => {
  const manager = createManager();
  manager.registerObject(descriptor("a"));
  const raw = JSON.stringify(manager.snapshot());
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(typeof parsed.runtimeInstanceId, "string");
  assert.equal(Array.isArray(parsed.objects), true);
  assert.equal(Array.isArray(parsed.relationships), true);
});
