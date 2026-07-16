import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import { RuntimeMessagingManager } from "../../../src/runtime/messaging";
import { RuntimeObjectManager, type RuntimeObjectDescriptor } from "../../../src/runtime/objects";
import {
  RuntimeExecutionContext,
  RuntimeServiceManager,
  type RuntimeServiceDescriptor,
} from "../../../src/runtime/services";
import {
  RuntimeExecutionWindow,
  RuntimePlanFactory,
  RuntimeRetryPolicyEvaluator,
  RuntimeScheduleFactory,
  RuntimeSchedulingManager,
  RuntimeTriggerRegistry,
  type RuntimeExecutionSlot,
  type RuntimeScheduleDescriptor,
} from "../../../src/runtime/scheduling";

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
      id: "runtime-scheduling-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-scheduling-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function createHost(): EnterpriseHost {
  const host = new EnterpriseHost({
    hostId: "genesis-host-006",
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

function serviceDescriptor(id: string, dependencies: readonly string[] = []): RuntimeServiceDescriptor {
  return {
    id,
    version: "1.0.0",
    dependencies,
  };
}

function objectDescriptor(descriptorId: string): RuntimeObjectDescriptor {
  return {
    descriptorId,
    classification: "Customer",
    version: "1.0.0",
    metadata: { domain: "enterprise", tier: 1 },
    initialState: { status: "new" },
    behaviorRefs: ["behavior.activate"],
    capabilityRefs: ["capability.activate"],
    relationshipRefs: [],
  };
}

function slot(sequence: number, window = "main"): RuntimeExecutionSlot {
  return {
    slotId: `slot-${sequence.toString().padStart(6, "0")}`,
    sequence,
    window,
  };
}

function scheduleDescriptor(overrides: Partial<RuntimeScheduleDescriptor> = {}): RuntimeScheduleDescriptor {
  return {
    scheduleType: "Immediate",
    targetKind: "RuntimeObject",
    targetId: "customer-001",
    targetCapability: "capability.activate",
    commandChannel: "system",
    commandTopic: "customer.activate",
    commandPayload: { objectId: "customer-001", capabilityId: "capability.activate" },
    trigger: { triggerType: "Immediate" },
    executionWindow: {
      windowId: "window-main",
      allowedSequences: [1, 2, 3, 4, 5, 6],
      graceSequences: [7],
    },
    retryPolicy: { policyType: "FixedAttempts", maxAttempts: 3, interval: 1 },
    expirationPolicy: { expiresAfterSequence: 10 },
    priority: 10,
    metadata: { domain: "customer", priorityBand: 1 },
    version: "1.0.0",
    ...overrides,
  };
}

function createManager(runtimeInstanceId = "runtime-instance-sch-001", runtimeId = "runtime-id-sch-001"): RuntimeSchedulingManager {
  return new RuntimeSchedulingManager(runtimeInstanceId, runtimeId);
}

function createMessagingManager(runtimeInstanceId = "runtime-instance-sch-001", runtimeId = "runtime-id-sch-001"): RuntimeMessagingManager {
  const messaging = new RuntimeMessagingManager(runtimeInstanceId, runtimeId);
  messaging.registerChannel({ channel: "system", description: "System" });
  messaging.registerChannel({ channel: "workflow", description: "Workflow" });
  messaging.registerTopic({ channel: "system", topic: "customer.activate" });
  messaging.registerTopic({ channel: "workflow", topic: "workflow.resume" });
  return messaging;
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

test("1 deterministic schedule identity stable for same descriptor", () => {
  const factory = new RuntimeScheduleFactory();
  const a = factory.identityFor(scheduleDescriptor());
  const b = factory.identityFor(scheduleDescriptor());
  assert.equal(a, b);
});

test("2 deterministic schedule identity changes when descriptor changes", () => {
  const factory = new RuntimeScheduleFactory();
  const a = factory.identityFor(scheduleDescriptor({ targetId: "customer-001" }));
  const b = factory.identityFor(scheduleDescriptor({ targetId: "customer-002" }));
  assert.notEqual(a, b);
});

test("3 schedule validation requires targetId", () => {
  const factory = new RuntimeScheduleFactory();
  assert.throws(() => factory.create(scheduleDescriptor({ targetId: "" })), /GRT-SCH-SCHEDULE-001/);
});

test("4 schedule validation requires targetCapability", () => {
  const factory = new RuntimeScheduleFactory();
  assert.throws(() => factory.create(scheduleDescriptor({ targetCapability: "" })), /GRT-SCH-SCHEDULE-002/);
});

test("5 schedule validation requires commandChannel", () => {
  const factory = new RuntimeScheduleFactory();
  assert.throws(() => factory.create(scheduleDescriptor({ commandChannel: "" })), /GRT-SCH-SCHEDULE-003/);
});

test("6 schedule validation requires commandTopic", () => {
  const factory = new RuntimeScheduleFactory();
  assert.throws(() => factory.create(scheduleDescriptor({ commandTopic: "" })), /GRT-SCH-SCHEDULE-004/);
});

test("7 schedule validation requires version", () => {
  const factory = new RuntimeScheduleFactory();
  assert.throws(() => factory.create(scheduleDescriptor({ version: "" })), /GRT-SCH-SCHEDULE-005/);
});

test("8 schedule snapshot is immutable", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  assert.equal(Object.isFrozen(schedule), true);
});

test("9 schedule payload is immutable", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  assert.equal(Object.isFrozen(schedule.commandPayload), true);
});

test("10 deterministic runtime plan identity stable for same input", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  const factory = new RuntimePlanFactory();
  const a = factory.create("runtime-instance", "runtime-id", schedule, slot(1), 1, 1, "corr-1").snapshot();
  const b = factory.create("runtime-instance", "runtime-id", schedule, slot(1), 1, 1, "corr-1").snapshot();
  assert.equal(a.planId, b.planId);
});

test("11 deterministic runtime plan identity changes when planned sequence changes", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  const factory = new RuntimePlanFactory();
  const a = factory.create("runtime-instance", "runtime-id", schedule, slot(1), 1, 1, "corr-1").snapshot();
  const b = factory.create("runtime-instance", "runtime-id", schedule, slot(1), 2, 1, "corr-1").snapshot();
  assert.notEqual(a.planId, b.planId);
});

test("12 runtime plan snapshot is immutable", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  const plan = new RuntimePlanFactory().create("runtime-instance", "runtime-id", schedule, slot(1), 1, 1, "corr-1").snapshot();
  assert.equal(Object.isFrozen(plan), true);
});

test("13 runtime plan payload is immutable", () => {
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  const plan = new RuntimePlanFactory().create("runtime-instance", "runtime-id", schedule, slot(1), 1, 1, "corr-1").snapshot();
  assert.equal(Object.isFrozen(plan.commandPayload), true);
});

test("14 immediate trigger evaluates due", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor()).snapshot();
  assert.equal(registry.evaluate(schedule, { currentSequence: 1 })?.sequence, 1);
});

test("15 slot trigger evaluates only matching sequence", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "Slot", trigger: { triggerType: "Slot", slot: slot(3) } })).snapshot();
  assert.equal(registry.evaluate(schedule, { currentSequence: 3 })?.slotId, slot(3).slotId);
  assert.equal(registry.evaluate(schedule, { currentSequence: 2 }), undefined);
});

test("16 recurrence trigger evaluates on interval", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "Recurrence", trigger: { triggerType: "Recurrence", recurrence: { interval: 3 } } })).snapshot();
  assert.equal(registry.evaluate(schedule, { currentSequence: 3 })?.sequence, 3);
  assert.equal(registry.evaluate(schedule, { currentSequence: 4 }), undefined);
});

test("17 recurrence trigger respects limit", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "Recurrence", trigger: { triggerType: "Recurrence", recurrence: { interval: 2, limit: 2 } } })).snapshot();
  assert.equal(registry.evaluate(schedule, { currentSequence: 4 })?.sequence, 4);
  assert.equal(registry.evaluate(schedule, { currentSequence: 6 }), undefined);
});

test("18 dependency completion trigger evaluates when dependency satisfied", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "DependencyCompletion", trigger: { triggerType: "DependencyCompletion", dependency: { dependencyId: "dep-1", requiredState: "Complete" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 5, completedDependencies: [{ dependencyId: "dep-1", requiredState: "Complete" }] });
  assert.equal(slotValue?.sequence, 5);
});

test("19 runtime event trigger evaluates when observed event matches", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "RuntimeEvent", trigger: { triggerType: "RuntimeEvent", event: { channel: "system", topic: "customer.activate" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 2, observedEvent: { channel: "system", topic: "customer.activate", messageId: "msg-1" } });
  assert.equal(slotValue?.sequence, 2);
});

test("20 runtime command trigger evaluates when observed command matches", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "RuntimeCommand", trigger: { triggerType: "RuntimeCommand", command: { channel: "system", topic: "customer.activate" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 2, observedCommand: { channel: "system", topic: "customer.activate", messageId: "msg-1" } });
  assert.equal(slotValue?.sequence, 2);
});

test("21 workflow completion trigger evaluates when workflow completed", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "WorkflowCompletion", trigger: { triggerType: "WorkflowCompletion", workflow: { workflowId: "wf-1" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 4, completedWorkflows: ["wf-1"] });
  assert.equal(slotValue?.sequence, 4);
});

test("22 recovery trigger evaluates when recovery reason matches", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "Recovery", trigger: { triggerType: "Recovery", recovery: { reason: "host-recovery" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 4, recoveryReason: "host-recovery" });
  assert.equal(slotValue?.sequence, 4);
});

test("23 manual trigger evaluates when approval id matches", () => {
  const registry = new RuntimeTriggerRegistry();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ scheduleType: "Manual", trigger: { triggerType: "Manual", manual: { approvalId: "approval-1" } } })).snapshot();
  const slotValue = registry.evaluate(schedule, { currentSequence: 4, manualApprovalId: "approval-1" });
  assert.equal(slotValue?.sequence, 4);
});

test("24 execution window allows configured sequence", () => {
  const windows = new RuntimeExecutionWindow();
  assert.equal(windows.canExecute(1, scheduleDescriptor().executionWindow), true);
});

test("25 execution window allows grace sequence", () => {
  const windows = new RuntimeExecutionWindow();
  assert.equal(windows.canExecute(7, scheduleDescriptor().executionWindow), true);
});

test("26 execution window rejects sequence outside window", () => {
  const windows = new RuntimeExecutionWindow();
  assert.equal(windows.canExecute(9, scheduleDescriptor().executionWindow), false);
});

test("27 expiration after sequence is deterministic", () => {
  const windows = new RuntimeExecutionWindow();
  assert.equal(windows.isExpired(11, slot(11), scheduleDescriptor().expirationPolicy), true);
  assert.equal(windows.isExpired(10, slot(10), scheduleDescriptor().expirationPolicy), false);
});

test("28 expiration at slot is deterministic", () => {
  const windows = new RuntimeExecutionWindow();
  assert.equal(windows.isExpired(5, slot(5), { expiresAtSlot: "slot-000004" }), true);
  assert.equal(windows.isExpired(4, slot(4), { expiresAtSlot: "slot-000004" }), false);
});

test("29 manager registers schedule", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  assert.equal(schedule.scheduleId.startsWith("schedule-"), true);
});

test("30 manager rejects duplicate schedule registration", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor());
  assert.throws(() => manager.registerSchedule(scheduleDescriptor()), /GRT-SCH-MANAGER-001/);
});

test("31 manager list ordering is deterministic", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor({ targetId: "z" }));
  manager.registerSchedule(scheduleDescriptor({ targetId: "a" }));
  const ids = manager.listSchedules().map((entry) => entry.scheduleId);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted);
});

test("32 manager generates immediate runtime plan", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(plan.plannedSequence, 1);
  assert.equal(plan.attempt, 1);
});

test("33 manager rejects generation when schedule not due", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ scheduleType: "Slot", trigger: { triggerType: "Slot", slot: slot(3) } }));
  assert.throws(() => manager.generatePlan(schedule.scheduleId, { currentSequence: 1 }), /GRT-SCH-PLAN-001/);
});

test("34 manager planIfDue returns undefined when not due", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ scheduleType: "Slot", trigger: { triggerType: "Slot", slot: slot(3) } }));
  assert.equal(manager.planIfDue(schedule.scheduleId, { currentSequence: 1 }), undefined);
});

test("35 generateDuePlans orders by priority then schedule id", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor({ targetId: "b", priority: 5 }));
  manager.registerSchedule(scheduleDescriptor({ targetId: "a", priority: 20 }));
  const plans = manager.generateDuePlans({ currentSequence: 1 });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].priority, undefined);
  assert.equal(plans[0].targetId, "a");
});

test("36 manager stores generated plan deterministically", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(manager.listPlans()[0]?.planId, plan.planId);
});

test("37 generateDuePlans filters out expired schedules", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor({ expirationPolicy: { expiresAfterSequence: 0 } }));
  assert.equal(manager.generateDuePlans({ currentSequence: 1 }).length, 0);
});

test("38 generateDuePlans filters out schedules outside execution window", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor({ executionWindow: { windowId: "window-late", allowedSequences: [10], graceSequences: [] } }));
  assert.equal(manager.generateDuePlans({ currentSequence: 1 }).length, 0);
});

test("39 plan includes deterministic correlation id", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const a = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 }).correlationId;
  const managerB = createManager();
  const scheduleB = managerB.registerSchedule(scheduleDescriptor());
  const b = managerB.generatePlan(scheduleB.scheduleId, { currentSequence: 1 }).correlationId;
  assert.equal(a, b);
});

test("40 plan includes causation id from observed event", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ scheduleType: "RuntimeEvent", trigger: { triggerType: "RuntimeEvent", event: { channel: "system", topic: "customer.activate" } } }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1, observedEvent: { channel: "system", topic: "customer.activate", messageId: "msg-cause" } });
  assert.equal(plan.causationId, "msg-cause");
});

test("41 plan target fields remain canonical", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ targetKind: "RuntimeObject", targetId: "customer-123", targetCapability: "capability.activate" }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(plan.targetKind, "RuntimeObject");
  assert.equal(plan.targetId, "customer-123");
});

test("42 plan command routing fields remain canonical", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ commandChannel: "workflow", commandTopic: "workflow.resume" }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(plan.commandChannel, "workflow");
  assert.equal(plan.commandTopic, "workflow.resume");
});

test("43 plan publication emits runtime command through messaging", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  messaging.registerServiceSubscription({ subscriptionId: "sub-command", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  const result = manager.publishPlan(plan.planId, messaging);
  assert.equal(result.envelope.envelopeType, "Command");
  assert.equal(result.envelope.publisherKind, "Scheduler");
});

test("44 plan publication preserves plan correlation id", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  messaging.registerServiceSubscription({ subscriptionId: "sub-command", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  const result = manager.publishPlan(plan.planId, messaging);
  assert.equal(result.envelope.correlationId, plan.correlationId);
});

test("45 plan publication rejected on unknown topic records diagnostics", () => {
  const manager = createManager();
  const messaging = new RuntimeMessagingManager(manager.runtimeInstanceId, manager.runtimeId);
  messaging.registerChannel({ channel: "system" });
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.throws(() => manager.publishPlan(plan.planId, messaging), /GRT-MSG-PUB-002/);
  assert.equal(manager.snapshot().diagnostics.some((entry) => entry.code === "GRT-SCH-PUBLISH-001"), true);
});

test("46 messaging integration updates plan published telemetry", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  messaging.registerServiceSubscription({ subscriptionId: "sub-command", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  manager.publishPlan(plan.planId, messaging);
  assert.equal((manager.snapshot().telemetry.counters["plan.published"] ?? 0) > 0, true);
});

test("47 runtime plan publication targets service subscriptions through messaging", () => {
  const serviceManager = new RuntimeServiceManager();
  const context = serviceManager.createExecutionContext("runtime-instance-svc-sch-1", "runtime-id-svc-sch-1");
  serviceManager.registerServices(context.runtimeInstanceId, [serviceDescriptor("svc-command")]);
  serviceManager.resolveServices(context.runtimeInstanceId);
  serviceManager.activateServices(context.runtimeInstanceId);

  const scheduling = RuntimeSchedulingManager.fromExecutionContext(context);
  const messaging = RuntimeMessagingManager.fromExecutionContext(context);
  messaging.registerChannel({ channel: "system" });
  messaging.registerTopic({ channel: "system", topic: "customer.activate" });
  messaging.registerServiceSubscription({ subscriptionId: "sub-service", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });

  const schedule = scheduling.registerSchedule(scheduleDescriptor());
  const plan = scheduling.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  const published = scheduling.publishPlan(plan.planId, messaging);
  assert.equal(published.deliveries[0]?.subscriberId, "svc-command");
  assert.equal(serviceManager.snapshot(context.runtimeInstanceId).state, "Running");
});

test("48 scheduler plans target runtime object capability without direct execution", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ targetKind: "RuntimeObject", targetId: "customer-1", targetCapability: "capability.activate" }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(plan.targetKind, "RuntimeObject");
  assert.equal(plan.commandPayload["capabilityId"], "capability.activate");
});

test("49 scheduler does not mutate object state directly", () => {
  const objectManager = new RuntimeObjectManager("runtime-instance-obj-sch-1", "runtime-id-obj-sch-1");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-1"));
  objectManager.initializeObject(object.objectId);
  objectManager.readyObject(object.objectId);

  const scheduling = new RuntimeSchedulingManager("runtime-instance-obj-sch-1", "runtime-id-obj-sch-1");
  const schedule = scheduling.registerSchedule(scheduleDescriptor({ targetId: object.objectId, commandPayload: { objectId: object.objectId, capabilityId: "capability.activate" } }));
  scheduling.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(objectManager.getObject(object.objectId).lifecycleState, "Ready");
});

test("50 never retry policy is exhausted immediately", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ retryPolicy: { policyType: "Never" } }));
  const retry = manager.deriveRetryState(schedule.scheduleId, 1);
  assert.equal(retry.exhausted, true);
});

test("51 fixed attempts retry policy exhausts at max attempts", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ retryPolicy: { policyType: "FixedAttempts", maxAttempts: 2, interval: 1 } }));
  assert.equal(manager.deriveRetryState(schedule.scheduleId, 1).exhausted, false);
  assert.equal(manager.deriveRetryState(schedule.scheduleId, 2).exhausted, true);
});

test("52 linear backoff retry policy derives next eligible sequence", () => {
  const evaluator = new RuntimeRetryPolicyEvaluator();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ retryPolicy: { policyType: "LinearBackoff", interval: 2 } })).snapshot();
  const retry = evaluator.derive(schedule, 3, slot(3));
  assert.equal(retry.nextEligibleSequence, 5);
});

test("53 exponential backoff retry policy derives next eligible sequence", () => {
  const evaluator = new RuntimeRetryPolicyEvaluator();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ retryPolicy: { policyType: "ExponentialBackoff", interval: 2, multiplier: 3 } })).snapshot();
  const retry = evaluator.derive(schedule, 3, slot(3), { scheduleId: schedule.scheduleId, lastAttempt: 1, nextEligibleSequence: 3, exhausted: false });
  assert.equal(retry.nextEligibleSequence, 9);
});

test("54 until expiration retry policy exhausts after expiration", () => {
  const evaluator = new RuntimeRetryPolicyEvaluator();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ retryPolicy: { policyType: "UntilExpiration" }, expirationPolicy: { expiresAfterSequence: 1 } })).snapshot();
  const retry = evaluator.derive(schedule, 2, slot(2));
  assert.equal(retry.exhausted, true);
});

test("55 compensation required retry policy is exhausted immediately", () => {
  const evaluator = new RuntimeRetryPolicyEvaluator();
  const schedule = new RuntimeScheduleFactory().create(scheduleDescriptor({ retryPolicy: { policyType: "CompensationRequired" } })).snapshot();
  const retry = evaluator.derive(schedule, 2, slot(2));
  assert.equal(retry.exhausted, true);
});

test("56 retry derivation records evidence", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  manager.deriveRetryState(schedule.scheduleId, 1);
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "RetryDerived"), true);
});

test("57 retry exhaustion records diagnostics", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ retryPolicy: { policyType: "Never" } }));
  manager.deriveRetryState(schedule.scheduleId, 1);
  assert.equal(manager.snapshot().diagnostics.some((entry) => entry.code === "GRT-SCH-RETRY-001"), true);
});

test("58 schedule expiration records evidence and telemetry", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ expirationPolicy: { expiresAfterSequence: 0 } }));
  manager.planIfDue(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "ScheduleExpired"), true);
  assert.equal((manager.snapshot().telemetry.counters["schedule.expired"] ?? 0) > 0, true);
});

test("59 schedule creation telemetry increments", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor());
  assert.equal((manager.snapshot().telemetry.counters["schedule.created"] ?? 0) > 0, true);
});

test("60 plan generation telemetry increments", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  assert.equal((manager.snapshot().telemetry.counters["plan.generated"] ?? 0) > 0, true);
});

test("61 evidence sequencing is monotonic", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  manager.deriveRetryState(schedule.scheduleId, 1);
  const sequences = manager.snapshot().evidence.map((entry) => entry.sequence);
  assert.deepEqual(sequences, [...sequences].sort((a, b) => a - b));
});

test("62 diagnostics sequencing is monotonic", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor({ retryPolicy: { policyType: "Never" } }));
  manager.deriveRetryState(schedule.scheduleId, 1);
  const sequences = manager.snapshot().diagnostics.map((entry) => entry.sequence);
  assert.deepEqual(sequences, [...sequences].sort((a, b) => a - b));
});

test("63 snapshot is deeply immutable", () => {
  const manager = createManager();
  const snapshot = manager.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.schedules), true);
});

test("64 snapshot is serializable", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor());
  const raw = JSON.stringify(manager.snapshot());
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(typeof parsed.runtimeInstanceId, "string");
  assert.equal(Array.isArray(parsed.schedules), true);
});

test("65 persist snapshot starts at revision one", () => {
  const manager = createManager();
  assert.equal(manager.persistSnapshot().revision, 1);
});

test("66 persist snapshot increments revision deterministically", () => {
  const manager = createManager();
  assert.equal(manager.persistSnapshot().revision, 1);
  assert.equal(manager.persistSnapshot().revision, 2);
});

test("67 restore latest snapshot returns highest revision", () => {
  const manager = createManager();
  manager.persistSnapshot();
  manager.persistSnapshot();
  assert.equal(manager.restoreLatestSnapshot().revision, 2);
});

test("68 restore without snapshot is rejected", () => {
  const manager = createManager();
  assert.throws(() => manager.restoreLatestSnapshot(), /GRT-SCH-SNAPSHOT-001/);
});

test("69 snapshot history ordering is immutable", () => {
  const manager = createManager();
  manager.persistSnapshot();
  manager.persistSnapshot();
  const history = manager.snapshotHistory();
  assert.deepEqual(history.map((entry) => entry.revision), [1, 2]);
  assert.equal(Object.isFrozen(history), true);
});

test("70 execution windows appear in snapshot", () => {
  const manager = createManager();
  manager.registerSchedule(scheduleDescriptor());
  assert.equal(manager.snapshot().executionWindows.length, 1);
});

test("71 retry state ordering is deterministic", () => {
  const manager = createManager();
  const a = manager.registerSchedule(scheduleDescriptor({ targetId: "b" }));
  const b = manager.registerSchedule(scheduleDescriptor({ targetId: "a" }));
  manager.deriveRetryState(a.scheduleId, 1);
  manager.deriveRetryState(b.scheduleId, 1);
  const ids = manager.retryStates().map((entry) => entry.scheduleId);
  const sorted = [...ids].sort((x, y) => x.localeCompare(y));
  assert.deepEqual(ids, sorted);
});

test("72 execution context integration via fromExecutionContext", () => {
  const context = new RuntimeExecutionContext("runtime-instance-ctx-1", "runtime-id-ctx-1");
  const manager = RuntimeSchedulingManager.fromExecutionContext(context);
  assert.equal(manager.runtimeInstanceId, "runtime-instance-ctx-1");
  assert.equal(manager.runtimeId, "runtime-id-ctx-1");
});

test("73 multi-runtime isolation keeps independent schedule stores", () => {
  const a = createManager("runtime-instance-a", "runtime-id-shared");
  const b = createManager("runtime-instance-b", "runtime-id-shared");
  a.registerSchedule(scheduleDescriptor({ targetId: "customer-a" }));
  b.registerSchedule(scheduleDescriptor({ targetId: "customer-b" }));
  assert.equal(a.listSchedules().length, 1);
  assert.equal(b.listSchedules().length, 1);
  assert.notEqual(a.snapshot().runtimeInstanceId, b.snapshot().runtimeInstanceId);
});

test("74 identical schedule descriptors across instances remain isolated", () => {
  const a = createManager("runtime-instance-a", "runtime-id-shared");
  const b = createManager("runtime-instance-b", "runtime-id-shared");
  const first = a.registerSchedule(scheduleDescriptor());
  const second = b.registerSchedule(scheduleDescriptor());
  assert.equal(first.scheduleId, second.scheduleId);
  assert.notEqual(a.runtimeInstanceId, b.runtimeInstanceId);
});

test("75 repeated deterministic execution yields equivalent scheduling snapshots", () => {
  const run = (): ReturnType<RuntimeSchedulingManager["snapshot"]> => {
    const manager = createManager("runtime-instance-det", "runtime-id-det");
    const schedule = manager.registerSchedule(scheduleDescriptor());
    manager.generatePlan(schedule.scheduleId, { currentSequence: 1 });
    manager.deriveRetryState(schedule.scheduleId, 1);
    return manager.snapshot();
  };
  const first = run();
  const second = run();
  assert.deepEqual(first.schedules, second.schedules);
  assert.deepEqual(first.plans, second.plans);
  assert.deepEqual(first.telemetry.metrics, second.telemetry.metrics);
});

test("76 repeated plan generation in same manager returns existing deterministic plan", () => {
  const manager = createManager();
  const schedule = manager.registerSchedule(scheduleDescriptor());
  const a = manager.planIfDue(schedule.scheduleId, { currentSequence: 1 });
  const b = manager.planIfDue(schedule.scheduleId, { currentSequence: 1 });
  assert.equal(a?.planId, b?.planId);
});

test("77 runtime event trigger preserves causation to plan publication", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  messaging.registerServiceSubscription({ subscriptionId: "sub-command", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = manager.registerSchedule(scheduleDescriptor({ scheduleType: "RuntimeEvent", trigger: { triggerType: "RuntimeEvent", event: { channel: "system", topic: "customer.activate" } } }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1, observedEvent: { channel: "system", topic: "customer.activate", messageId: "msg-origin" } });
  const published = manager.publishPlan(plan.planId, messaging);
  assert.equal(published.envelope.causationId, "msg-origin");
});

test("78 workflow schedule can publish workflow resume command", () => {
  const manager = createManager();
  const messaging = createMessagingManager();
  messaging.registerSubscription({ subscriptionId: "sub-workflow", channel: "workflow", topicPattern: "workflow.resume", subscriberKind: "Workflow", subscriberId: "wf-1", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = manager.registerSchedule(scheduleDescriptor({ targetKind: "Workflow", targetId: "wf-1", commandChannel: "workflow", commandTopic: "workflow.resume", scheduleType: "WorkflowCompletion", trigger: { triggerType: "WorkflowCompletion", workflow: { workflowId: "wf-trigger" } } }));
  const plan = manager.generatePlan(schedule.scheduleId, { currentSequence: 1, completedWorkflows: ["wf-trigger"] });
  const published = manager.publishPlan(plan.planId, messaging);
  assert.equal(published.deliveries[0]?.subscriberId, "wf-1");
});

test("79 no regression to GRT-0001 runtime kernel", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().runtimeState, "Running");
});

test("80 no regression to GRT-0002 enterprise host", async () => {
  const host = createHost();
  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);
  const stopped = host.deactivateRuntime(instanceId);
  assert.equal(stopped.state, "Stopped");
});

test("81 no regression to GRT-0003 runtime services", () => {
  const serviceManager = new RuntimeServiceManager();
  const context = serviceManager.createExecutionContext("runtime-instance-svc-1", "runtime-id-svc-1");
  serviceManager.registerServices(context.runtimeInstanceId, [serviceDescriptor("svc-a"), serviceDescriptor("svc-b", ["svc-a"])]);
  serviceManager.resolveServices(context.runtimeInstanceId);
  serviceManager.activateServices(context.runtimeInstanceId);
  assert.equal(serviceManager.snapshot(context.runtimeInstanceId).state, "Running");
});

test("82 no regression to GRT-0004 runtime objects", () => {
  const objectManager = new RuntimeObjectManager("runtime-instance-obj-2", "runtime-id-obj-2");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-2"));
  objectManager.initializeObject(object.objectId);
  objectManager.readyObject(object.objectId);
  const result = objectManager.dispatch({ principal: "alice", objectId: object.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, true);
});

test("83 no regression to GRT-0005 runtime messaging", () => {
  const messaging = createMessagingManager();
  messaging.registerServiceSubscription({ subscriptionId: "sub-event", channel: "system", topicPattern: "customer.activate", serviceId: "svc-event", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const result = messaging.publish({ channel: "system", topic: "customer.activate", envelopeType: "Command", publisherKind: "System", publisherId: "kernel", payload: { ok: true }, schemaVersion: "1.0.0" });
  assert.equal(result.success, undefined);
  assert.equal(result.envelope.envelopeType, "Command");
});

test("84 scheduling plus messaging plus object runtime remain composition-only", () => {
  const scheduling = createManager("runtime-instance-compose", "runtime-id-compose");
  const messaging = createMessagingManager("runtime-instance-compose", "runtime-id-compose");
  const objectManager = new RuntimeObjectManager("runtime-instance-compose", "runtime-id-compose");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-3"));
  objectManager.initializeObject(object.objectId);
  objectManager.readyObject(object.objectId);

  messaging.registerServiceSubscription({ subscriptionId: "sub-command", channel: "system", topicPattern: "customer.activate", serviceId: "svc-command", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  const schedule = scheduling.registerSchedule(scheduleDescriptor({ targetId: object.objectId, commandPayload: { objectId: object.objectId, capabilityId: "capability.activate" } }));
  const plan = scheduling.generatePlan(schedule.scheduleId, { currentSequence: 1 });
  scheduling.publishPlan(plan.planId, messaging);
  assert.equal(objectManager.getObject(object.objectId).lifecycleState, "Ready");
  assert.equal(messaging.listMessages().length, 1);
});