/**
 * CommandBusTests.mjs - Test Suite for Command Bus
 *
 * Tests:
 * - Command creation and format validation
 * - Metadata validation
 * - All command types
 * - Dry-run simulations
 * - State changes
 * - Error handling
 * - Statistics tracking
 *
 * @module tools/genesis/tests/suites/CommandBusTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { CommandBus } from "../../runtime/CommandBus.mjs";
import { RuntimeCommand, RuntimeCommandResult } from "../../runtime/RuntimeCommandContract.mjs";

export default async function commandBusTestSuite() {
  const suite = new TestSuite("Command Bus", "Genesis Command Bus v1");

  suite.addTest("Bus initializes successfully", async () => {
    const bus = new CommandBus();
    bus.initialize();
    if (!bus.runtimeReady) throw new Error("Bus runtime not ready");
  });

  suite.addTest("Create command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "Acme Corp" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error(`Expected 'executed', got '${result.status}'`);
    if (!result.stateChanged) throw new Error("State should have changed");
  });

  suite.addTest("Update command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "update",
      aggregateType: "Company",
      aggregateId: "comp-123",
      action: "PUT",
      payload: { status: "active" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error(`Expected 'executed'`);
  });

  suite.addTest("Delete command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "delete",
      aggregateType: "Customer",
      aggregateId: "cust-456",
      action: "DELETE",
      payload: {},
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Delete should execute");
  });

  suite.addTest("Restore command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "restore",
      aggregateType: "Customer",
      aggregateId: "cust-789",
      action: "POST",
      payload: {},
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Restore should execute");
  });

  suite.addTest("Archive command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "archive",
      aggregateType: "Order",
      aggregateId: "ord-123",
      action: "POST",
      payload: {},
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Archive should execute");
  });

  suite.addTest("Lifecycle transition command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "lifecycleTransition",
      aggregateType: "Project",
      aggregateId: "proj-123",
      action: "TRANSITION",
      payload: { currentState: "draft", nextState: "active" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Lifecycle should execute");
  });

  suite.addTest("Workflow start command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "workflowStart",
      aggregateType: "Task",
      action: "EXECUTE",
      payload: { workflowName: "ApprovalProcess" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Workflow start should execute");
  });

  suite.addTest("Dry-run marks status as dryRun", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "DryRunCo" },
      actor: "cli",
      dryRun: true
    });
    if (result.status !== "dryRun") throw new Error(`Expected 'dryRun', got '${result.status}'`);
  });

  suite.addTest("Invalid commandType fails validation", async () => {
    const command = new RuntimeCommand({
      commandType: "invalid",
      aggregateType: "Company",
      action: "POST",
      payload: {}
    });
    const validation = command.validate();
    if (validation.isValid) throw new Error("Should have validation errors");
  });

  suite.addTest("Non-object payload fails validation", async () => {
    const command = new RuntimeCommand({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: "not an object"
    });
    const validation = command.validate();
    if (validation.isValid) throw new Error("Should have validation errors");
  });

  suite.addTest("Bus tracks command history", async () => {
    const bus = new CommandBus();
    bus.initialize();
    await bus.execute({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "Co1" },
      actor: "cli"
    });
    await bus.execute({
      commandType: "update",
      aggregateType: "Company",
      aggregateId: "comp-1",
      action: "PUT",
      payload: { status: "active" },
      actor: "cli"
    });
    const history = bus.getHistory();
    if (history.length !== 2) throw new Error(`Expected 2 commands, got ${history.length}`);
  });

  suite.addTest("Get command by ID returns command", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "Co2" },
      actor: "cli"
    });
    const retrieved = bus.getCommand(result.commandId);
    if (!retrieved) throw new Error("Command not found");
    if (retrieved.commandId !== result.commandId) throw new Error("ID mismatch");
  });

  suite.addTest("Statistics track command counts", async () => {
    const bus = new CommandBus();
    bus.initialize();
    await bus.execute({
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "Co3" },
      actor: "cli"
    });
    const stats = bus.getStats();
    if (stats.total !== 1) throw new Error(`Expected 1 total, got ${stats.total}`);
    if (stats.successful !== 1) throw new Error(`Expected 1 successful`);
    if (stats.stateChanges !== 1) throw new Error(`Expected 1 state change`);
  });

  suite.addTest("Soft delete command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "softDelete",
      aggregateType: "Customer",
      aggregateId: "cust-softdel",
      action: "PATCH",
      payload: {},
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Soft delete should execute");
  });

  suite.addTest("Automation trigger command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "automationTrigger",
      aggregateType: "Notification",
      action: "EXECUTE",
      payload: { automationName: "EmailNotifier" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("Automation should execute");
  });

  suite.addTest("AI agent invoke command executes", async () => {
    const bus = new CommandBus();
    bus.initialize();
    const result = await bus.execute({
      commandType: "aiAgentInvoke",
      aggregateType: "Document",
      action: "ANALYZE",
      payload: { agentName: "DocumentAnalyzer" },
      actor: "cli"
    });
    if (result.status !== "executed") throw new Error("AI agent should execute");
  });

  suite.addTest("Command result marks state changes", async () => {
    const result = new RuntimeCommandResult({
      commandType: "create",
      aggregateType: "Company"
    });
    if (result.stateChanged) throw new Error("Should not be changed initially");
    result.markStateChanged();
    if (!result.stateChanged) throw new Error("Should be marked as changed");
  });

  return suite;
}
