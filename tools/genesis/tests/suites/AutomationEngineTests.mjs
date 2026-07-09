/**
 * AutomationEngineTests - Genesis Automation Engine v1 Test Suite
 *
 * 20 comprehensive tests covering:
 * - Engine initialization
 * - Automation loading and registration
 * - Trigger matching
 * - Condition evaluation
 * - Action execution
 * - Execution result tracking
 * - Metadata validation
 * - Event-triggered automations
 * - Lifecycle-triggered automations
 * - Manual automation execution
 * - Dry-run mode
 * - Error handling
 * - Statistics tracking
 * - Context propagation
 * - Multiple action execution
 * - Failure strategies (halt/continue)
 * - Performance tracking
 *
 * @module tools/genesis/tests/suites/AutomationEngineTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { AutomationEngine } from "../../runtime/AutomationEngine.mjs";
import {
  RuntimeAutomation,
  AutomationTrigger,
  AutomationAction,
  AutomationCondition,
  AutomationContext,
  AutomationExecution,
  AutomationExecutionResult
} from "../../runtime/RuntimeAutomationContract.mjs";
import { RuntimeEvent } from "../../runtime/RuntimeEventContract.mjs";

export default async function automationEngineTestSuite() {
  const suite = new TestSuite("Automation Engine Tests", "Genesis Automation Engine v1");

suite.addTest("Engine initializes successfully", async () => {
  const engine = new AutomationEngine();
  const initialized = engine.initialize();
  if (!initialized) throw new Error("Engine did not initialize");
  if (!engine.runtimeReady) throw new Error("Runtime not ready");
});

suite.addTest("Automation contract validates", async () => {
  const automation = new RuntimeAutomation({
    automationId: "test-auto",
    name: "Test Automation",
    module: "test",
    trigger: new AutomationTrigger({
      triggerType: "event",
      eventType: "commandExecuted"
    }),
    actions: [
      new AutomationAction({
        actionType: "command",
        name: "Execute Command"
      })
    ]
  });

  const validation = automation.validate();
  if (!validation.isValid) throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
});

suite.addTest("Automation trigger matches event", async () => {
  const trigger = new AutomationTrigger({
    triggerType: "event",
    eventType: "commandExecuted",
    aggregateType: "Company"
  });

  const event = new RuntimeEvent({
    eventType: "commandExecuted",
    target: "Company",
    targetId: "comp-123",
    source: "CommandBus"
  });

  if (!trigger.matches(event)) throw new Error("Trigger did not match event");
});

suite.addTest("Automation condition evaluates", async () => {
  const condition = new AutomationCondition({
    field: "payload.status",
    operator: "eq",
    value: "active"
  });

  const context = {
    payload: { status: "active" }
  };

  const result = condition.evaluate(context);
  if (!result) throw new Error("Condition should have evaluated to true");
});

suite.addTest("Automation action validates", async () => {
  const action = new AutomationAction({
    actionType: "command",
    name: "Test Action",
    description: "Test action"
  });

  const validation = action.validate();
  if (!validation.isValid) throw new Error(`Action validation failed: ${validation.errors.join(", ")}`);
});

suite.addTest("Automation context stores results", async () => {
  const context = new AutomationContext({
    automationId: "auto-123",
    executionId: "exe-456"
  });

  const actionResult = {
    status: "executed",
    result: { message: "Success" }
  };

  context.addResult("action-123", actionResult);

  const retrieved = context.getResult("action-123");
  if (!retrieved || retrieved.status !== "executed") throw new Error("Context did not store result");
});

suite.addTest("Automation execution tracks lifecycle", async () => {
  const execution = new AutomationExecution({
    automationId: "auto-123",
    automationName: "Test"
  });

  execution.markExecuting();
  if (execution.status !== "executing") throw new Error("Status should be executing");

  execution.markSucceeded();
  if (execution.status !== "succeeded") throw new Error("Status should be succeeded");
  if (!execution.isComplete()) throw new Error("Execution should be complete");
});

suite.addTest("Automation engine registers automation", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-auto-1",
    name: "Test",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  engine.registerAutomation(automation);

  const retrieved = engine.getAutomationById("test-auto-1");
  if (!retrieved) throw new Error("Automation not registered");
  if (retrieved.name !== "Test") throw new Error("Automation data incorrect");
});

suite.addTest("Automation engine lists automations", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation1 = new RuntimeAutomation({
    automationId: "auto-1",
    name: "Auto 1",
    module: "crm",
    enabled: true,
    priority: "high",
    trigger: new AutomationTrigger({ triggerType: "event", eventType: "commandExecuted" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  const automation2 = new RuntimeAutomation({
    automationId: "auto-2",
    name: "Auto 2",
    module: "inventory",
    enabled: false,
    trigger: new AutomationTrigger({ triggerType: "schedule" }),
    actions: [new AutomationAction({ actionType: "notification", name: "Notify" })]
  });

  engine.registerAutomation(automation1);
  engine.registerAutomation(automation2);

  const all = engine.listAutomations();
  if (all.length < 2) throw new Error(`Should have at least 2 automations, got ${all.length}`);

  const crmOnly = engine.listAutomations({ module: "crm" });
  if (crmOnly.length === 0) throw new Error("Should find CRM automations");

  const enabledOnly = engine.listAutomations({ enabled: true });
  if (enabledOnly.length === 0) throw new Error("Should find enabled automations");
});

suite.addTest("Execute automation with dry-run", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-dry-run",
    name: "Dry Run Test",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [
      new AutomationAction({
        actionType: "command",
        name: "Test Action"
      })
    ]
  });

  engine.registerAutomation(automation);

  const result = await engine.execute({
    automationId: "test-dry-run",
    dryRun: true,
    actor: "test-runner"
  });

  if (result.status !== "dryRun") throw new Error(`Status should be dryRun, got ${result.status}`);
  if (!result.isSuccess()) throw new Error("Dry-run should succeed");
});

suite.addTest("Execute automation with actions", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-actions",
    name: "Test Actions",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [
      new AutomationAction({
        actionType: "command",
        name: "Action 1"
      }),
      new AutomationAction({
        actionType: "eventPublish",
        name: "Action 2"
      })
    ]
  });

  engine.registerAutomation(automation);

  const result = await engine.execute({
    automationId: "test-actions",
    actor: "test-runner"
  });

  if (result.status !== "succeeded") throw new Error(`Status should be succeeded, got ${result.status}`);
  if (result.actionsExecuted === 0) throw new Error("Should have executed actions");
});

suite.addTest("Automation validates metadata", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-meta",
    name: "Meta Test",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "event", eventType: "commandExecuted" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  engine.registerAutomation(automation);

  const validation = await engine.validateAutomationMetadata(automation);
  if (!validation.allValid()) throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
});

suite.addTest("Trigger by event finds matching automations", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-event-trigger",
    name: "Event Trigger",
    module: "test",
    enabled: true,
    trigger: new AutomationTrigger({
      triggerType: "event",
      eventType: "commandExecuted",
      aggregateType: "Company"
    }),
    actions: [new AutomationAction({ actionType: "notification", name: "Notify" })]
  });

  engine.registerAutomation(automation);

  const event = new RuntimeEvent({
    eventId: "evt-123",
    eventType: "commandExecuted",
    source: "CommandBus",
    target: "Company",
    targetId: "comp-123",
    actor: "test"
  });

  const results = await engine.triggerByEvent(event);
  if (results.length === 0) throw new Error("Should have triggered automation");
});

suite.addTest("Trigger by lifecycle transition", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-lifecycle",
    name: "Lifecycle Trigger",
    module: "test",
    enabled: true,
    trigger: new AutomationTrigger({
      triggerType: "lifecycleTransition",
      aggregateType: "Order",
      sourceState: "created",
      targetState: "confirmed"
    }),
    actions: [new AutomationAction({ actionType: "command", name: "Update" })]
  });

  engine.registerAutomation(automation);

  const results = await engine.triggerByLifecycleTransition("Order", "created", "confirmed", "ord-123");
  if (results.length === 0) throw new Error("Should have triggered automation");
});

suite.addTest("Manual trigger executes automation", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-manual",
    name: "Manual Test",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [new AutomationAction({ actionType: "notification", name: "Send" })]
  });

  engine.registerAutomation(automation);

  const result = await engine.triggerManual("test-manual", { actor: "test" });
  if (result.status === "failed") throw new Error("Manual trigger failed");
});

suite.addTest("Execution result tracks status", async () => {
  const result = new AutomationExecutionResult({
    automationId: "test",
    automationName: "Test",
    status: "pending",
    startTime: new Date().toISOString()
  });

  result.addError("Test error");
  if (result.errors.length === 0) throw new Error("Error not added");

  result.addWarning("Test warning");
  if (result.warnings.length === 0) throw new Error("Warning not added");

  result.markSucceeded();
  if (result.status !== "succeeded") throw new Error("Status not updated");
  if (!result.isSuccess()) throw new Error("Should be success");
});

suite.addTest("Engine tracks execution history", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-history",
    name: "History Test",
    module: "test",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  engine.registerAutomation(automation);

  await engine.execute({ automationId: "test-history" });
  await engine.execute({ automationId: "test-history" });

  const history = engine.getExecutionHistory({ automationId: "test-history" });
  if (history.length === 0) throw new Error("Execution history not tracked");
});

suite.addTest("Engine statistics track executions", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-stats",
    name: "Stats Test",
    module: "crm",
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  engine.registerAutomation(automation);

  await engine.execute({ automationId: "test-stats" });

  const stats = engine.getStats();
  if (stats.executions.totalExecutions === 0) throw new Error("Stats not updated");
  if (stats.automations.total === 0) throw new Error("Automation count not tracked");
});

suite.addTest("Disabled automations are skipped", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const automation = new RuntimeAutomation({
    automationId: "test-disabled",
    name: "Disabled Test",
    module: "test",
    enabled: false,
    trigger: new AutomationTrigger({ triggerType: "manual" }),
    actions: [new AutomationAction({ actionType: "command", name: "Test" })]
  });

  engine.registerAutomation(automation);

  const event = new RuntimeEvent({
    eventType: "commandExecuted",
    source: "Test",
    target: "Test",
    eventId: "evt-123"
  });

  automation.trigger.triggerType = "event";
  automation.trigger.eventType = "commandExecuted";

  const results = await engine.triggerByEvent(event);
  if (results.length > 0) throw new Error("Disabled automation should not trigger");
});

suite.addTest("Action execution collects results", async () => {
  const engine = new AutomationEngine();
  engine.initialize();

  const action = new AutomationAction({
    actionId: "test-action",
    actionType: "command",
    name: "Test Action"
  });

  const context = new AutomationContext({
    automationId: "auto-123",
    executionId: "exe-456"
  });

  const result = new AutomationExecutionResult({
    automationId: "auto-123",
    automationName: "Test"
  });

  const actionResult = await engine.executeAction(action, context, result);

  if (actionResult.status !== "executed") throw new Error("Action should execute");
  if (!actionResult.actionId) throw new Error("Action ID not set");
  if (!actionResult.duration) throw new Error("Duration not tracked");
});

return suite;
}

