import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import {
  RuntimeExecutionContext,
  RuntimeServiceManager,
  type RuntimeServiceDescriptor,
} from "../../../src/runtime/services";
import { RuntimeObjectManager, type RuntimeObjectDescriptor } from "../../../src/runtime/objects";
import {
  RuntimeCommand,
  RuntimeEnvelopeFactory,
  RuntimeEvent,
  RuntimeMessagingManager,
  RuntimeQuery,
  RuntimeReply,
} from "../../../src/runtime/messaging";

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
      id: "runtime-messaging-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-messaging-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function createHost(): EnterpriseHost {
  const host = new EnterpriseHost({
    hostId: "genesis-host-005",
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

function createManager(runtimeInstanceId = "runtime-instance-msg-001", runtimeId = "runtime-id-msg-001"): RuntimeMessagingManager {
  return new RuntimeMessagingManager(runtimeInstanceId, runtimeId);
}

function bootstrappedManager(runtimeInstanceId = "runtime-instance-msg-001", runtimeId = "runtime-id-msg-001"): RuntimeMessagingManager {
  const manager = createManager(runtimeInstanceId, runtimeId);
  manager.registerChannel({ channel: "customer", description: "Customer channel" });
  manager.registerChannel({ channel: "workflow", description: "Workflow channel" });
  manager.registerChannel({ channel: "system", description: "System channel" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });
  manager.registerTopic({ channel: "customer", topic: "customer.created" });
  manager.registerTopic({ channel: "workflow", topic: "workflow.completed" });
  manager.registerTopic({ channel: "system", topic: "system.ready" });
  return manager;
}

function publishCustomerActivated(manager: RuntimeMessagingManager, overrides?: Partial<Parameters<RuntimeMessagingManager["publish"]>[0]>) {
  return manager.publish({
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-customer",
    payload: { customerId: "cust-001", status: "active" },
    correlationId: "corr-customer-001",
    causationId: "cause-customer-001",
    schemaVersion: "1.0.0",
    metadata: { observedAt: "2026-07-16T00:00:00Z" },
    ...overrides,
  });
}

test("1 deterministic envelope identity stable for same canonical envelope", () => {
  const factory = new RuntimeEnvelopeFactory();
  const a = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "1" },
    correlationId: "corr-1",
    causationId: "cause-1",
    schemaVersion: "1.0.0",
    metadata: { observedAt: "2026-07-16T00:00:00Z" },
  }).snapshot();
  const b = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "1" },
    correlationId: "corr-1",
    causationId: "cause-1",
    schemaVersion: "1.0.0",
    metadata: { observedAt: "2026-07-17T00:00:00Z" },
  }).snapshot();
  assert.equal(a.messageId, b.messageId);
});

test("2 deterministic envelope identity changes when sequence changes", () => {
  const factory = new RuntimeEnvelopeFactory();
  const a = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "1" },
    correlationId: "corr-1",
    schemaVersion: "1.0.0",
  }).snapshot();
  const b = factory.create("runtime-instance", "runtime-id", 2, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "1" },
    correlationId: "corr-1",
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.notEqual(a.messageId, b.messageId);
});

test("3 deterministic envelope identity changes when payload changes", () => {
  const factory = new RuntimeEnvelopeFactory();
  const a = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "1" },
    correlationId: "corr-1",
    schemaVersion: "1.0.0",
  }).snapshot();
  const b = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    publisherKind: "RuntimeService",
    publisherId: "svc-a",
    payload: { id: "2" },
    correlationId: "corr-1",
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.notEqual(a.messageId, b.messageId);
});

test("4 command envelope creates RuntimeCommand", () => {
  const envelope = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Command",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { action: "boot" },
    schemaVersion: "1.0.0",
  });
  assert.equal(envelope instanceof RuntimeCommand, true);
});

test("5 event envelope creates RuntimeEvent", () => {
  const envelope = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Event",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { action: "ready" },
    schemaVersion: "1.0.0",
  });
  assert.equal(envelope instanceof RuntimeEvent, true);
});

test("6 query envelope creates RuntimeQuery", () => {
  const envelope = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Query",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { action: "status" },
    schemaVersion: "1.0.0",
  });
  assert.equal(envelope instanceof RuntimeQuery, true);
});

test("7 reply envelope creates RuntimeReply", () => {
  const envelope = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Reply",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    schemaVersion: "1.0.0",
  });
  assert.equal(envelope instanceof RuntimeReply, true);
});

test("8 envelope snapshot is immutable", () => {
  const snapshot = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Reply",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
});

test("9 envelope payload is immutable", () => {
  const snapshot = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Reply",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.equal(Object.isFrozen(snapshot.payload), true);
});

test("10 auto correlation id is deterministic", () => {
  const factory = new RuntimeEnvelopeFactory();
  const a = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Event",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    schemaVersion: "1.0.0",
  }).snapshot();
  const b = factory.create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Event",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.equal(a.correlationId, b.correlationId);
});

test("11 explicit correlation id is preserved", () => {
  const snapshot = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Event",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    correlationId: "corr-explicit",
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.equal(snapshot.correlationId, "corr-explicit");
});

test("12 causation id is preserved", () => {
  const snapshot = new RuntimeEnvelopeFactory().create("runtime-instance", "runtime-id", 1, {
    channel: "system",
    topic: "system.ready",
    envelopeType: "Event",
    publisherKind: "System",
    publisherId: "kernel",
    payload: { ok: true },
    causationId: "cause-explicit",
    schemaVersion: "1.0.0",
  }).snapshot();
  assert.equal(snapshot.causationId, "cause-explicit");
});

test("13 channel registration succeeds", () => {
  const manager = createManager();
  manager.registerChannel({ channel: "customer" });
  assert.deepEqual(manager.snapshot().channels.map((entry) => entry.channel), ["customer"]);
});

test("14 duplicate channel rejected", () => {
  const manager = createManager();
  manager.registerChannel({ channel: "customer" });
  assert.throws(() => manager.registerChannel({ channel: "customer" }), /GRT-MSG-CHANNEL-002/);
});

test("15 empty channel rejected", () => {
  const manager = createManager();
  assert.throws(() => manager.registerChannel({ channel: "" }), /GRT-MSG-CHANNEL-001/);
});

test("16 topic registration succeeds", () => {
  const manager = createManager();
  manager.registerChannel({ channel: "customer" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });
  assert.deepEqual(manager.snapshot().topics.map((entry) => entry.topic), ["customer.activated"]);
});

test("17 duplicate topic rejected", () => {
  const manager = createManager();
  manager.registerChannel({ channel: "customer" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });
  assert.throws(() => manager.registerTopic({ channel: "customer", topic: "customer.activated" }), /GRT-MSG-TOPIC-003/);
});

test("18 topic registration with unknown channel is rejected", () => {
  const manager = createManager();
  assert.throws(() => manager.registerTopic({ channel: "customer", topic: "customer.activated" }), /GRT-MSG-MANAGER-001/);
});

test("19 subscription registration succeeds", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.activated",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  assert.deepEqual(manager.snapshot().subscriptions.map((entry) => entry.subscriptionId), ["sub-1"]);
});

test("20 duplicate subscription rejected", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.activated",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  assert.throws(() => manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.activated",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-b",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  }), /GRT-MSG-SUB-002/);
});

test("21 subscription with unknown channel rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "finance",
    topicPattern: "invoice.created",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  }), /GRT-MSG-MANAGER-002/);
});

test("22 subscription with unknown exact topic rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.unknown",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  }), /GRT-MSG-MANAGER-003/);
});

test("23 wildcard subscription allowed", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.*",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  assert.equal(manager.snapshot().subscriptions[0]?.topicPattern, "customer.*");
});

test("24 accepted envelope types are stored deterministically", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-1",
    channel: "customer",
    topicPattern: "customer.*",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Reply", "Event", "Command"],
    version: "1.0.0",
  });
  assert.deepEqual(manager.snapshot().subscriptions[0]?.acceptedEnvelopeTypes, ["Command", "Event", "Reply"]);
});

test("25 exact topic routing delivers to exact subscription", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-exact",
    channel: "customer",
    topicPattern: "customer.activated",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  const result = publishCustomerActivated(manager);
  assert.deepEqual(result.deliveries.map((entry) => entry.subscriptionId), ["sub-exact"]);
});

test("26 wildcard routing delivers to wildcard subscription", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-all",
    channel: "customer",
    topicPattern: "*",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  const result = publishCustomerActivated(manager);
  assert.equal(result.deliveries.length, 1);
});

test("27 prefix wildcard routing delivers to prefix subscription", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({
    subscriptionId: "sub-prefix",
    channel: "customer",
    topicPattern: "customer.*",
    subscriberKind: "RuntimeService",
    subscriberId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });
  const result = publishCustomerActivated(manager);
  assert.equal(result.deliveries[0]?.subscriptionId, "sub-prefix");
});

test("28 routing is deterministic independent of registration order", () => {
  const a = bootstrappedManager();
  a.registerSubscription({ subscriptionId: "sub-b", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-b", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  a.registerSubscription({ subscriptionId: "sub-a", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });

  const b = bootstrappedManager();
  b.registerSubscription({ subscriptionId: "sub-a", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  b.registerSubscription({ subscriptionId: "sub-b", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-b", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });

  assert.deepEqual(publishCustomerActivated(a).deliveries, publishCustomerActivated(b).deliveries);
});

test("29 routing excludes other channels", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-workflow", channel: "workflow", topicPattern: "workflow.completed", subscriberKind: "RuntimeService", subscriberId: "svc-workflow", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  assert.equal(publishCustomerActivated(manager).deliveries.length, 0);
});

test("30 routing excludes envelope type mismatch", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-command", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Command"], version: "1.0.0" });
  assert.equal(publishCustomerActivated(manager).deliveries.length, 0);
});

test("31 subscription ordering is deterministic by subscription id", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-z", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-z", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  manager.registerSubscription({ subscriptionId: "sub-a", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  const ids = publishCustomerActivated(manager).deliveries.map((entry) => entry.subscriptionId);
  assert.deepEqual(ids, ["sub-a", "sub-z"]);
});

test("32 routing table is deterministic", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-z", channel: "customer", topicPattern: "customer.*", subscriberKind: "RuntimeService", subscriberId: "svc-z", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  manager.registerSubscription({ subscriptionId: "sub-a", channel: "customer", topicPattern: "customer.*", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  assert.deepEqual(manager.snapshot().routingTable[0]?.subscriptionIds, ["sub-a", "sub-z"]);
});

test("33 publish starts message sequence at one", () => {
  const manager = bootstrappedManager();
  const result = publishCustomerActivated(manager);
  assert.equal(result.envelope.sequence, 1);
});

test("34 publish increments message sequence deterministically", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  const second = publishCustomerActivated(manager, { correlationId: "corr-customer-002" });
  assert.equal(second.envelope.sequence, 2);
});

test("35 publish records message log", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.equal(manager.listMessages().length, 1);
});

test("36 publish with missing subscriber goes to dead letter", () => {
  const manager = bootstrappedManager();
  const result = publishCustomerActivated(manager);
  assert.equal(result.deadLettered, true);
  assert.equal(manager.listDeadLetters().length, 1);
});

test("37 publish with rejected delivery goes to dead letter", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-reject", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0", deliveryPolicy: "reject" });
  const result = publishCustomerActivated(manager);
  assert.equal(result.deadLettered, true);
});

test("38 publish with accepted delivery is not dead lettered", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  const result = publishCustomerActivated(manager);
  assert.equal(result.deadLettered, false);
});

test("39 publish records evidence", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "EnvelopePublished"), true);
});

test("40 missing subscriber records diagnostic", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.equal(manager.snapshot().diagnostics.some((entry) => entry.code === "GRT-MSG-DISPATCH-001"), true);
});

test("41 rejected delivery records diagnostic", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-reject", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0", deliveryPolicy: "reject" });
  publishCustomerActivated(manager);
  assert.equal(manager.snapshot().diagnostics.some((entry) => entry.code === "GRT-MSG-DISPATCH-003"), true);
});

test("42 telemetry updates for publish lifecycle", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager);
  const counters = manager.snapshot().telemetry.counters;
  assert.equal((counters["message.published"] ?? 0) > 0, true);
  assert.equal((counters["message.routed"] ?? 0) > 0, true);
  assert.equal((counters["message.delivered"] ?? 0) > 0, true);
});

test("43 dead letter history is captured", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.equal(manager.snapshot().deadLetters.length, 1);
});

test("44 publish with unknown channel is rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.publish({ channel: "unknown", topic: "x", envelopeType: "Event", publisherKind: "System", publisherId: "svc", payload: {}, schemaVersion: "1.0.0" }), /GRT-MSG-PUB-001/);
});

test("45 publish with unknown topic is rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.publish({ channel: "customer", topic: "customer.unknown", envelopeType: "Event", publisherKind: "System", publisherId: "svc", payload: {}, schemaVersion: "1.0.0" }), /GRT-MSG-PUB-002/);
});

test("46 replay cursor can be saved", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  const cursor = manager.saveReplayCursor("cursor-1", 1);
  assert.equal(cursor.cursorId, "cursor-1");
});

test("47 replay cursor beyond history is rejected", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.throws(() => manager.saveReplayCursor("cursor-1", 2), /GRT-MSG-REPLAY-004/);
});

test("48 replay by sequence returns ordered messages", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager, { correlationId: "corr-1" });
  publishCustomerActivated(manager, { correlationId: "corr-2" });
  const replay = manager.replayFromSequence(1);
  assert.deepEqual(replay.replayed.map((entry) => entry.envelope.sequence), [1, 2]);
});

test("49 replay by cursor replays only envelopes after cursor", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager, { correlationId: "corr-1" });
  publishCustomerActivated(manager, { correlationId: "corr-2" });
  manager.saveReplayCursor("cursor-1", 1);
  const replay = manager.replayFromCursor("cursor-1");
  assert.deepEqual(replay.replayed.map((entry) => entry.envelope.sequence), [2]);
});

test("50 replay by correlation id returns matching chain", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager, { correlationId: "corr-shared" });
  publishCustomerActivated(manager, { correlationId: "corr-unique" });
  const replay = manager.replayByCorrelationId("corr-shared");
  assert.equal(replay.replayed.length, 1);
});

test("51 replay by topic returns matching topic history", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.*", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager);
  const replay = manager.replayByTopic("customer", "customer.activated");
  assert.equal(replay.replayed.length, 1);
});

test("52 invalid replay sequence is rejected", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  assert.throws(() => manager.replayFromSequence(99), /GRT-MSG-REPLAY-005/);
});

test("53 unknown replay cursor is rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.replayFromCursor("missing-cursor"), /GRT-MSG-REPLAY-003/);
});

test("54 replay does not append to message log", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager);
  manager.replayFromSequence(1);
  assert.equal(manager.listMessages().length, 1);
});

test("55 replay updates cursor deterministically", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-accept", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  publishCustomerActivated(manager);
  publishCustomerActivated(manager, { correlationId: "corr-2" });
  manager.saveReplayCursor("cursor-1", 1);
  manager.replayFromCursor("cursor-1");
  assert.equal(manager.snapshot().replayCursors.find((entry) => entry.cursorId === "cursor-1")?.lastSequence, 2);
});

test("56 replay records evidence", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  manager.replayByTopic("customer", "customer.activated");
  assert.equal(manager.snapshot().evidence.some((entry) => entry.type === "EnvelopeReplayed"), true);
});

test("57 replay updates telemetry", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  manager.replayByTopic("customer", "customer.activated");
  assert.equal((manager.snapshot().telemetry.counters["message.replayed"] ?? 0) > 0, true);
});

test("58 replay rejected delivery records diagnostics", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-reject", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0", deliveryPolicy: "reject" });
  publishCustomerActivated(manager);
  manager.replayFromSequence(1);
  assert.equal(manager.snapshot().diagnostics.length > 0, true);
});

test("59 snapshot is immutable", () => {
  const manager = bootstrappedManager();
  const snapshot = manager.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
});

test("60 snapshot is serializable", () => {
  const manager = bootstrappedManager();
  publishCustomerActivated(manager);
  const raw = JSON.stringify(manager.snapshot());
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(typeof parsed.runtimeInstanceId, "string");
  assert.equal(Array.isArray(parsed.messages), true);
});

test("61 persist snapshot starts at revision one", () => {
  const manager = bootstrappedManager();
  assert.equal(manager.persistSnapshot().revision, 1);
});

test("62 persist snapshot increments revision deterministically", () => {
  const manager = bootstrappedManager();
  assert.equal(manager.persistSnapshot().revision, 1);
  assert.equal(manager.persistSnapshot().revision, 2);
});

test("63 restore latest snapshot returns highest revision", () => {
  const manager = bootstrappedManager();
  manager.persistSnapshot();
  manager.persistSnapshot();
  assert.equal(manager.restoreLatestSnapshot().revision, 2);
});

test("64 restore without snapshots is rejected", () => {
  const manager = bootstrappedManager();
  assert.throws(() => manager.restoreLatestSnapshot(), /GRT-MSG-SNAPSHOT-001/);
});

test("65 snapshot history ordering is immutable", () => {
  const manager = bootstrappedManager();
  manager.persistSnapshot();
  manager.persistSnapshot();
  const history = manager.snapshotHistory();
  assert.deepEqual(history.map((entry) => entry.revision), [1, 2]);
  assert.equal(Object.isFrozen(history), true);
});

test("66 snapshot includes routing table", () => {
  const manager = bootstrappedManager();
  manager.registerSubscription({ subscriptionId: "sub-1", channel: "customer", topicPattern: "customer.*", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
  assert.equal(manager.snapshot().routingTable.length, 1);
});

test("67 snapshot includes replay cursors", () => {
  const manager = bootstrappedManager();
  manager.saveReplayCursor("cursor-1", 0);
  assert.equal(manager.snapshot().replayCursors.length, 1);
});

test("68 snapshot dead letters are deterministic", () => {
  const run = (): ReturnType<RuntimeMessagingManager["snapshot"]> => {
    const manager = bootstrappedManager();
    publishCustomerActivated(manager);
    return manager.snapshot();
  };
  assert.deepEqual(run().deadLetters, run().deadLetters);
});

test("69 execution context integration via fromExecutionContext", () => {
  const context = new RuntimeExecutionContext("runtime-instance-ctx-1", "runtime-id-ctx-1");
  const manager = RuntimeMessagingManager.fromExecutionContext(context);
  assert.equal(manager.runtimeInstanceId, "runtime-instance-ctx-1");
  assert.equal(manager.runtimeId, "runtime-id-ctx-1");
});

test("70 multi-runtime isolation keeps independent message logs", () => {
  const a = bootstrappedManager("runtime-instance-a", "runtime-id-a");
  const b = bootstrappedManager("runtime-instance-b", "runtime-id-a");
  publishCustomerActivated(a);
  publishCustomerActivated(b);
  assert.notEqual(a.listMessages()[0]?.envelope.messageId, b.listMessages()[0]?.envelope.messageId);
});

test("71 identical semantic publish across instances remains isolated", () => {
  const a = bootstrappedManager("runtime-instance-a", "runtime-id-shared");
  const b = bootstrappedManager("runtime-instance-b", "runtime-id-shared");
  const first = publishCustomerActivated(a);
  const second = publishCustomerActivated(b);
  assert.notEqual(first.envelope.runtimeInstanceId, second.envelope.runtimeInstanceId);
});

test("72 repeated deterministic execution yields equivalent snapshots", () => {
  const run = (): ReturnType<RuntimeMessagingManager["snapshot"]> => {
    const manager = bootstrappedManager("runtime-instance-det", "runtime-id-det");
    manager.registerSubscription({ subscriptionId: "sub-a", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });
    publishCustomerActivated(manager);
    return manager.snapshot();
  };
  const first = run();
  const second = run();
  assert.deepEqual(first.messages, second.messages);
  assert.deepEqual(first.routingTable, second.routingTable);
  assert.deepEqual(first.telemetry.metrics, second.telemetry.metrics);
});

test("73 runtime service subscription integration works", () => {
  const serviceManager = new RuntimeServiceManager();
  const context = serviceManager.createExecutionContext("runtime-instance-svc-1", "runtime-id-svc-1");
  serviceManager.registerServices(context.runtimeInstanceId, [serviceDescriptor("svc-a")]);
  serviceManager.resolveServices(context.runtimeInstanceId);
  serviceManager.activateServices(context.runtimeInstanceId);

  const manager = RuntimeMessagingManager.fromExecutionContext(context);
  manager.registerChannel({ channel: "customer" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });
  manager.registerServiceSubscription({
    subscriptionId: "sub-service-a",
    channel: "customer",
    topicPattern: "customer.activated",
    serviceId: "svc-a",
    acceptedEnvelopeTypes: ["Event"],
    version: "1.0.0",
  });

  const result = publishCustomerActivated(manager, { publisherId: "svc-b" });
  assert.equal(result.deliveries[0]?.subscriberId, "svc-a");
  assert.equal(serviceManager.snapshot(context.runtimeInstanceId).state, "Running");
});

test("74 runtime object publishing occurs through capability dispatch integration", () => {
  const objectManager = new RuntimeObjectManager("runtime-instance-obj-1", "runtime-id-obj-1");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-1"));
  objectManager.initializeObject(object.objectId);
  objectManager.readyObject(object.objectId);

  const manager = createManager("runtime-instance-obj-1", "runtime-id-obj-1");
  manager.registerChannel({ channel: "customer" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });
  manager.registerSubscription({ subscriptionId: "sub-service-a", channel: "customer", topicPattern: "customer.activated", subscriberKind: "RuntimeService", subscriberId: "svc-a", acceptedEnvelopeTypes: ["Event"], version: "1.0.0" });

  const result = manager.dispatchObjectCapability(objectManager, {
    principal: "alice",
    objectId: object.objectId,
    capabilityId: "capability.activate",
    payload: {},
  }, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    payload: { objectId: object.objectId, state: "active" },
    correlationId: "corr-object-1",
    causationId: "cause-object-1",
    schemaVersion: "1.0.0",
  });

  assert.equal(result.dispatchResult.success, true);
  assert.equal(result.publishResult?.envelope.publisherKind, "RuntimeObject");
  assert.equal(result.publishResult?.envelope.publisherId, object.objectId);
});

test("75 object dispatch failure does not publish envelope", () => {
  const objectManager = new RuntimeObjectManager("runtime-instance-obj-1", "runtime-id-obj-1");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-1"));

  const manager = createManager("runtime-instance-obj-1", "runtime-id-obj-1");
  manager.registerChannel({ channel: "customer" });
  manager.registerTopic({ channel: "customer", topic: "customer.activated" });

  const result = manager.dispatchObjectCapability(objectManager, {
    principal: "alice",
    objectId: object.objectId,
    capabilityId: "capability.activate",
    payload: {},
  }, {
    channel: "customer",
    topic: "customer.activated",
    envelopeType: "Event",
    payload: { objectId: object.objectId },
    correlationId: "corr-object-1",
    schemaVersion: "1.0.0",
  });

  assert.equal(result.dispatchResult.success, false);
  assert.equal(result.publishResult, undefined);
  assert.equal(manager.listMessages().length, 0);
});

test("76 no regression to GRT-0001 runtime kernel", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().runtimeState, "Running");
});

test("77 no regression to GRT-0002 enterprise host", async () => {
  const host = createHost();
  const instanceId = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instanceId);
  const stopped = host.deactivateRuntime(instanceId);
  assert.equal(stopped.state, "Stopped");
});

test("78 no regression to GRT-0003 runtime services", () => {
  const serviceManager = new RuntimeServiceManager();
  const context = serviceManager.createExecutionContext("runtime-instance-svc-2", "runtime-id-svc-2");
  serviceManager.registerServices(context.runtimeInstanceId, [serviceDescriptor("svc-a"), serviceDescriptor("svc-b", ["svc-a"])]);
  serviceManager.resolveServices(context.runtimeInstanceId);
  serviceManager.activateServices(context.runtimeInstanceId);
  assert.equal(serviceManager.snapshot(context.runtimeInstanceId).state, "Running");
});

test("79 no regression to GRT-0004 runtime objects", () => {
  const objectManager = new RuntimeObjectManager("runtime-instance-obj-2", "runtime-id-obj-2");
  configureObjectDispatch(objectManager);
  const object = objectManager.registerObject(objectDescriptor("customer-2"));
  objectManager.initializeObject(object.objectId);
  objectManager.readyObject(object.objectId);
  const result = objectManager.dispatch({ principal: "alice", objectId: object.objectId, capabilityId: "capability.activate", payload: {} });
  assert.equal(result.success, true);
});
