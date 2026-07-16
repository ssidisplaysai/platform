import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import {
  RuntimeExecutionContext,
  type RuntimeServiceDescriptor,
} from "../../../src/runtime/services";
import {
  RuntimeObjectManager,
  type RuntimeObjectDescriptor,
} from "../../../src/runtime/objects";
import {
  RuntimeMessagingManager,
  type RuntimeEnvelopeSnapshot,
} from "../../../src/runtime/messaging";
import {
  RuntimeSchedulingManager,
  type RuntimeScheduleDescriptor,
} from "../../../src/runtime/scheduling";
import {
  RuntimeActivityGraph,
  RuntimeCompensationEngine,
  RuntimeExecutionIntent,
  RuntimeProcess,
  RuntimeTransitionEngine,
  RuntimeWaitingStateStore,
  RuntimeWorkflowDiagnostics,
  RuntimeWorkflowEvidence,
  RuntimeWorkflowFactory,
  RuntimeWorkflowManager,
  RuntimeWorkflowSnapshotStore,
  RuntimeWorkflowTelemetry,
  deepFreeze,
  stableSerialize,
  type RuntimeActivityDescriptor,
  type RuntimeTransitionDescriptor,
  type RuntimeWaitingPolicyDescriptor,
  type RuntimeWorkflowDescriptor,
} from "../../../src/runtime/workflows";

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
      id: "runtime-workflow-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-workflow-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function serviceDescriptor(id: string, dependencies: readonly string[] = []): RuntimeServiceDescriptor {
  return { id, version: "1.0.0", dependencies };
}

function createExecutionContext(runtimeInstanceId = "runtime-instance-wf-001", runtimeId = "runtime-id-wf-001"): RuntimeExecutionContext {
  const context = new RuntimeExecutionContext(runtimeInstanceId, runtimeId);
  context.registerServices([
    serviceDescriptor("svc-core"),
    serviceDescriptor("svc-orchestrator", ["svc-core"]),
  ]);
  context.resolveServices();
  context.activateServices();
  return context;
}

function objectDescriptor(descriptorId: string, classification = "Customer"): RuntimeObjectDescriptor {
  return {
    descriptorId,
    classification,
    version: "1.0.0",
    metadata: { domain: "enterprise", tier: 1 },
    initialState: { status: "new" },
    behaviorRefs: ["behavior.activate"],
    capabilityRefs: ["capability.activate"],
    relationshipRefs: [],
  };
}

function configureObjectDispatch(manager: RuntimeObjectManager): void {
  manager.registerCapability({
    capabilityId: "capability.activate",
    action: "activate",
    resourcePattern: "*",
    allowedStates: ["Ready"],
    requiredPermissions: ["perm.activate"],
  });

  manager.registerBehavior({
    behaviorId: "behavior.activate",
    capabilityId: "capability.activate",
    objectClassification: "Customer",
    version: "1.0.0",
  }, (object) => ({
    output: { activated: true },
    nextState: { ...object.state, status: "active" },
    nextLifecycleState: "Active",
    health: "healthy",
  }));

  manager.registerPermission({
    ruleId: "allow-activate",
    principal: "alice",
    action: "activate",
    resource: "*",
    effect: "allow",
    constraints: { capabilityId: "capability.activate", classification: "Customer" },
  });
}

function createMessagingManager(runtimeInstanceId = "runtime-instance-wf-001", runtimeId = "runtime-id-wf-001"): RuntimeMessagingManager {
  const messaging = new RuntimeMessagingManager(runtimeInstanceId, runtimeId);
  messaging.registerChannel({ channel: "system", description: "System" });
  messaging.registerChannel({ channel: "workflow", description: "Workflow" });
  messaging.registerChannel({ channel: "approvals", description: "Approvals" });
  messaging.registerTopic({ channel: "system", topic: "customer.activate" });
  messaging.registerTopic({ channel: "workflow", topic: "workflow.completed" });
  messaging.registerTopic({ channel: "workflow", topic: "workflow.resume" });
  messaging.registerTopic({ channel: "approvals", topic: "approval.received" });
  return messaging;
}

function createSchedulingManager(runtimeInstanceId = "runtime-instance-wf-001", runtimeId = "runtime-id-wf-001"): RuntimeSchedulingManager {
  return new RuntimeSchedulingManager(runtimeInstanceId, runtimeId);
}

function activity(
  activityId: string,
  overrides: Partial<RuntimeActivityDescriptor> = {},
): RuntimeActivityDescriptor {
  return {
    activityId,
    activityType: "CommandIntent",
    targetKind: "RuntimeObject",
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    input: { objectId: "customer-001", capabilityId: "capability.activate", messageType: "approved" },
    expectedOutcomes: ["approved"],
    transitionIds: [],
    metadata: { priority: 5, lane: "main" },
    version: "1.0.0",
    ...overrides,
  };
}

function transition(
  transitionId: string,
  fromActivityId: string,
  toActivityId: string,
  overrides: Partial<RuntimeTransitionDescriptor> = {},
): RuntimeTransitionDescriptor {
  return {
    transitionId,
    fromActivityId,
    toActivityId,
    triggerType: "ActivityCompleted",
    priority: 10,
    metadata: {},
    ...overrides,
  };
}

function waitingPolicy(
  overrides: Partial<RuntimeWaitingPolicyDescriptor> = {},
): RuntimeWaitingPolicyDescriptor {
  return {
    waitingReason: "await-approval",
    observationType: "RuntimeEvent",
    expectedEnvelopeType: "Event",
    expectedChannel: "approvals",
    expectedTopic: "approval.received",
    expectedMessageType: "approved",
    resumePolicy: "CompleteActivity",
    metadata: { lane: "approval" },
    ...overrides,
  };
}

function workflowDescriptor(overrides: Partial<RuntimeWorkflowDescriptor> = {}): RuntimeWorkflowDescriptor {
  const activities = overrides.activities ?? [
    activity("activity-a", { transitionIds: ["transition-a-b"] }),
    activity("activity-b", { transitionIds: [], targetId: "customer-002" }),
  ];
  const entryActivityIds = overrides.entryActivityIds ?? (activities[0] ? [activities[0].activityId] : []);
  const exitActivityIds = overrides.exitActivityIds ?? (activities[activities.length - 1] ? [activities[activities.length - 1].activityId] : []);
  const transitions = overrides.transitions ?? (activities.length >= 2
    ? [transition("transition-a-b", activities[0].activityId, activities[1].activityId)]
    : []);
  return {
    processType: "RuntimeWorkflow",
    name: "CustomerActivation",
    version: "1.0.0",
    entryActivityIds,
    exitActivityIds,
    activities,
    transitions,
    waitingDefinitions: overrides.waitingDefinitions ?? [],
    compensationDefinitions: overrides.compensationDefinitions ?? [],
    metadata: { domain: "customer", tier: 1 },
    schemaVersion: "1.0.0",
    ...overrides,
  };
}

function workflowHash(manager: RuntimeWorkflowManager): string {
  return createHash("sha256").update(stableSerialize(manager.snapshot())).digest("hex");
}

function createManager(runtimeInstanceId = "runtime-instance-wf-001", runtimeId = "runtime-id-wf-001"): RuntimeWorkflowManager {
  return new RuntimeWorkflowManager(runtimeInstanceId, runtimeId);
}

function registerDefaultWorkflow(manager: RuntimeWorkflowManager, overrides: Partial<RuntimeWorkflowDescriptor> = {}) {
  return manager.registerWorkflow(workflowDescriptor(overrides));
}

function materializeStarted(manager: RuntimeWorkflowManager, overrides: Partial<RuntimeWorkflowDescriptor> = {}) {
  const workflow = registerDefaultWorkflow(manager, overrides);
  const instance = manager.materializeWorkflow(workflow.workflowId, {
    correlationId: "corr-001",
    causationId: "cause-001",
    startCause: { requestId: "request-001" },
    metadata: { operator: "alice" },
  });
  manager.startWorkflow(instance.workflowInstanceId);
  return { workflow, instance: manager.instance(instance.workflowInstanceId) };
}

function publishApprovalEvent(manager: RuntimeMessagingManager, correlationId = "corr-001", causationId = "cause-001"): RuntimeEnvelopeSnapshot {
  return manager.publish({
    channel: "approvals",
    topic: "approval.received",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-approval",
    payload: { messageType: "approved", approver: "alice" },
    correlationId,
    causationId,
    schemaVersion: "1.0.0",
    metadata: { lane: "approval" },
  }).envelope;
}

test("1 RuntimeProcess snapshot is immutable", () => {
  const process = new RuntimeProcess(deepFreeze({
    processId: "process-001",
    processType: "RuntimeWorkflow",
    name: "Process",
    version: "1.0.0",
    schemaVersion: "1.0.0",
    metadata: { lane: "main" },
  }));
  assert.equal(Object.isFrozen(process.snapshot()), true);
});

test("2 RuntimeWorkflow snapshot is immutable", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor());
  assert.equal(Object.isFrozen(workflow.snapshot()), true);
});

test("3 RuntimeWorkflow retains process metadata", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor()).snapshot();
  assert.equal(workflow.processType, "RuntimeWorkflow");
});

test("4 deterministic workflow identity is stable", () => {
  const factory = new RuntimeWorkflowFactory();
  assert.equal(factory.workflowIdentityFor(workflowDescriptor()), factory.workflowIdentityFor(workflowDescriptor()));
});

test("5 deterministic workflow identity changes when descriptor changes", () => {
  const factory = new RuntimeWorkflowFactory();
  assert.notEqual(
    factory.workflowIdentityFor(workflowDescriptor()),
    factory.workflowIdentityFor(workflowDescriptor({ name: "Changed" })),
  );
});

test("6 deterministic workflow instance identity is stable", () => {
  const factory = new RuntimeWorkflowFactory();
  const workflow = factory.create(workflowDescriptor()).snapshot();
  assert.equal(
    factory.workflowInstanceIdentityFor("runtime-1", workflow.workflowId, { correlationId: "c1", startCause: { requestId: "r1" } }),
    factory.workflowInstanceIdentityFor("runtime-1", workflow.workflowId, { correlationId: "c1", startCause: { requestId: "r1" } }),
  );
});

test("7 deterministic workflow instance identity changes when start cause changes", () => {
  const factory = new RuntimeWorkflowFactory();
  const workflow = factory.create(workflowDescriptor()).snapshot();
  assert.notEqual(
    factory.workflowInstanceIdentityFor("runtime-1", workflow.workflowId, { correlationId: "c1", startCause: { requestId: "r1" } }),
    factory.workflowInstanceIdentityFor("runtime-1", workflow.workflowId, { correlationId: "c1", startCause: { requestId: "r2" } }),
  );
});

test("8 deterministic activity identity is stable", () => {
  const factory = new RuntimeWorkflowFactory();
  const descriptor = (({ activityId: _activityId, ...rest }) => rest)(activity("activity-derived"));
  assert.equal(
    factory.activityIdentityFor("workflow-001", descriptor),
    factory.activityIdentityFor("workflow-001", descriptor),
  );
});

test("9 deterministic activity identity changes when descriptor changes", () => {
  const factory = new RuntimeWorkflowFactory();
  const descriptorA = (({ activityId: _activityId, ...rest }) => rest)(activity("activity-derived"));
  const descriptorB = (({ activityId: _activityId, ...rest }) => rest)(activity("activity-derived", { targetId: "customer-999" }));
  assert.notEqual(
    factory.activityIdentityFor("workflow-001", descriptorA),
    factory.activityIdentityFor("workflow-001", descriptorB),
  );
});

test("10 deterministic execution intent identity is stable", () => {
  const a = RuntimeExecutionIntent.identityFor({
    workflowId: "workflow-001",
    workflowInstanceId: "workflow-instance-001",
    activityId: "activity-001",
    runtimeInstanceId: "runtime-001",
    runtimeId: "runtime-id-001",
    targetKind: "RuntimeObject",
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    payload: { customerId: "customer-001" },
    priority: 1,
    executionConstraints: { scheduleType: "Immediate" },
    correlationId: "corr-1",
    causationId: "cause-1",
    attempt: 1,
    metadata: { lane: "main" },
    schemaVersion: "1.0.0",
  }, 1);
  const b = RuntimeExecutionIntent.identityFor({
    workflowId: "workflow-001",
    workflowInstanceId: "workflow-instance-001",
    activityId: "activity-001",
    runtimeInstanceId: "runtime-001",
    runtimeId: "runtime-id-001",
    targetKind: "RuntimeObject",
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    payload: { customerId: "customer-001" },
    priority: 1,
    executionConstraints: { scheduleType: "Immediate" },
    correlationId: "corr-1",
    causationId: "cause-1",
    attempt: 1,
    metadata: { lane: "main" },
    schemaVersion: "1.0.0",
  }, 1);
  assert.equal(a, b);
});

test("11 deterministic execution intent identity changes when ordinal changes", () => {
  const base = {
    workflowId: "workflow-001",
    workflowInstanceId: "workflow-instance-001",
    activityId: "activity-001",
    runtimeInstanceId: "runtime-001",
    runtimeId: "runtime-id-001",
    targetKind: "RuntimeObject" as const,
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    payload: { customerId: "customer-001" },
    priority: 1,
    executionConstraints: { scheduleType: "Immediate" as const },
    correlationId: "corr-1",
    causationId: "cause-1",
    attempt: 1,
    metadata: { lane: "main" },
    schemaVersion: "1.0.0",
  };
  assert.notEqual(RuntimeExecutionIntent.identityFor(base, 1), RuntimeExecutionIntent.identityFor(base, 2));
});

for (const [name, descriptor, pattern] of [
  ["12 workflow validation requires processType", { ...workflowDescriptor(), processType: "Other" }, /GRT-WF-FACTORY-001/],
  ["13 workflow validation requires name", { ...workflowDescriptor(), name: "" }, /GRT-WF-FACTORY-002/],
  ["14 workflow validation requires version", { ...workflowDescriptor(), version: "" }, /GRT-WF-FACTORY-003/],
  ["15 workflow validation requires schemaVersion", { ...workflowDescriptor(), schemaVersion: "" }, /GRT-WF-FACTORY-004/],
  ["16 workflow validation requires activities", { ...workflowDescriptor(), activities: [] }, /GRT-WF-FACTORY-005/],
  ["17 workflow validation requires activityId", workflowDescriptor({ activities: [activity("", {})] }), /GRT-WF-FACTORY-006/],
  ["18 workflow validation requires targetId", workflowDescriptor({ activities: [activity("activity-a", { targetId: "" })] }), /GRT-WF-FACTORY-007/],
  ["19 workflow validation requires targetCapability", workflowDescriptor({ activities: [activity("activity-a", { targetCapability: "" })] }), /GRT-WF-FACTORY-008/],
  ["20 workflow validation requires commandChannel", workflowDescriptor({ activities: [activity("activity-a", { commandChannel: "" })] }), /GRT-WF-FACTORY-009/],
  ["21 workflow validation requires commandTopic", workflowDescriptor({ activities: [activity("activity-a", { commandTopic: "" })] }), /GRT-WF-FACTORY-010/],
  ["22 workflow validation requires activity version", workflowDescriptor({ activities: [activity("activity-a", { version: "" })] }), /GRT-WF-FACTORY-011/],
] as const) {
  test(name, () => {
    const factory = new RuntimeWorkflowFactory();
    assert.throws(() => factory.create(descriptor as RuntimeWorkflowDescriptor), pattern as RegExp);
  });
}

test("23 duplicate workflow rejection is enforced", () => {
  const manager = createManager();
  const descriptor = workflowDescriptor();
  manager.registerWorkflow(descriptor);
  assert.throws(() => manager.registerWorkflow(descriptor), /GRT-WF-MANAGER-001/);
});

test("24 duplicate activity rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [activity("activity-a"), activity("activity-a")],
    transitions: [],
    exitActivityIds: ["activity-a"],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-001/);
});

test("25 missing transition rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [activity("activity-a", { transitionIds: ["missing"] })],
    transitions: [],
    exitActivityIds: ["activity-a"],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-003/);
});

test("26 missing waiting activity rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    waitingDefinitions: [{ activityId: "missing", waitingReason: "wait", resumePolicy: "CompleteActivity" }],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-004/);
});

test("27 invalid compensation definition rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    compensationDefinitions: [{ activityId: "activity-a", compensationActivityId: "missing", trigger: "OnFailure" }],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-005/);
});

test("28 missing entry activity rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({ entryActivityIds: ["missing"] })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-006/);
});

test("29 missing exit activity rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({ exitActivityIds: ["missing"] })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-007/);
});

test("30 activity graph ordering is deterministic", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [activity("activity-z"), activity("activity-a")],
    entryActivityIds: ["activity-a"],
    exitActivityIds: ["activity-z"],
    transitions: [transition("transition-a-z", "activity-a", "activity-z")],
  })).snapshot();
  const graph = new RuntimeActivityGraph(workflow).snapshot();
  assert.deepEqual(graph.activities.map((entry) => entry.activityId), ["activity-a", "activity-z"]);
});

test("31 activity graph edge ordering is deterministic", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [activity("activity-a", { transitionIds: ["t2", "t1"] }), activity("activity-b"), activity("activity-c")],
    transitions: [transition("t2", "activity-a", "activity-c"), transition("t1", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b", "activity-c"],
  })).snapshot();
  const graph = new RuntimeActivityGraph(workflow).snapshot();
  assert.deepEqual(graph.edges.map((entry) => `${entry.fromActivityId}:${entry.transitionId}:${entry.toActivityId}`), [
    "activity-a:t1:activity-b",
    "activity-a:t2:activity-c",
  ]);
});

test("32 invalid graph edge rejection is enforced", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    transitions: [transition("transition-a-x", "activity-a", "activity-x")],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(workflow), /GRT-WF-GRAPH-002/);
});

test("33 prohibited cycle detection is enforced", () => {
  const cyclical = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [
      activity("activity-a", { transitionIds: ["transition-a-b"] }),
      activity("activity-b", { transitionIds: ["transition-b-a"] }),
    ],
    transitions: [
      transition("transition-a-b", "activity-a", "activity-b"),
      transition("transition-b-a", "activity-b", "activity-a"),
    ],
    exitActivityIds: ["activity-b"],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(cyclical), /GRT-WF-GRAPH-010/);
});

test("34 unreachable activity detection is enforced", () => {
  const unreachable = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [
      activity("activity-a", { transitionIds: [] }),
      activity("activity-b", { transitionIds: [] }),
    ],
    transitions: [],
    exitActivityIds: ["activity-a", "activity-b"],
  })).snapshot();
  assert.throws(() => new RuntimeActivityGraph(unreachable), /GRT-WF-GRAPH-009/);
});

test("35 activity eligibility begins with entry nodes", () => {
  const manager = createManager();
  const { workflow, instance } = materializeStarted(manager);
  const eligible = manager.graph(workflow.workflowId).eligibleActivities(instance);
  assert.deepEqual(eligible.map((entry) => entry.activityId), ["activity-a"]);
});

test("36 downstream activity becomes eligible after predecessor completion", () => {
  const manager = createManager();
  const { workflow, instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-a");
  const eligible = manager.graph(workflow.workflowId).eligibleActivities(manager.instance(instance.workflowInstanceId));
  assert.deepEqual(eligible.map((entry) => entry.activityId), ["activity-b"]);
});

test("37 deterministic transition ordering uses priority then transitionId", () => {
  const engine = new RuntimeTransitionEngine();
  const ordered = engine.orderTransitions([
    transition("transition-b", "activity-a", "activity-c", { priority: 2 }),
    transition("transition-a", "activity-a", "activity-b", { priority: 2 }),
    transition("transition-c", "activity-a", "activity-d", { priority: 1 }),
  ].map((entry) => new RuntimeWorkflowFactory().create(workflowDescriptor({ transitions: [entry], activities: [activity("activity-a"), activity(entry.toActivityId)], exitActivityIds: [entry.toActivityId] })).snapshot().transitions[0]));
  assert.deepEqual(ordered.map((entry) => entry.transitionId), ["transition-c", "transition-a", "transition-b"]);
});

test("38 transition guard evaluates payload equality deterministically", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved", guardDescriptor: { type: "payloadEquals", key: "messageType", value: "approved" } })],
  })).snapshot();
  const graph = new RuntimeActivityGraph(workflow);
  const applied = new RuntimeTransitionEngine().evaluate(graph.snapshot(), "activity-a", graph.transitionsFrom("activity-a"), {
    observationId: "observation-001",
    workflowInstanceId: "workflow-instance-001",
    observationType: "Envelope",
    triggerType: "WaitingObserved",
    payload: { messageType: "approved" },
    metadata: {},
  });
  assert.deepEqual(applied.transitionIds, ["transition-a-b"]);
});

test("39 transition guard evaluates metadata equality deterministically", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved", guardDescriptor: { type: "metadataEquals", key: "lane", value: "approval" } })],
  })).snapshot();
  const graph = new RuntimeActivityGraph(workflow);
  const applied = new RuntimeTransitionEngine().evaluate(graph.snapshot(), "activity-a", graph.transitionsFrom("activity-a"), {
    observationId: "observation-001",
    workflowInstanceId: "workflow-instance-001",
    observationType: "Envelope",
    triggerType: "WaitingObserved",
    metadata: { lane: "approval" },
  });
  assert.deepEqual(applied.transitionIds, ["transition-a-b"]);
});

test("40 workflow lifecycle starts through ready into running", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager);
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", startCause: { requestId: "r1" } });
  const started = manager.startWorkflow(instance.workflowInstanceId);
  assert.equal(started.state, "Running");
});

test("41 invalid lifecycle transitions fail deterministically", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager);
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", startCause: { requestId: "r1" } });
  assert.throws(() => manager.transitionWorkflow(instance.workflowInstanceId, "Completed"), /GRT-WF-LIFECYCLE-002/);
});

test("42 runEligibleActivities creates deterministic execution intents", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  const result = manager.runEligibleActivities(instance.workflowInstanceId);
  assert.equal(result.createdIntents.length, 1);
});

test("43 created execution intents are immutable", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  const result = manager.runEligibleActivities(instance.workflowInstanceId);
  assert.equal(Object.isFrozen(result.createdIntents[0]), true);
});

test("44 scheduler integration creates schedule and plan", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const { instance } = materializeStarted(manager);
  const result = manager.runEligibleActivities(instance.workflowInstanceId, scheduling, undefined, { currentSequence: 1 });
  assert.equal(scheduling.listSchedules().length, 1);
  assert.equal(result.linkedPlans.length, 1);
});

test("45 runtime plan linkage is retained on workflow instance", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId, scheduling, undefined, { currentSequence: 1 });
  assert.equal(manager.instance(instance.workflowInstanceId).runtimePlanReferences.length, 1);
});

test("46 messaging integration publishes scheduler-owned commands", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const { instance } = materializeStarted(manager);
  const result = manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  assert.equal(result.publishedMessages[0].envelope.publisherKind, "Scheduler");
});

test("47 workflow does not publish commands directly", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  assert.equal(messaging.listMessages()[0].envelope.publisherKind, "Scheduler");
});

test("48 workflow does not execute runtime objects directly", () => {
  const manager = createManager();
  const objectManager = new RuntimeObjectManager("runtime-instance-wf-001", "runtime-id-wf-001");
  configureObjectDispatch(objectManager);
  const objectRecord = objectManager.registerObject(objectDescriptor("customer"));
  objectManager.initializeObject(objectRecord.objectId);
  objectManager.readyObject(objectRecord.objectId);
  const before = objectManager.getObject(objectRecord.objectId);
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const after = objectManager.getObject(objectRecord.objectId);
  assert.equal(before.lifecycleState, after.lifecycleState);
});

test("49 workflow does not execute runtime services directly", () => {
  const context = createExecutionContext();
  const manager = RuntimeWorkflowManager.fromExecutionContext(context);
  const before = context.snapshot();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const after = context.snapshot();
  assert.equal(before.services[0].state, after.services[0].state);
});

test("50 event-driven waiting state is entered deterministically", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  assert.equal(manager.instance(instance.workflowInstanceId).waitingStateIds.length, 1);
});

test("51 event-driven waiting state resumes on matching event", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const envelope = publishApprovalEvent(messaging);
  manager.observeEnvelope(instance.workflowInstanceId, envelope);
  assert.equal(manager.instance(instance.workflowInstanceId).completedActivityIds.includes("activity-a"), true);
});

test("52 reply-driven waiting state resumes on matching reply", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy({ observationType: "RuntimeReply", expectedEnvelopeType: "Reply" }), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved", expectedEnvelopeType: "Reply" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const envelope = messaging.publish({
    channel: "approvals",
    topic: "approval.received",
    envelopeType: "Reply",
    publisherKind: "RuntimeService",
    publisherId: "svc-approval",
    payload: { messageType: "approved" },
    correlationId: "corr-001",
    causationId: "cause-001",
    schemaVersion: "1.0.0",
    metadata: { lane: "approval" },
  }).envelope;
  manager.observeEnvelope(instance.workflowInstanceId, envelope);
  assert.equal(manager.instance(instance.workflowInstanceId).completedActivityIds.includes("activity-a"), true);
});

test("53 scheduler-outcome waiting state resumes on publication result", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy({ observationType: "SchedulerPublicationResult", expectedEnvelopeType: "Command", expectedChannel: "system", expectedTopic: "customer.activate" }), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "SchedulerPublished", expectedEnvelopeType: "Command" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  assert.equal(manager.instance(instance.workflowInstanceId).completedActivityIds.includes("activity-a"), true);
});

test("54 correlation matching is enforced for waiting states", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const envelope = publishApprovalEvent(messaging, "corr-other", "cause-001");
  manager.observeEnvelope(instance.workflowInstanceId, envelope);
  assert.equal(manager.instance(instance.workflowInstanceId).waitingStateIds.length, 1);
});

test("55 causation matching is enforced for waiting states", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const envelope = publishApprovalEvent(messaging, "corr-001", "cause-other");
  manager.observeEnvelope(instance.workflowInstanceId, envelope);
  assert.equal(manager.instance(instance.workflowInstanceId).waitingStateIds.length, 1);
});

test("56 deterministic waiting-state identifiers are stable", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const firstWaitingId = manager.instance(instance.workflowInstanceId).waitingStateIds[0];
  const secondManager = createManager();
  const secondWorkflow = registerDefaultWorkflow(secondManager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const secondInstance = secondManager.materializeWorkflow(secondWorkflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  secondManager.startWorkflow(secondInstance.workflowInstanceId);
  secondManager.runEligibleActivities(secondInstance.workflowInstanceId);
  assert.equal(firstWaitingId, secondManager.instance(secondInstance.workflowInstanceId).waitingStateIds[0]);
});

test("57 waiting resume policy failActivity fails deterministically", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy({ resumePolicy: "FailActivity" }), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "ActivityFailed" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.observeEnvelope(instance.workflowInstanceId, publishApprovalEvent(messaging));
  assert.equal(manager.instance(instance.workflowInstanceId).state, "Failed");
});

test("58 waiting resume policy resumeOnly preserves active activity", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy({ resumePolicy: "ResumeOnly" }), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.observeEnvelope(instance.workflowInstanceId, publishApprovalEvent(messaging));
  assert.equal(manager.instance(instance.workflowInstanceId).activeActivityIds.includes("activity-a"), true);
});

test("59 workflow evidence is append-only with monotonic sequences", () => {
  const evidence = new RuntimeWorkflowEvidence();
  evidence.append("runtime-1", "WorkflowRegistered", { workflowId: "workflow-1" });
  evidence.append("runtime-1", "WorkflowStarted", { workflowId: "workflow-1" });
  assert.deepEqual(evidence.all().map((entry) => entry.sequence), [1, 2]);
});

test("60 workflow diagnostics are monotonic", () => {
  const diagnostics = new RuntimeWorkflowDiagnostics();
  diagnostics.log("runtime-1", "Warning", "GRT-WF-001", "first");
  diagnostics.log("runtime-1", "Warning", "GRT-WF-002", "second");
  assert.deepEqual(diagnostics.all().map((entry) => entry.sequence), [1, 2]);
});

test("61 workflow telemetry counters update deterministically", () => {
  const telemetry = new RuntimeWorkflowTelemetry();
  telemetry.increment("workflow.started");
  telemetry.increment("workflow.started");
  assert.equal(telemetry.snapshot({ workflowCount: 0, instanceCount: 0, graphCount: 0, waitingStateCount: 0, executionIntentCount: 0, runtimePlanReferenceCount: 0, observationCount: 0, diagnosticsCount: 0, evidenceCount: 0, snapshotCount: 0 }).counters["workflow.started"], 2);
});

test("62 workflow snapshots are immutable", () => {
  const store = new RuntimeWorkflowSnapshotStore();
  const snapshot = deepFreeze({
    runtimeInstanceId: "runtime-1",
    runtimeId: "runtime-id-1",
    workflowDefinitions: [],
    workflowInstances: [],
    activityGraphs: [],
    waitingStates: [],
    executionIntents: [],
    observations: [],
    diagnostics: [],
    evidence: [],
    telemetry: { counters: {}, metrics: { workflowCount: 0, instanceCount: 0, graphCount: 0, waitingStateCount: 0, executionIntentCount: 0, runtimePlanReferenceCount: 0, observationCount: 0, diagnosticsCount: 0, evidenceCount: 0, snapshotCount: 0 } },
  });
  assert.equal(Object.isFrozen(store.save(snapshot).snapshot), true);
});

test("63 workflow snapshot revision history increments", () => {
  const manager = createManager();
  registerDefaultWorkflow(manager);
  assert.equal(manager.persistSnapshot().revision, 1);
  assert.equal(manager.persistSnapshot().revision, 2);
});

test("64 restoreLatestSnapshot returns newest revision", () => {
  const manager = createManager();
  registerDefaultWorkflow(manager);
  manager.persistSnapshot();
  const latest = manager.persistSnapshot();
  assert.equal(manager.restoreLatestSnapshot().revision, latest.revision);
});

test("65 replay determinism returns identical verification hash", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  const a = manager.replay(instance.workflowInstanceId).verificationHash;
  const b = manager.replay(instance.workflowInstanceId).verificationHash;
  assert.equal(a, b);
});

test("66 repeated runs produce identical deterministic workflow snapshots", () => {
  const hashes = Array.from({ length: 3 }, () => {
    const manager = createManager();
    const { instance } = materializeStarted(manager);
    manager.runEligibleActivities(instance.workflowInstanceId);
    manager.completeActivity(instance.workflowInstanceId, "activity-a");
    manager.runEligibleActivities(instance.workflowInstanceId);
    return workflowHash(manager);
  });
  assert.equal(new Set(hashes).size, 1);
});

test("67 execution-context ownership is preserved", () => {
  const context = createExecutionContext("runtime-instance-own-001", "runtime-id-own-001");
  const manager = RuntimeWorkflowManager.fromExecutionContext(context);
  assert.equal(manager.runtimeInstanceId, "runtime-instance-own-001");
});

test("68 multi-runtime isolation is preserved", () => {
  const left = createManager("runtime-instance-left", "runtime-id-left");
  const right = createManager("runtime-instance-right", "runtime-id-right");
  const leftWorkflow = registerDefaultWorkflow(left);
  const rightWorkflow = registerDefaultWorkflow(right);
  const leftInstance = left.materializeWorkflow(leftWorkflow.workflowId, { correlationId: "corr-left", startCause: { requestId: "left" } });
  const rightInstance = right.materializeWorkflow(rightWorkflow.workflowId, { correlationId: "corr-right", startCause: { requestId: "right" } });
  assert.notEqual(leftInstance.workflowInstanceId, rightInstance.workflowInstanceId);
});

test("69 workflow registration is context isolated", () => {
  const left = createManager("runtime-instance-left", "runtime-id-left");
  const right = createManager("runtime-instance-right", "runtime-id-right");
  registerDefaultWorkflow(left);
  assert.equal(right.listWorkflows().length, 0);
});

test("70 listWorkflows is deterministically sorted", () => {
  const manager = createManager();
  manager.registerWorkflow(workflowDescriptor({ name: "Zeta" }));
  manager.registerWorkflow(workflowDescriptor({ name: "Alpha", version: "2.0.0" }));
  assert.deepEqual([...manager.listWorkflows()].map((entry) => entry.workflowId), [...manager.listWorkflows()].map((entry) => entry.workflowId).slice().sort((a, b) => a.localeCompare(b)));
});

test("71 listInstances is deterministically sorted", () => {
  const manager = createManager();
  const firstWorkflow = registerDefaultWorkflow(manager);
  manager.materializeWorkflow(firstWorkflow.workflowId, { correlationId: "corr-002", startCause: { requestId: "b" } });
  manager.materializeWorkflow(firstWorkflow.workflowId, { correlationId: "corr-001", startCause: { requestId: "a" } });
  assert.deepEqual([...manager.listInstances()].map((entry) => entry.workflowInstanceId), [...manager.listInstances()].map((entry) => entry.workflowInstanceId).slice().sort((a, b) => a.localeCompare(b)));
});

test("72 listExecutionIntents is deterministically sorted", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-a");
  manager.runEligibleActivities(instance.workflowInstanceId);
  assert.deepEqual([...manager.listExecutionIntents()].map((entry) => entry.intentId), [...manager.listExecutionIntents()].map((entry) => entry.intentId).slice().sort((a, b) => a.localeCompare(b)));
});

test("73 compensation derivation uses activity compensationActivityId", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [
      activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }),
      activity("activity-b"),
      activity("activity-c", { targetId: "customer-comp" }),
    ],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  })).snapshot();
  const derived = new RuntimeCompensationEngine().deriveActivities(workflow, "activity-a");
  assert.deepEqual(derived.map((entry) => entry.activityId), ["activity-c"]);
});

test("74 compensation derivation uses compensation definitions", () => {
  const workflow = new RuntimeWorkflowFactory().create(workflowDescriptor({
    activities: [activity("activity-a", { transitionIds: ["transition-a-b"] }), activity("activity-b"), activity("activity-c")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    compensationDefinitions: [{ activityId: "activity-a", compensationActivityId: "activity-c", trigger: "OnFailure" }],
    exitActivityIds: ["activity-b"],
  })).snapshot();
  const derived = new RuntimeCompensationEngine().deriveActivities(workflow, "activity-a");
  assert.deepEqual(derived.map((entry) => entry.activityId), ["activity-c"]);
});

test("75 startCompensation requires a failed activity", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  assert.throws(() => manager.startCompensation(instance.workflowInstanceId), /GRT-WF-COMP-001|GRT-WF-COMP-002/);
});

test("76 compensation intent creation is deterministic", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [
      activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }),
      activity("activity-b"),
      activity("activity-c", { targetId: "customer-comp" }),
    ],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  const result = manager.startCompensation(instance.workflowInstanceId, scheduling, messaging, 2);
  assert.equal(result.createdIntents.length, 1);
});

test("77 compensation state becomes running after compensation starts", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [
      activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }),
      activity("activity-b"),
      activity("activity-c", { targetId: "customer-comp" }),
    ],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  manager.startCompensation(instance.workflowInstanceId);
  assert.equal(manager.instance(instance.workflowInstanceId).compensationState.status, "Running");
});

test("78 compensation completion transitions workflow to Compensated", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [
      activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }),
      activity("activity-b"),
      activity("activity-c", { targetId: "customer-comp" }),
    ],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  manager.startCompensation(instance.workflowInstanceId);
  manager.completeCompensation(instance.workflowInstanceId, "activity-c");
  assert.equal(manager.instance(instance.workflowInstanceId).state, "Compensated");
});

test("79 compensation failure transitions workflow to CompensationFailed", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [
      activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }),
      activity("activity-b"),
      activity("activity-c", { targetId: "customer-comp" }),
    ],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  manager.startCompensation(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-c", "comp-failed");
  assert.equal(manager.instance(instance.workflowInstanceId).state, "CompensationFailed");
});

test("80 compensation evidence is appended deterministically", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }), activity("activity-b"), activity("activity-c")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  manager.startCompensation(instance.workflowInstanceId);
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "CompensationIntentCreated"), true);
});

test("81 completed workflows can be archived", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-a");
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-b");
  manager.archiveWorkflow(instance.workflowInstanceId);
  assert.equal(manager.instance(instance.workflowInstanceId).state, "Archived");
});

test("82 compensated workflows can be archived", () => {
  const manager = createManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { compensationActivityId: "activity-c", transitionIds: ["transition-a-b"] }), activity("activity-b"), activity("activity-c")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b")],
    exitActivityIds: ["activity-b"],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.failActivity(instance.workflowInstanceId, "activity-a", "boom");
  manager.startCompensation(instance.workflowInstanceId);
  manager.completeCompensation(instance.workflowInstanceId, "activity-c");
  manager.archiveWorkflow(instance.workflowInstanceId);
  assert.equal(manager.instance(instance.workflowInstanceId).state, "Archived");
});

test("83 unresolved waiting observations log diagnostics", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  const messaging = createMessagingManager();
  manager.observeEnvelope(instance.workflowInstanceId, publishApprovalEvent(messaging));
  assert.equal(manager.snapshot().diagnostics.some((entry) => entry.code === "GRT-WF-WAIT-004"), true);
});

test("84 replay includes observed messaging history", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.observeEnvelope(instance.workflowInstanceId, publishApprovalEvent(messaging));
  assert.equal(manager.replay(instance.workflowInstanceId).observations.length >= 1, true);
});

test("85 plan publication updates runtime plan references with message ids", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  assert.equal(Boolean(manager.instance(instance.workflowInstanceId).runtimePlanReferences[0].publishedMessageId), true);
});

test("86 workflow instance revisions increment on mutations", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  const startRevision = manager.instance(instance.workflowInstanceId).revision;
  manager.runEligibleActivities(instance.workflowInstanceId);
  assert.equal(manager.instance(instance.workflowInstanceId).revision > startRevision, true);
});

test("87 workflow completes when exit activities complete", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-a");
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-b");
  assert.equal(manager.instance(instance.workflowInstanceId).state, "Completed");
});

test("88 transition applied evidence is appended", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.completeActivity(instance.workflowInstanceId, "activity-a");
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "TransitionApplied"), true);
});

test("89 snapshot ordering is deterministic across repeated captures", () => {
  const manager = createManager();
  registerDefaultWorkflow(manager);
  const first = stableSerialize(manager.snapshot());
  const second = stableSerialize(manager.snapshot());
  assert.equal(first, second);
});

test("90 workflow manager does not mutate prior snapshots", () => {
  const manager = createManager();
  const { instance } = materializeStarted(manager);
  const before = manager.snapshot();
  manager.runEligibleActivities(instance.workflowInstanceId);
  assert.equal(before.executionIntents.length, 0);
});

test("91 waiting-state history tracks immutable revisions", () => {
  const store = new RuntimeWaitingStateStore();
  store.save({ waitingStateId: "waiting-state-a", workflowInstanceId: "workflow-instance-1", activityId: "activity-a", waitingReason: "wait", resumePolicy: "CompleteActivity", state: "Active", metadata: {} });
  store.save({ ...store.latest("waiting-state-a"), state: "Observed" });
  assert.deepEqual(store.history("waiting-state-a").map((entry) => entry.revision), [1, 2]);
});

test("92 snapshot store restores the latest workflow snapshot", () => {
  const manager = createManager();
  registerDefaultWorkflow(manager);
  manager.persistSnapshot();
  const latest = manager.persistSnapshot();
  assert.equal(manager.restoreLatestSnapshot().revision, latest.revision);
});

test("93 GRT-0001 kernel behavior remains unchanged", async () => {
  const runtimeIR = await getRuntimeIR();
  const kernel = new RuntimeKernel();
  kernel.boot(runtimeIR);
  assert.equal(kernel.state(), "Running");
});

test("94 GRT-0002 host behavior remains unchanged", async () => {
  const runtimeIR = await getRuntimeIR();
  const host = new EnterpriseHost({
    hostId: "genesis-host-wf-001",
    version: "1.0.0",
    defaultEnvironmentId: "prod",
    defaultProfileId: "standard",
  });
  host.bootstrap(
    { id: "prod", displayName: "Production", region: "us-east-1", variables: { STAGE: "prod" } },
    { id: "standard", displayName: "Standard", limits: { cpu: 4, memoryGb: 16 }, featureFlags: { orchestration: true } },
  );
  const instanceId = host.createRuntimeInstance(runtimeIR);
  assert.equal(host.startRuntime(instanceId).state, "Running");
});

test("95 GRT-0003 execution context behavior remains unchanged", () => {
  const context = createExecutionContext();
  assert.equal(context.snapshot().state, "Running");
});

test("96 GRT-0004 object system behavior remains unchanged", () => {
  const objects = new RuntimeObjectManager("runtime-instance-obj-001", "runtime-id-obj-001");
  configureObjectDispatch(objects);
  const record = objects.registerObject(objectDescriptor("customer"));
  objects.initializeObject(record.objectId);
  const ready = objects.readyObject(record.objectId);
  const result = objects.dispatch({
    objectId: ready.objectId,
    capabilityId: "capability.activate",
    principal: "alice",
    payload: { customerId: ready.objectId },
  });
  assert.equal(result.success, true);
});

test("97 GRT-0005 messaging behavior remains unchanged", () => {
  const messaging = createMessagingManager();
  const published = messaging.publish({
    channel: "workflow",
    topic: "workflow.completed",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-workflow",
    payload: { workflowId: "workflow-001", messageType: "completed" },
    correlationId: "corr-001",
    causationId: "cause-001",
    schemaVersion: "1.0.0",
    metadata: { lane: "workflow" },
  });
  assert.equal(published.envelope.topic, "workflow.completed");
});

test("98 GRT-0006 scheduling behavior remains unchanged", () => {
  const scheduling = createSchedulingManager();
  const descriptor: RuntimeScheduleDescriptor = {
    scheduleType: "Immediate",
    targetKind: "RuntimeObject",
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    commandPayload: { objectId: "customer-001", capabilityId: "capability.activate" },
    trigger: { triggerType: "Immediate" },
    executionWindow: { windowId: "window-main", allowedSequences: [1, 2, 3], graceSequences: [] },
    retryPolicy: { policyType: "FixedAttempts", maxAttempts: 1, interval: 1 },
    expirationPolicy: {},
    priority: 10,
    metadata: { lane: "main" },
    version: "1.0.0",
  };
  const schedule = scheduling.registerSchedule(descriptor);
  const plan = scheduling.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(plan.commandTopic, "customer.activate");
});

test("99 workflow to scheduler to messaging integration remains additive", () => {
  const manager = createManager();
  const scheduling = createSchedulingManager();
  const messaging = createMessagingManager();
  const { instance } = materializeStarted(manager);
  const result = manager.runEligibleActivities(instance.workflowInstanceId, scheduling, messaging, { currentSequence: 1 });
  assert.equal(result.publishedMessages.length, 1);
  assert.equal(messaging.listMessages().length, 1);
});

test("100 workflow snapshots preserve deep immutability under replay-heavy flow", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  const workflow = registerDefaultWorkflow(manager, {
    activities: [activity("activity-a", { waitingPolicy: waitingPolicy(), transitionIds: ["transition-a-b"] }), activity("activity-b")],
    transitions: [transition("transition-a-b", "activity-a", "activity-b", { triggerType: "WaitingObserved" })],
  });
  const instance = manager.materializeWorkflow(workflow.workflowId, { correlationId: "corr-001", causationId: "cause-001", startCause: { requestId: "r1" } });
  manager.startWorkflow(instance.workflowInstanceId);
  manager.runEligibleActivities(instance.workflowInstanceId);
  manager.observeEnvelope(instance.workflowInstanceId, publishApprovalEvent(messaging));
  const snapshot = manager.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
});
