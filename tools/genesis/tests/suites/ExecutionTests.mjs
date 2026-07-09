/**
 * ExecutionTests - Genesis Runtime Execution Engine Tests
 *
 * Test suite for runtime execution engine:
 * - Execution request validation
 * - Dry-run simulations
 * - Execution result handling
 * - Error and warning handling
 *
 * @module tools/genesis/tests/suites/ExecutionTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import { RuntimeExecutionEngine } from "../../runtime/RuntimeExecutionEngine.mjs";
import { ExecutionRequest, ExecutionResponse } from "../../runtime/ExecutionContract.mjs";
import { ExecutionValidator } from "../../runtime/ExecutionValidator.mjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../../../../");

/**
 * Create and return execution tests
 */
export default async function createExecutionTests() {
  const suite = new TestSuite(
    "Execution Engine",
    "Runtime Execution Engine v1"
  );

  // Test 1: Engine initializes
  suite.addTest("Execution engine initializes", async () => {
    const engine = new RuntimeExecutionEngine();
    if (!engine) {
      throw new Error("Failed to create execution engine");
    }
    engine.initialize();
    if (!engine.runtimeReady) {
      throw new Error("Runtime not ready after initialization");
    }
  });

  // Test 2: Execution request validates format
  suite.addTest("Execution request validates format", async () => {
    const request = new ExecutionRequest({
      type: "command",
      target: "TestAPI",
      action: "execute",
      payload: {}
    });

    const validation = request.validate();
    if (!validation.isValid) {
      throw new Error(
        `Request validation failed: ${validation.errors.join(", ")}`
      );
    }
  });

  // Test 3: Execution request rejects invalid type
  suite.addTest("Execution request rejects invalid type", async () => {
    const request = new ExecutionRequest({
      type: "invalidType",
      target: "TestAPI",
      action: "execute"
    });

    const validation = request.validate();
    if (validation.isValid) {
      throw new Error("Should reject invalid execution type");
    }
  });

  // Test 4: Execution request requires target
  suite.addTest("Execution request requires target", async () => {
    const request = new ExecutionRequest({
      type: "command",
      action: "execute"
    });

    const validation = request.validate();
    if (validation.isValid) {
      throw new Error("Should require target");
    }
  });

  // Test 5: Execution response tracks status
  suite.addTest("Execution response tracks status", async () => {
    const response = new ExecutionResponse({
      executionId: "exec-123",
      type: "command",
      target: "TestAPI",
      action: "execute",
      status: "pending"
    });

    if (response.status !== "pending") {
      throw new Error("Response status not tracked");
    }
  });

  // Test 6: Validator initializes with manifest
  suite.addTest("Validator loads runtime manifest", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    if (!validator.runtimeManifest) {
      throw new Error("Manifest not loaded");
    }

    if (!validator.runtimeManifest.finalState) {
      throw new Error("Manifest missing finalState");
    }
  });

  // Test 7: Validator validates command execution
  suite.addTest("Validator validates command execution", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "command",
      target: "CompanyAPI",
      action: "create",
      payload: { name: "Test" },
      actor: "system"
    });

    const result = validator.validate(request);

    if (!result.targetExists) {
      throw new Error("Target should exist for command");
    }

    if (!result.actionExists) {
      throw new Error("Action should exist");
    }

    if (!result.actorAllowed) {
      throw new Error("System actor should be allowed");
    }

    if (!result.allValid()) {
      throw new Error(
        `Validation failed: ${result.errors.join(", ")}`
      );
    }
  });

  // Test 8: Validator validates workflow execution
  suite.addTest("Validator validates workflow execution", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "workflow",
      target: "OrderWorkflow",
      action: "execute",
      payload: { orderId: "ORD-123" },
      actor: "automation"
    });

    const result = validator.validate(request);

    if (!result.targetExists) {
      throw new Error("Workflow target should exist");
    }

    if (!result.actorAllowed) {
      throw new Error("Automation actor should be allowed");
    }
  });

  // Test 9: Validator validates automation execution
  suite.addTest("Validator validates automation execution", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "automation",
      target: "NotificationAutomation",
      action: "trigger",
      payload: { userId: "USR-123" },
      actor: "system"
    });

    const result = validator.validate(request);

    if (!result.targetExists) {
      throw new Error("Automation target should exist");
    }
  });

  // Test 10: Validator validates event emission
  suite.addTest("Validator validates event emission", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "event",
      target: "EventService",
      action: "emit",
      payload: { eventName: "ObjectCreated" },
      actor: "system"
    });

    const result = validator.validate(request);

    if (!result.actionExists) {
      throw new Error("Event action should exist");
    }
  });

  // Test 11: Validator validates lifecycle transition
  suite.addTest("Validator validates lifecycle transition", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "lifecycleTransition",
      target: "Company",
      action: "transition",
      payload: { currentState: "created", nextState: "initialized" },
      actor: "system"
    });

    const result = validator.validate(request);

    if (!result.lifecycleTransitionAllowed) {
      throw new Error("Valid lifecycle transition should be allowed");
    }
  });

  // Test 12: Validator rejects invalid lifecycle transition
  suite.addTest("Validator rejects invalid lifecycle transition", async () => {
    const validator = new ExecutionValidator();
    validator.loadManifest();

    const request = new ExecutionRequest({
      type: "lifecycleTransition",
      target: "Company",
      action: "transition",
      payload: { currentState: "created", nextState: "invalid" },
      actor: "system"
    });

    const result = validator.validate(request);

    if (result.lifecycleTransitionAllowed) {
      throw new Error("Invalid lifecycle transition should be rejected");
    }
  });

  // Test 13: Engine executes command with dry-run
  suite.addTest("Engine executes command with dry-run", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    const request = new ExecutionRequest({
      type: "command",
      target: "CompanyAPI",
      action: "create",
      payload: { name: "Test Company" },
      actor: "cli",
      dryRun: true
    });

    const response = await engine.execute(request);

    if (response.status !== "dryRun") {
      throw new Error(`Expected dryRun status, got ${response.status}`);
    }

    if (!response.dryRun) {
      throw new Error("Response should mark as dryRun");
    }

    if (!response.result) {
      throw new Error("Dry-run should return simulated result");
    }
  });

  // Test 14: Engine executes query
  suite.addTest("Engine executes query", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    const request = new ExecutionRequest({
      type: "query",
      target: "CustomerAPI",
      action: "list",
      payload: { limit: 10 },
      actor: "cli",
      dryRun: true
    });

    const response = await engine.execute(request);

    if (response.status !== "dryRun") {
      throw new Error("Query execution should succeed");
    }

    if (!response.result) {
      throw new Error("Query should return results");
    }
  });

  // Test 15: Engine tracks execution history
  suite.addTest("Engine tracks execution history", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    for (let i = 0; i < 3; i++) {
      await engine.execute({
        type: "command",
        target: "API",
        action: "test",
        payload: {},
        dryRun: true
      });
    }

    const history = engine.getHistory();
    if (history.length !== 3) {
      throw new Error(`Expected 3 executions, got ${history.length}`);
    }
  });

  // Test 16: Engine retrieves execution by ID
  suite.addTest("Engine retrieves execution by ID", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    const request = new ExecutionRequest({
      type: "workflow",
      target: "TestWorkflow",
      action: "execute",
      payload: {},
      dryRun: true
    });

    const response = await engine.execute(request);
    const retrieved = engine.getExecution(response.executionId);

    if (!retrieved) {
      throw new Error("Failed to retrieve execution by ID");
    }

    if (retrieved.executionId !== response.executionId) {
      throw new Error("Retrieved execution has different ID");
    }
  });

  // Test 17: Engine returns execution statistics
  suite.addTest("Engine returns execution statistics", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    // Execute several requests
    for (let i = 0; i < 5; i++) {
      await engine.execute({
        type: i % 2 === 0 ? "command" : "workflow",
        target: "API",
        action: "test",
        payload: {},
        dryRun: true
      });
    }

    const stats = engine.getStats();

    if (stats.total !== 5) {
      throw new Error(`Expected 5 total executions, got ${stats.total}`);
    }

    if (stats.dryRuns !== 5) {
      throw new Error(`Expected 5 dry-runs, got ${stats.dryRuns}`);
    }

    if (!stats.byType) {
      throw new Error("Statistics should include byType breakdown");
    }
  });

  // Test 18: Engine handles validation errors
  suite.addTest("Engine handles validation errors", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    // Request without required fields will fail validation
    const request = new ExecutionRequest({
      // Missing type
      target: "API",
      action: "execute",
      payload: {}
    });

    const response = await engine.execute(request);

    if (response.status !== "failed") {
      throw new Error("Should fail validation for missing type");
    }

    if (response.errors.length === 0) {
      throw new Error("Should have validation errors");
    }
  });

  // Test 19: Engine supports all execution types
  suite.addTest("Engine supports all execution types", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    const types = [
      "command",
      "query",
      "event",
      "workflow",
      "automation",
      "aiAgent",
      "lifecycleTransition"
    ];

    for (const type of types) {
      const payload =
        type === "lifecycleTransition"
          ? { currentState: "created", nextState: "initialized" }
          : {};

      const response = await engine.execute({
        type,
        target: "TestTarget",
        action: "execute",
        payload,
        dryRun: true
      });

      if (response.status !== "dryRun" && response.status !== "failed") {
        throw new Error(`Type '${type}' not properly handled`);
      }
    }
  });

  // Test 20: Execution response marks timing correctly
  suite.addTest("Execution response marks timing correctly", async () => {
    const engine = new RuntimeExecutionEngine();
    engine.initialize();

    const response = await engine.execute({
      type: "command",
      target: "API",
      action: "test",
      payload: {},
      dryRun: true
    });

    if (!response.startTime) {
      throw new Error("Response should have startTime");
    }

    if (!response.endTime) {
      throw new Error("Response should have endTime");
    }

    if (response.duration < 0) {
      throw new Error("Duration should be positive");
    }
  });

  return suite;
}
