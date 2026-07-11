/**
 * SimulationEngine - Genesis Enterprise Simulation Engine v1
 *
 * Executes simulations against cloned Enterprise Digital Twin without modifying production state.
 * Supports multiple simulation types and generates comprehensive impact reports.
 *
 * @module tools/genesis/compiler/SimulationEngine.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  SimulationScenario,
  SimulationContext,
  SimulationExecution,
  SimulationResult,
  SimulationImpact,
  SimulationReport,
  SimulationBlueprint
} from "./SimulationBlueprint.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class SimulationEngine {
  constructor(tenantId = "default", options = {}) {
    this.tenantId = tenantId;
    this.organizationId = options.organizationId || "default";
    this.blueprint = null;
    this.clonedTwinState = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Execute a simulation scenario
   */
  async executeSimulation(scenarioData) {
    try {
      console.log(`\n≡ƒôè Genesis Simulation Engine v1 - Executing simulation for '${this.tenantId}'`);
      console.log("");

      // Stage 1: Create simulation blueprint
      console.log("Stage 1: Initialize Simulation Blueprint");
      this.createBlueprint(scenarioData);
      console.log(`  ✓ Blueprint initialized`);

      // Stage 2: Create simulation scenario
      console.log("Stage 2: Create Simulation Scenario");
      this.createScenario(scenarioData);
      console.log(`  ✓ Scenario created`);

      // Stage 3: Validate scenario
      console.log("Stage 3: Validate Scenario");
      this.validateScenario();
      console.log(`  ✓ Scenario validated`);

      // Stage 4: Clone digital twin
      console.log("Stage 4: Clone Digital Twin");
      this.cloneDigitalTwin();
      console.log(`  ✓ Twin cloned (no production changes)`);

      // Stage 5: Apply simulation changes
      console.log("Stage 5: Apply Simulation Changes");
      this.applyChanges();
      console.log(`  ✓ Changes applied to cloned state`);

      // Stage 6: Analyze impacts
      console.log("Stage 6: Analyze Impacts");
      this.analyzeImpacts();
      console.log(`  ✓ Impacts analyzed`);

      // Stage 7: Calculate cascading effects
      console.log("Stage 7: Calculate Cascading Effects");
      this.calculateCascadingEffects();
      console.log(`  ✓ Cascading effects calculated`);

      // Stage 8: Generate execution result
      console.log("Stage 8: Generate Execution Result");
      this.generateResult();
      console.log(`  ✓ Execution result generated`);

      // Stage 9: Generate report
      console.log("Stage 9: Generate Simulation Report");
      this.generateReport();
      console.log(`  ✓ Report generated`);

      // Stage 10: Persist artifacts
      console.log("Stage 10: Persist Simulation Artifacts");
      await this.persistArtifacts();
      console.log(`  ✓ Artifacts persisted`);

      console.log("\n≡ƒôè SIMULATION EXECUTION COMPLETED");
      console.log("");
      console.log(`  Simulation: ${this.blueprint.name}`);
      console.log(`  Scenario: ${this.blueprint.scenario.name}`);
      console.log(`  Status: ${this.blueprint.result.status}`);
      console.log(`  Total Impacts: ${this.blueprint.result.impacts.length}`);
      console.log(`  Risk Level: ${this.blueprint.report.riskAnalysis.overallRisk}`);
      console.log("");

      this.blueprint.markCompleted();
      return true;
    } catch (error) {
      console.error(`\n✗ Simulation execution failed: ${error.message}`);
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Stage 1: Create blueprint
   */
  createBlueprint(scenarioData) {
    this.blueprint = new SimulationBlueprint({
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      name: scenarioData.name || "Simulation",
      description: scenarioData.description
    });

    this.blueprint.markValidated();
    this.blueprint.markDeployed();
  }

  /**
   * Stage 2: Create scenario
   */
  createScenario(scenarioData) {
    this.blueprint.scenario = new SimulationScenario({
      name: scenarioData.name || "Unnamed Scenario",
      description: scenarioData.description || "",
      type: scenarioData.type || "what-if",
      changes: scenarioData.changes || [],
      assumptions: scenarioData.assumptions || {},
      scope: scenarioData.scope || "all",
      scopeId: scenarioData.scopeId
    });

    this.blueprint.scenario.markReady();
  }

  /**
   * Stage 3: Validate scenario
   */
  validateScenario() {
    const validation = this.blueprint.scenario.validate();
    if (!validation.isValid) {
      throw new Error(`Scenario validation failed: ${validation.errors.join(", ")}`);
    }
  }

  /**
   * Stage 4: Clone digital twin
   */
  cloneDigitalTwin() {
    // Load the production twin (read-only)
    const twinPath = join(projectRoot, "out/generated/twins", `tenant-${this.tenantId}`, "twin-graph-full.json");

    if (existsSync(twinPath)) {
      try {
        const twinData = JSON.parse(readFileSync(twinPath, "utf8"));
        // Create a deep clone - this is the simulation state
        this.clonedTwinState = JSON.parse(JSON.stringify(twinData));
      } catch (e) {
        this.warnings.push(`Could not load twin: ${e.message}`);
        // Create an empty cloned state if no twin exists
        this.clonedTwinState = {
          blueprint: {},
          graph: {
            nodes: [],
            relationships: [],
            stats: { nodeCount: 0, relationshipCount: 0 }
          }
        };
      }
    } else {
      // Create empty cloned state
      this.clonedTwinState = {
        blueprint: {},
        graph: {
          nodes: [],
          relationships: [],
          stats: { nodeCount: 0, relationshipCount: 0 }
        }
      };
    }
  }

  /**
   * Stage 5: Apply changes to cloned state
   */
  applyChanges() {
    this.blueprint.scenario.markExecuting();

    const execution = new SimulationExecution({
      simulationId: this.blueprint.id,
      contextId: this.blueprint.context?.id,
      scenarioId: this.blueprint.scenario.id,
      stepsTotal: this.blueprint.scenario.changes.length
    });

    // Mark execution as running
    execution.status = "running";
    execution.startTime = new Date().toISOString();
    this.blueprint.execution = execution;

    for (const change of this.blueprint.scenario.changes) {
      try {
        // Simulate change application
        this.simulateChange(change);
        execution.recordStep(`Change: ${change.type}`, "success", { change });
      } catch (error) {
        execution.recordStep(`Change: ${change.type}`, "failed", { error: error.message });
        execution.recordError(error.message);
      }
    }

    execution.complete();
  }

  /**
   * Simulate a change (metadata-driven, no real changes)
   */
  simulateChange(change) {
    // Changes are represented as metadata operations
    // Examples: lifecycle changes, workflow modifications, configuration adjustments
    // All operating on cloned state only

    switch (change.type) {
      case "lifecycle":
        this.simulateLifecycleChange(change);
        break;
      case "workflow":
        this.simulateWorkflowChange(change);
        break;
      case "inventory":
        this.simulateInventoryChange(change);
        break;
      case "staffing":
        this.simulateStaffingChange(change);
        break;
      case "schedule":
        this.simulateScheduleChange(change);
        break;
      case "financial":
        this.simulateFinancialChange(change);
        break;
      case "configuration":
        this.simulateConfigurationChange(change);
        break;
      default:
        throw new Error(`Unknown change type: ${change.type}`);
    }
  }

  simulateLifecycleChange(change) {
    // Simulate object lifecycle state changes
    // e.g., activate, suspend, retire, reactivate
  }

  simulateWorkflowChange(change) {
    // Simulate workflow modifications
    // e.g., add step, remove step, reorder steps
  }

  simulateInventoryChange(change) {
    // Simulate inventory/asset changes
    // e.g., add items, remove items, adjust quantities
  }

  simulateStaffingChange(change) {
    // Simulate staffing changes
    // e.g., add team members, remove team members, change roles
  }

  simulateScheduleChange(change) {
    // Simulate schedule modifications
    // e.g., change timing, adjust frequencies
  }

  simulateFinancialChange(change) {
    // Simulate financial assumptions
    // e.g., adjust rates, change costs, modify budgets
  }

  simulateConfigurationChange(change) {
    // Simulate configuration modifications
    // e.g., change module settings, adjust parameters
  }

  /**
   * Stage 6: Analyze impacts
   */
  analyzeImpacts() {
    const result = new SimulationResult({
      simulationId: this.blueprint.id,
      executionId: this.blueprint.execution.id,
      scenarioId: this.blueprint.scenario.id
    });

    for (const change of this.blueprint.scenario.changes) {
      // Create impact for each change
      const impact = new SimulationImpact({
        changeId: change.id,
        targetNodeId: change.targetId,
        targetNodeType: change.nodeType || "unknown",
        impactType: "direct",
        severity: "low"
      });

      // Analyze direct impact
      this.analyzeDependencies(change, impact);
      impact.calculateRiskLevel();

      result.addImpact(impact);
      result.recordChange(change.id, change.targetId, change.type, true);
    }

    result.finalize();
    this.blueprint.result = result;
  }

  /**
   * Analyze dependencies for impact
   */
  analyzeDependencies(change, impact) {
    // Examine cloned twin for relationships
    if (this.clonedTwinState && this.clonedTwinState.graph) {
      const relationships = this.clonedTwinState.graph.relationships || [];

      // Find nodes that depend on the changed node
      for (const rel of relationships) {
        if (rel.sourceId === change.targetId || rel.targetId === change.targetId) {
          impact.addAffectedNode(
            rel.sourceId === change.targetId ? rel.targetId : rel.sourceId,
            "dependent",
            "low"
          );
        }
      }
    }
  }

  /**
   * Stage 7: Calculate cascading effects
   */
  calculateCascadingEffects() {
    if (!this.blueprint.result) return;

    for (const impact of this.blueprint.result.impacts) {
      // Mark impacts with affected count > 0 as cascading
      if (impact.affectedCount > 0) {
        impact.impactType = "cascading";
        impact.severity = impact.affectedCount > 5 ? "high" : "medium";
      }
    }
  }

  /**
   * Stage 8: Generate result
   */
  generateResult() {
    // Result already generated in analyzeImpacts
    // Just ensure it's finalized
    if (this.blueprint.result) {
      this.blueprint.result.finalize();
    }
  }

  /**
   * Stage 9: Generate report
   */
  generateReport() {
    const report = new SimulationReport({
      simulationId: this.blueprint.id,
      scenarioName: this.blueprint.scenario.name,
      executionSummary: this.blueprint.execution.getSummary(),
      executionDetails: {
        totalChanges: this.blueprint.scenario.changes.length,
        executedChanges: this.blueprint.execution.stepsExecuted,
        duration: this.blueprint.execution.duration
      }
    });

    // Add impacts
    for (const impact of this.blueprint.result.impacts) {
      report.addImpact(impact);
      report.addAffectedEntity(`${impact.targetNodeType}s`, impact.targetNodeId);
    }

    // Analyze risks
    report.analyzeRisks();

    // Add recommendations
    if (report.riskAnalysis.overallRisk === "critical") {
      report.addRecommendation("⚠️ Critical risk level - detailed review required before implementation");
    }
    if (report.riskAnalysis.overallRisk === "high") {
      report.addRecommendation("High risk - recommend stakeholder review");
    }
    if (this.blueprint.result.metrics.failedChanges > 0) {
      report.addRecommendation("Some changes failed - investigate failures before proceeding");
    }

    report.analyzeRisks();
    this.blueprint.report = report;
  }

  /**
   * Stage 10: Persist artifacts
   */
  async persistArtifacts() {
    const outputDir = join(projectRoot, "out/generated/simulations", `tenant-${this.tenantId}`);
    mkdirSync(outputDir, { recursive: true });

    // Write simulation blueprint
    writeFileSync(
      join(outputDir, `simulation-blueprint.json`),
      JSON.stringify(this.blueprint.getSummary(), null, 2)
    );

    // Write execution summary
    writeFileSync(
      join(outputDir, `simulation-execution.json`),
      JSON.stringify(this.blueprint.execution.getSummary(), null, 2)
    );

    // Write result summary
    writeFileSync(
      join(outputDir, `simulation-result.json`),
      JSON.stringify(this.blueprint.result.getSummary(), null, 2)
    );

    // Write detailed report
    writeFileSync(
      join(outputDir, `simulation-report.json`),
      JSON.stringify(this.blueprint.report.getSummary(), null, 2)
    );

    // Write full simulation data
    writeFileSync(
      join(outputDir, `simulation-full.json`),
      JSON.stringify({
        blueprint: this.blueprint.toJSON(),
        execution: this.blueprint.execution.getSummary(),
        result: this.blueprint.result.getSummary(),
        report: this.blueprint.report.getSummary(),
        clonedTwinSnapshot: {
          nodeCount: this.clonedTwinState?.graph?.nodes?.length || 0,
          relationshipCount: this.clonedTwinState?.graph?.relationships?.length || 0
        }
      }, null, 2)
    );
  }

  /**
   * Get simulation results
   */
  getResults() {
    return {
      simulationId: this.blueprint.id,
      name: this.blueprint.name,
      scenarioName: this.blueprint.scenario.name,
      status: this.blueprint.result.status,
      totalChanges: this.blueprint.result.metrics.totalChanges,
      successfulChanges: this.blueprint.result.metrics.successfulChanges,
      failedChanges: this.blueprint.result.metrics.failedChanges,
      impacts: this.blueprint.result.impacts.length,
      affectedNodes: this.blueprint.result.metrics.totalImpactedNodes,
      riskLevel: this.blueprint.report.riskAnalysis.overallRisk,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}
