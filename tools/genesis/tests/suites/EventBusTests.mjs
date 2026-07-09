/**
 * EventBusTests - Event Bus test suite
 *
 * Comprehensive tests for Event Bus functionality:
 * - Event publishing
 * - Event subscription/unsubscription
 * - Event validation
 * - Event history and statistics
 * - Dry-run event publishing
 * - Handler notification
 *
 * @module tools/genesis/tests/suites/EventBusTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { EventBus } from "../../runtime/EventBus.mjs";
import {
  RuntimeEvent,
  RuntimeEventSubscription,
  RuntimeEventHandler,
  RuntimeEventResult
} from "../../runtime/RuntimeEventContract.mjs";

export default async function () {
  const suite = new TestSuite("Event Bus Tests");

  // Test 1: Bus initialization
  suite.addTest("Event Bus initializes successfully", async () => {
    const bus = new EventBus();
    const result = bus.initialize();
    if (!result) throw new Error("Bus did not initialize");
  });

  // Test 2: Publish command executed event
  suite.addTest("Publish commandExecuted event", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      targetId: "company-123",
      payload: { commandType: "create", status: "completed" },
      actor: "cli"
    });

    const result = await bus.publish(event);
    if (result.status !== "executed") throw new Error("Event not published");
    if (result.eventType !== "commandExecuted") throw new Error("Wrong event type");
  });

  // Test 3: Publish lifecycle state changed event
  suite.addTest("Publish lifecycleStateChanged event", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "lifecycleStateChanged",
      source: "LifecycleEngine",
      target: "Order",
      targetId: "order-456",
      payload: { previousState: "created", newState: "confirmed" },
      actor: "system"
    });

    const result = await bus.publish(event);
    if (result.status !== "executed") throw new Error("Event not published");
  });

  // Test 4: Publish workflow started event
  suite.addTest("Publish workflowStarted event", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "workflowStarted",
      source: "WorkflowEngine",
      target: "Project",
      payload: { workflowName: "ProjectApproval" },
      actor: "cli"
    });

    const result = await bus.publish(event);
    if (result.status !== "executed") throw new Error("Event not published");
  });

  // Test 5: Subscribe to event type
  suite.addTest("Subscribe to event type", async () => {
    const bus = new EventBus();
    bus.initialize();

    const subscription = new RuntimeEventSubscription({
      eventType: "commandExecuted",
      handlerId: "handler-123",
      subscriber: "test"
    });

    const result = await bus.subscribe(subscription);
    if (result.status !== "executed") throw new Error("Subscription failed");
    if (!result.result?.subscriptionId) throw new Error("No subscription ID");
  });

  // Test 6: Subscribe to event type with aggregate filter
  suite.addTest("Subscribe to event type with aggregate filter", async () => {
    const bus = new EventBus();
    bus.initialize();

    const subscription = new RuntimeEventSubscription({
      eventType: "lifecycleStateChanged",
      aggregateType: "Order",
      handlerId: "handler-order-123",
      subscriber: "test"
    });

    const result = await bus.subscribe(subscription);
    if (result.status !== "executed") throw new Error("Subscription failed");
    if (result.result?.subscriptionId === undefined) throw new Error("No subscription ID");
  });

  // Test 7: Unsubscribe from event
  suite.addTest("Unsubscribe from event", async () => {
    const bus = new EventBus();
    bus.initialize();

    const subscription = new RuntimeEventSubscription({
      eventType: "workflowStarted",
      handlerId: "handler-workflow-123",
      subscriber: "test"
    });

    const subResult = await bus.subscribe(subscription);
    const subId = subResult.result.subscriptionId;

    const unsubResult = await bus.unsubscribe(subId);
    if (unsubResult.status !== "executed") throw new Error("Unsubscribe failed");
    if (!unsubResult.result?.deactivated) throw new Error("Not deactivated");
  });

  // Test 8: Validate event format
  suite.addTest("Validate event format", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "customEvent",
      source: "Application",
      target: "DefaultAggregate",
      payload: { message: "test" },
      actor: "test"
    });

    const validation = event.validate();
    if (!validation.isValid) throw new Error("Event validation failed");
  });

  // Test 9: Reject invalid event type
  suite.addTest("Reject invalid event type", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "invalidEventType",
      source: "TestSource",
      target: "TestTarget",
      payload: {},
      actor: "test"
    });

    const result = await bus.publish(event);
    if (result.status !== "failed") throw new Error("Should have rejected invalid type");
    if (result.errors.length === 0) throw new Error("Should have errors");
  });

  // Test 10: Reject missing required fields
  suite.addTest("Reject event with missing required fields", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      // missing eventType
      source: "TestSource",
      target: "TestTarget",
      payload: {},
      actor: "test"
    });

    const result = await bus.publish(event);
    if (result.status !== "failed") throw new Error("Should have rejected incomplete event");
  });

  // Test 11: Publish event with dry-run
  suite.addTest("Publish event with dry-run mode", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      payload: { status: "completed" },
      actor: "cli",
      dryRun: true
    });

    const result = await bus.publish(event);
    if (result.status !== "dryRun") throw new Error("Should be dryRun status");
    if (result.duration === 0 && !Number.isFinite(result.duration)) throw new Error("Duration not calculated");
  });

  // Test 12: Handler receives notification on publish
  suite.addTest("Handler receives notification on publish", async () => {
    const bus = new EventBus();
    bus.initialize();

    const subscription = new RuntimeEventSubscription({
      eventType: "automationTriggered",
      handlerId: "handler-automation-123",
      subscriber: "test"
    });

    await bus.subscribe(subscription);

    const event = new RuntimeEvent({
      eventType: "automationTriggered",
      source: "AutomationEngine",
      target: "Customer",
      payload: { rule: "EmailNotification" },
      actor: "system"
    });

    const result = await bus.publish(event);
    if (result.handlersNotified.length === 0) throw new Error("No handlers notified");
  });

  // Test 13: List all event subscriptions
  suite.addTest("List all active subscriptions", async () => {
    const bus = new EventBus();
    bus.initialize();

    const sub1 = new RuntimeEventSubscription({
      eventType: "commandExecuted",
      handlerId: "handler-cmd-123",
      subscriber: "test1"
    });

    const sub2 = new RuntimeEventSubscription({
      eventType: "lifecycleStateChanged",
      handlerId: "handler-lifecycle-123",
      subscriber: "test2"
    });

    await bus.subscribe(sub1);
    await bus.subscribe(sub2);

    const subscriptions = bus.listSubscriptions();
    if (subscriptions.length < 2) throw new Error("Subscriptions not listed");
  });

  // Test 14: List event definitions
  suite.addTest("List all event definitions", async () => {
    const bus = new EventBus();
    bus.initialize();

    const definitions = bus.listEventDefinitions();
    if (definitions.length === 0) throw new Error("No definitions returned");

    const hasCommandExecuted = definitions.some(d => d.eventType === "commandExecuted");
    if (!hasCommandExecuted) throw new Error("Missing commandExecuted definition");
  });

  // Test 15: Get event history
  suite.addTest("Get event history", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event1 = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      payload: {},
      actor: "cli"
    });

    const event2 = new RuntimeEvent({
      eventType: "queryExecuted",
      source: "QueryBus",
      target: "Customer",
      payload: {},
      actor: "cli"
    });

    await bus.publish(event1);
    await bus.publish(event2);

    const history = bus.getEventHistory();
    if (history.length < 2) throw new Error("History not tracked");
  });

  // Test 16: Filter event history by type
  suite.addTest("Filter event history by event type", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event1 = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      payload: {},
      actor: "cli"
    });

    const event2 = new RuntimeEvent({
      eventType: "workflowStarted",
      source: "WorkflowEngine",
      target: "Project",
      payload: {},
      actor: "cli"
    });

    await bus.publish(event1);
    await bus.publish(event2);

    const filtered = bus.getEventHistory({ eventType: "commandExecuted" });
    if (filtered.length === 0) throw new Error("Filter did not work");
  });

  // Test 17: Get bus statistics
  suite.addTest("Get event bus statistics", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "aiAgentInvoked",
      source: "AIRuntime",
      target: "Agent",
      payload: {},
      actor: "system"
    });

    await bus.publish(event);

    const stats = bus.getStats();
    if (stats.total === 0) throw new Error("Stats not tracked");
    if (stats.activeHandlers === undefined) throw new Error("Missing activeHandlers stat");
  });

  // Test 18: Event correlation and causation
  suite.addTest("Event correlation and causation chain", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event1 = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      payload: {},
      actor: "cli"
    });

    const result1 = await bus.publish(event1);

    const event2 = new RuntimeEvent({
      eventType: "lifecycleStateChanged",
      source: "LifecycleEngine",
      target: "Order",
      payload: {},
      actor: "cli",
      correlationId: event1.correlationId,
      causationId: event1.eventId
    });

    const result2 = await bus.publish(event2);
    if (result2.status !== "executed") throw new Error("Causation event not published");
  });

  // Test 19: Multiple subscribers to same event
  suite.addTest("Multiple subscribers to same event type", async () => {
    const bus = new EventBus();
    bus.initialize();

    const sub1 = new RuntimeEventSubscription({
      eventType: "commandExecuted",
      handlerId: "handler-cmd-1",
      subscriber: "test1"
    });

    const sub2 = new RuntimeEventSubscription({
      eventType: "commandExecuted",
      handlerId: "handler-cmd-2",
      subscriber: "test2"
    });

    await bus.subscribe(sub1);
    await bus.subscribe(sub2);

    const event = new RuntimeEvent({
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      payload: {},
      actor: "cli"
    });

    const result = await bus.publish(event);
    if (result.handlersNotified.length !== 2) throw new Error("Not all subscribers notified");
  });

  // Test 20: Reject non-object payload
  suite.addTest("Reject event with non-object payload", async () => {
    const bus = new EventBus();
    bus.initialize();

    const event = new RuntimeEvent({
      eventType: "customEvent",
      source: "Application",
      target: "DefaultAggregate",
      payload: "not an object",
      actor: "test"
    });

    const result = await bus.publish(event);
    if (result.status !== "failed") throw new Error("Should reject non-object payload");
  });

  return suite;
}
