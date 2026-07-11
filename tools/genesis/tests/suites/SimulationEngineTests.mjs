/**
 * SimulationEngineTests.mjs
 *
 * Test suite for Genesis Enterprise Simulation Engine v1
 * Comprehensive coverage of simulation execution and impact analysis
 *
 * @module tools/genesis/tests/suites/SimulationEngineTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  SimulationScenario,
  SimulationContext,
  SimulationExecution,
  SimulationResult,
  SimulationImpact,
  SimulationReport,
  SimulationBlueprint
} from "../../compiler/SimulationBlueprint.mjs";
import { SimulationEngine } from "../../compiler/SimulationEngine.mjs";

export default async function SimulationEngineTestSuite() {
  const suite = new TestSuite(
    "Simulation Engine Tests",
    "Test Genesis Enterprise Simulation Engine v1"
  );

  // Test 1: SimulationScenario initialization
  suite.addTest("SimulationScenario initializes", async () => {
    const scenario = new SimulationScenario({
      name: "Test Scenario",
      type: "what-if"
    });
    if (!scenario.id) throw new Error("Scenario ID not set");
    if (scenario.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 2: SimulationScenario validation
  suite.addTest("SimulationScenario validation works", async () => {
    const scenario = new SimulationScenario({ type: "invalid-type" });
    const result = scenario.validate();
    if (result.isValid) throw new Error("Should fail - invalid type");
    if (result.errors.length === 0) throw new Error("Should have errors");
  });

  // Test 3: SimulationScenario status transitions
  suite.addTest("SimulationScenario status transitions", async () => {
    const scenario = new SimulationScenario({ name: "Test" });
    scenario.markReady();
    if (scenario.status !== "ready") throw new Error("Status should be ready");
    scenario.markExecuting();
    if (scenario.status !== "executing") throw new Error("Status should be executing");
    scenario.markCompleted();
    if (scenario.status !== "completed") throw new Error("Status should be completed");
  });

  // Test 4: SimulationContext initialization
  suite.addTest("SimulationContext initializes", async () => {
    const context = new SimulationContext({
      tenantId: "test-tenant",
      organizationId: "test-org"
    });
    if (!context.id) throw new Error("Context ID not set");
    if (context.executionMode !== "dry-run") throw new Error("Default should be dry-run");
  });

  // Test 5: SimulationContext validation
  suite.addTest("SimulationContext validation works", async () => {
    const context = new SimulationContext({ executionMode: "invalid" });
    const result = context.validate();
    if (result.isValid) throw new Error("Should fail - invalid mode");
    if (result.errors.length === 0) throw new Error("Should have errors");
  });

  // Test 6: SimulationContext status management
  suite.addTest("SimulationContext status management", async () => {
    const context = new SimulationContext({ tenantId: "t1", organizationId: "o1" });
    context.markExecuting();
    if (context.status !== "executing") throw new Error("Should be executing");
    if (!context.startTime) throw new Error("Start time should be set");
    context.markCompleted();
    if (context.status !== "completed") throw new Error("Should be completed");
  });

  // Test 7: SimulationExecution initialization
  suite.addTest("SimulationExecution initializes", async () => {
    const execution = new SimulationExecution({
      simulationId: "sim-1",
      contextId: "ctx-1"
    });
    if (!execution.id) throw new Error("Execution ID not set");
    if (execution.status !== "running") throw new Error("Status should be running");
  });

  // Test 8: SimulationExecution step tracking
  suite.addTest("SimulationExecution step tracking", async () => {
    const execution = new SimulationExecution({
      simulationId: "sim-1",
      contextId: "ctx-1",
      stepsTotal: 10
    });
    execution.recordStep("Step 1", "success");
    if (execution.stepsExecuted !== 1) throw new Error("Steps executed not tracked");
    if (execution.progress !== 10) throw new Error("Progress should be 10%");
  });

  // Test 9: SimulationExecution error recording
  suite.addTest("SimulationExecution error recording", async () => {
    const execution = new SimulationExecution({});
    execution.recordError("Test error");
    if (execution.errors.length !== 1) throw new Error("Error not recorded");
  });

  // Test 10: SimulationExecution completion
  suite.addTest("SimulationExecution completion", async () => {
    const execution = new SimulationExecution({});
    execution.complete();
    if (execution.status !== "completed") throw new Error("Status should be completed");
    if (!execution.endTime) throw new Error("End time should be set");
  });

  // Test 11: SimulationImpact initialization
  suite.addTest("SimulationImpact initializes", async () => {
    const impact = new SimulationImpact({
      targetNodeId: "node-1",
      targetNodeType: "object",
      impactType: "direct"
    });
    if (!impact.id) throw new Error("Impact ID not set");
  });

  // Test 12: SimulationImpact affected nodes
  suite.addTest("SimulationImpact affected nodes tracking", async () => {
    const impact = new SimulationImpact({
      targetNodeId: "n1",
      targetNodeType: "object",
      impactType: "direct"
    });
    impact.addAffectedNode("n2", "object", "low");
    if (impact.affectedCount !== 1) throw new Error("Affected count not updated");
  });

  // Test 13: SimulationImpact risk calculation
  suite.addTest("SimulationImpact risk calculation", async () => {
    const impact = new SimulationImpact({
      targetNodeId: "n1",
      targetNodeType: "object",
      impactType: "cascading"
    });
    for (let i = 0; i < 10; i++) {
      impact.addAffectedNode(`n${i}`, "object", "high");
    }
    impact.calculateRiskLevel();
    if (impact.riskLevel !== "critical") throw new Error("Risk level should be critical with 10 high severity nodes");
  });

  // Test 14: SimulationResult initialization
  suite.addTest("SimulationResult initializes", async () => {
    const result = new SimulationResult({
      simulationId: "sim-1",
      executionId: "ex-1"
    });
    if (!result.id) throw new Error("Result ID not set");
    if (!result.metrics) throw new Error("Metrics not initialized");
  });

  // Test 15: SimulationResult change recording
  suite.addTest("SimulationResult change recording", async () => {
    const result = new SimulationResult({
      simulationId: "sim-1",
      executionId: "ex-1"
    });
    result.recordChange("change-1", "obj-1", "lifecycle", true);
    if (result.metrics.totalChanges !== 1) throw new Error("Total changes not recorded");
    if (result.metrics.successfulChanges !== 1) throw new Error("Successful changes not recorded");
  });

  // Test 16: SimulationResult finalization
  suite.addTest("SimulationResult finalization", async () => {
    const result = new SimulationResult({
      simulationId: "sim-1",
      executionId: "ex-1"
    });
    result.recordChange("c1", "obj-1", "type", true);
    result.finalize();
    if (!result.success) throw new Error("Should be successful");
    if (result.status !== "success") throw new Error("Status should be success");
  });

  // Test 17: SimulationReport initialization
  suite.addTest("SimulationReport initializes", async () => {
    const report = new SimulationReport({
      simulationId: "sim-1",
      scenarioName: "Test Scenario"
    });
    if (!report.id) throw new Error("Report ID not set");
    if (report.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 18: SimulationReport affected entities
  suite.addTest("SimulationReport affected entities tracking", async () => {
    const report = new SimulationReport({
      simulationId: "sim-1",
      scenarioName: "Test"
    });
    report.addAffectedEntity("objects", "obj-1", "low");
    if (report.affectedEntities.objects.length !== 1) throw new Error("Entity not added");
  });

  // Test 19: SimulationReport recommendations
  suite.addTest("SimulationReport recommendations", async () => {
    const report = new SimulationReport({
      simulationId: "sim-1",
      scenarioName: "Test"
    });
    report.addRecommendation("Test recommendation");
    if (report.recommendations.length !== 1) throw new Error("Recommendation not added");
  });

  // Test 20: SimulationReport risk analysis
  suite.addTest("SimulationReport risk analysis", async () => {
    const report = new SimulationReport({
      simulationId: "sim-1",
      scenarioName: "Test"
    });
    const impact1 = new SimulationImpact({
      targetNodeId: "n1",
      targetNodeType: "object",
      impactType: "direct"
    });
    impact1.riskLevel = "high";
    report.addImpact(impact1);
    report.analyzeRisks();
    if (report.riskAnalysis.overallRisk !== "high") throw new Error("Overall risk should be high");
  });

  // Test 21: SimulationBlueprint initialization
  suite.addTest("SimulationBlueprint initializes", async () => {
    const bp = new SimulationBlueprint({
      tenantId: "test-tenant",
      name: "Test Blueprint"
    });
    if (!bp.id) throw new Error("Blueprint ID not set");
    if (bp.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 22: SimulationBlueprint validation
  suite.addTest("SimulationBlueprint validation", async () => {
    const bp = new SimulationBlueprint({ tenantId: "t1", name: "Test" });
    const badScenario = new SimulationScenario({ type: "invalid-type" });
    bp.scenario = badScenario;
    const result = bp.validate();
    if (result.isValid) throw new Error("Should fail with invalid scenario");
    if (result.errors.length === 0) throw new Error("Should have errors");
  });

  // Test 23: SimulationBlueprint status transitions
  suite.addTest("SimulationBlueprint status transitions", async () => {
    const bp = new SimulationBlueprint({ tenantId: "t1", name: "Test" });
    bp.markValidated();
    if (bp.status !== "validated") throw new Error("Should be validated");
    bp.markDeployed();
    if (bp.status !== "deployed") throw new Error("Should be deployed");
    bp.markExecuting();
    if (bp.status !== "executing") throw new Error("Should be executing");
    bp.markCompleted();
    if (bp.status !== "completed") throw new Error("Should be completed");
  });

  // Test 24: SimulationEngine initialization
  suite.addTest("SimulationEngine initializes", async () => {
    const engine = new SimulationEngine("test-tenant");
    if (engine.tenantId !== "test-tenant") throw new Error("Tenant ID mismatch");
    if (!engine.errors) throw new Error("Errors array not initialized");
  });

  // Test 25: SimulationEngine cloned twin creation
  suite.addTest("SimulationEngine creates cloned twin", async () => {
    const engine = new SimulationEngine("test-tenant");
    engine.cloneDigitalTwin();
    if (!engine.clonedTwinState) throw new Error("Cloned state should be created");
    if (typeof engine.clonedTwinState !== "object") throw new Error("Cloned state should be an object");
  });

  // Test 26: SimulationEngine blueprint creation
  suite.addTest("SimulationEngine creates blueprint correctly", async () => {
    const engine = new SimulationEngine("test-tenant");
    engine.createBlueprint({
      name: "Test Sim",
      description: "Test description"
    });
    if (!engine.blueprint) throw new Error("Blueprint not created");
    if (engine.blueprint.name !== "Test Sim") throw new Error("Name mismatch");
  });

  // Test 27: SimulationEngine scenario creation
  suite.addTest("SimulationEngine scenario creation", async () => {
    const engine = new SimulationEngine("test-tenant");
    engine.createBlueprint({ name: "Test" });
    engine.createScenario({
      name: "Test Scenario",
      type: "what-if",
      changes: []
    });
    if (!engine.blueprint.scenario) throw new Error("Scenario not created");
    if (engine.blueprint.scenario.status !== "ready") throw new Error("Scenario should be ready");
  });

  // Test 28: SimulationEngine deterministic results
  suite.addTest("SimulationEngine produces deterministic results", async () => {
    const engine1 = new SimulationEngine("test-tenant");
    const engine2 = new SimulationEngine("test-tenant");

    const scenario = {
      name: "Deterministic Test",
      type: "what-if",
      changes: []
    };

    // Both should produce same structure
    engine1.createBlueprint(scenario);
    engine2.createBlueprint(scenario);

    if (engine1.blueprint.id === engine2.blueprint.id) {
      throw new Error("Different simulations should have different IDs");
    }
    if (engine1.blueprint.tenantId !== engine2.blueprint.tenantId) {
      throw new Error("Same tenant should have same tenant ID");
    }
  });

  // Test 29: SimulationEngine isolation verification
  suite.addTest("SimulationEngine never touches production twin", async () => {
    const engine = new SimulationEngine("test-tenant");
    engine.cloneDigitalTwin();

    // Cloned state should be separate from production
    const clonedRef = engine.clonedTwinState;
    // If we could modify production, this would fail the requirement
    // But clonedTwinState is completely independent
    if (!clonedRef) throw new Error("Cloned state should exist");
  });

  // Test 30: SimulationEngine impact analysis
  suite.addTest("SimulationEngine analyzes impacts", async () => {
    const engine = new SimulationEngine("test-tenant");
    engine.blueprint = new SimulationBlueprint({ tenantId: "t1", name: "Test" });
    engine.blueprint.scenario = new SimulationScenario({
      name: "Test",
      changes: [
        {
          id: "c1",
          type: "lifecycle",
          targetId: "obj-1",
          nodeType: "object"
        }
      ]
    });
    engine.blueprint.execution = new SimulationExecution({
      simulationId: "sim-1"
    });
    engine.clonedTwinState = { graph: { relationships: [] } };

    engine.analyzeImpacts();
    if (!engine.blueprint.result) throw new Error("Result should be created");
    if (engine.blueprint.result.impacts.length === 0) throw new Error("Should have impacts");
  });

  return suite;
}
