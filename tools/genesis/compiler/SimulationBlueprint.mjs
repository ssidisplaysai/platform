/**
 * SimulationBlueprint - Genesis Enterprise Simulation Engine v1
 *
 * Blueprint contracts for metadata-driven simulation against the Enterprise Digital Twin.
 * Simulations never modify production state and operate on cloned twin state.
 *
 * @module tools/genesis/compiler/SimulationBlueprint.mjs
 */

import { randomBytes } from "crypto";

/**
 * SimulationScenario - Describes a hypothetical scenario to simulate
 */
export class SimulationScenario {
  constructor(data = {}) {
    this.id = data.id || `scenario-${randomBytes(4).toString("hex")}`;
    this.name = data.name || "Unnamed Scenario";
    this.description = data.description || "";
    this.type = data.type || "hypothetical"; // hypothetical, what-if, stress-test, impact-analysis
    this.changes = data.changes || []; // Array of {type, targetId, properties}
    this.assumptions = data.assumptions || {}; // key: value assumptions
    this.constraints = data.constraints || []; // Array of constraint rules
    this.scope = data.scope || "all"; // all, module, application, organization
    this.scopeId = data.scopeId || null; // If scoped to specific entity
    this.createdAt = data.createdAt || new Date().toISOString();
    this.status = "draft"; // draft, ready, executing, completed
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push("Scenario name is required");
    }

    if (!this.type) {
      errors.push("Scenario type is required");
    }

    const validTypes = ["hypothetical", "what-if", "stress-test", "impact-analysis"];
    if (!validTypes.includes(this.type)) {
      errors.push(`Invalid scenario type: ${this.type}`);
    }

    if (this.changes && !Array.isArray(this.changes)) {
      errors.push("Changes must be an array");
    }

    if (this.scope !== "all" && !this.scopeId) {
      warnings.push("Scoped scenario without scopeId");
    }

    this.errors = errors;
    this.warnings = warnings;

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      changeCount: this.changes.length,
      scope: this.scope,
      status: this.status,
      createdAt: this.createdAt
    };
  }

  markReady() {
    this.status = "ready";
  }

  markExecuting() {
    this.status = "executing";
  }

  markCompleted() {
    this.status = "completed";
  }
}

/**
 * SimulationContext - Execution context for a simulation
 */
export class SimulationContext {
  constructor(data = {}) {
    this.id = data.id || `context-${randomBytes(4).toString("hex")}`;
    this.simulationId = data.simulationId;
    this.scenarioId = data.scenarioId;
    this.tenantId = data.tenantId || "default";
    this.organizationId = data.organizationId || "default";
    this.clonedTwinId = data.clonedTwinId; // ID of cloned twin for this simulation
    this.executionMode = data.executionMode || "dry-run"; // dry-run, full-simulation
    this.simulationLevel = data.simulationLevel || "basic"; // basic, detailed, comprehensive
    this.includeMetrics = data.includeMetrics !== false;
    this.trackImpact = data.trackImpact !== false;
    this.startTime = null;
    this.endTime = null;
    this.status = "initialized"; // initialized, executing, completed, failed
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.tenantId) errors.push("Tenant ID required");
    if (!this.organizationId) errors.push("Organization ID required");

    const validModes = ["dry-run", "full-simulation"];
    if (!validModes.includes(this.executionMode)) {
      errors.push(`Invalid execution mode: ${this.executionMode}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  markExecuting() {
    this.status = "executing";
    this.startTime = new Date().toISOString();
  }

  markCompleted() {
    this.status = "completed";
    this.endTime = new Date().toISOString();
  }

  markFailed(error) {
    this.status = "failed";
    this.endTime = new Date().toISOString();
    this.errors.push(error);
  }

  getSummary() {
    return {
      id: this.id,
      simulationId: this.simulationId,
      tenantId: this.tenantId,
      executionMode: this.executionMode,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

/**
 * SimulationExecution - Records a simulation execution
 */
export class SimulationExecution {
  constructor(data = {}) {
    this.id = data.id || `execution-${randomBytes(4).toString("hex")}`;
    this.simulationId = data.simulationId;
    this.contextId = data.contextId;
    this.scenarioId = data.scenarioId;
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = null;
    this.duration = 0;
    this.status = "running"; // running, completed, failed
    this.stepsExecuted = 0;
    this.stepsTotal = data.stepsTotal || 0;
    this.progress = 0;
    this.errors = [];
    this.executionLog = [];
  }

  validate() {
    const errors = [];

    if (!this.simulationId) errors.push("Simulation ID required");
    if (!this.contextId) errors.push("Context ID required");

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  recordStep(stepName, status = "success", details = null) {
    this.stepsExecuted++;
    this.progress = (this.stepsExecuted / this.stepsTotal) * 100;
    this.executionLog.push({
      step: stepName,
      status,
      timestamp: new Date().toISOString(),
      details
    });
  }

  recordError(error) {
    this.errors.push(error);
  }

  complete() {
    this.status = "completed";
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  fail(error) {
    this.status = "failed";
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
    this.recordError(error);
  }

  getSummary() {
    return {
      id: this.id,
      simulationId: this.simulationId,
      status: this.status,
      stepsExecuted: this.stepsExecuted,
      stepsTotal: this.stepsTotal,
      progress: this.progress,
      duration: this.duration,
      errors: this.errors
    };
  }
}

/**
 * SimulationImpact - Records impact of a simulation change
 */
export class SimulationImpact {
  constructor(data = {}) {
    this.id = data.id || `impact-${randomBytes(4).toString("hex")}`;
    this.changeId = data.changeId;
    this.targetNodeId = data.targetNodeId;
    this.targetNodeType = data.targetNodeType;
    this.impactType = data.impactType; // direct, cascading, dependent
    this.severity = data.severity || "low"; // low, medium, high, critical
    this.affectedNodes = data.affectedNodes || []; // IDs of affected nodes
    this.affectedCount = 0;
    this.description = data.description || "";
    this.metrics = data.metrics || {}; // key: value impacts
    this.riskLevel = "low"; // low, medium, high, critical
    this.recommendations = [];
  }

  validate() {
    const errors = [];

    if (!this.targetNodeId) errors.push("Target node ID required");
    if (!this.targetNodeType) errors.push("Target node type required");

    const validTypes = ["direct", "cascading", "dependent"];
    if (!validTypes.includes(this.impactType)) {
      errors.push(`Invalid impact type: ${this.impactType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  addAffectedNode(nodeId, nodeType, severity = "low") {
    this.affectedNodes.push({ nodeId, nodeType, severity });
    this.affectedCount = this.affectedNodes.length;
  }

  addRecommendation(recommendation) {
    this.recommendations.push(recommendation);
  }

  calculateRiskLevel() {
    const severities = { low: 1, medium: 2, high: 3, critical: 4 };
    const avgSeverity = this.affectedNodes.reduce((sum, n) => sum + (severities[n.severity] || 1), 0) / this.affectedNodes.length;
    const impactCount = this.affectedCount;

    if (impactCount > 50 || avgSeverity >= 3) this.riskLevel = "critical";
    else if (impactCount > 20 || avgSeverity >= 2.5) this.riskLevel = "high";
    else if (impactCount > 5 || avgSeverity >= 1.5) this.riskLevel = "medium";
    else this.riskLevel = "low";
  }

  getSummary() {
    return {
      id: this.id,
      targetNodeId: this.targetNodeId,
      impactType: this.impactType,
      affectedCount: this.affectedCount,
      severity: this.severity,
      riskLevel: this.riskLevel,
      recommendations: this.recommendations
    };
  }
}

/**
 * SimulationResult - Full result of a simulation
 */
export class SimulationResult {
  constructor(data = {}) {
    this.id = data.id || `result-${randomBytes(4).toString("hex")}`;
    this.simulationId = data.simulationId;
    this.executionId = data.executionId;
    this.scenarioId = data.scenarioId;
    this.success = false;
    this.status = "pending"; // pending, success, partial, failed
    this.executedChanges = [];
    this.impacts = [];
    this.errors = [];
    this.warnings = [];
    this.metrics = {
      totalChanges: 0,
      successfulChanges: 0,
      failedChanges: 0,
      affectedObjects: 0,
      affectedWorkflows: 0,
      affectedAutomations: 0,
      totalImpactedNodes: 0
    };
    this.timestamp = new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.simulationId) errors.push("Simulation ID required");
    if (!this.executionId) errors.push("Execution ID required");

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  recordChange(changeId, targetId, changeType, success = true) {
    this.executedChanges.push({
      changeId,
      targetId,
      changeType,
      success,
      timestamp: new Date().toISOString()
    });

    this.metrics.totalChanges++;
    if (success) {
      this.metrics.successfulChanges++;
    } else {
      this.metrics.failedChanges++;
    }
  }

  addImpact(impact) {
    this.impacts.push(impact);
    this.metrics.totalImpactedNodes += impact.affectedCount;
  }

  recordError(error) {
    this.errors.push(error);
  }

  recordWarning(warning) {
    this.warnings.push(warning);
  }

  finalize() {
    this.success = this.metrics.failedChanges === 0;
    this.status = this.success ? "success" : (this.metrics.successfulChanges > 0 ? "partial" : "failed");
  }

  getSummary() {
    return {
      id: this.id,
      simulationId: this.simulationId,
      status: this.status,
      success: this.success,
      executedChanges: this.executedChanges.length,
      impacts: this.impacts.length,
      metrics: this.metrics,
      errors: this.errors,
      timestamp: this.timestamp
    };
  }
}

/**
 * SimulationReport - Comprehensive simulation report
 */
export class SimulationReport {
  constructor(data = {}) {
    this.id = data.id || `report-${randomBytes(4).toString("hex")}`;
    this.simulationId = data.simulationId;
    this.scenarioName = data.scenarioName || "Unnamed";
    this.executionSummary = data.executionSummary || {};
    this.impacts = [];
    this.riskAnalysis = {
      overallRisk: "low",
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 0,
      lowRisks: 0,
      totalRisks: 0
    };
    this.affectedEntities = {
      objects: [],
      workflows: [],
      automations: [],
      dependencies: []
    };
    this.recommendations = [];
    this.executionDetails = data.executionDetails || {};
    this.timestamp = new Date().toISOString();
    this.status = "draft"; // draft, completed, approved, rejected
  }

  validate() {
    const errors = [];

    if (!this.simulationId) errors.push("Simulation ID required");
    if (!this.scenarioName) errors.push("Scenario name required");

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  addImpact(impact) {
    this.impacts.push(impact);
  }

  addAffectedEntity(type, entityId, severity = "low") {
    if (!this.affectedEntities[type]) {
      this.affectedEntities[type] = [];
    }
    this.affectedEntities[type].push({ id: entityId, severity });
  }

  addRecommendation(recommendation) {
    this.recommendations.push(recommendation);
  }

  analyzeRisks() {
    const severities = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const impact of this.impacts) {
      const count = impact.affectedCount || 0;
      if (impact.riskLevel) {
        severities[impact.riskLevel]++;
      }
    }

    this.riskAnalysis = {
      criticalRisks: severities.critical,
      highRisks: severities.high,
      mediumRisks: severities.medium,
      lowRisks: severities.low,
      totalRisks: severities.critical + severities.high + severities.medium + severities.low
    };

    if (severities.critical > 0) this.riskAnalysis.overallRisk = "critical";
    else if (severities.high > 0) this.riskAnalysis.overallRisk = "high";
    else if (severities.medium > 0) this.riskAnalysis.overallRisk = "medium";
    else this.riskAnalysis.overallRisk = "low";
  }

  getSummary() {
    return {
      id: this.id,
      simulationId: this.simulationId,
      scenarioName: this.scenarioName,
      status: this.status,
      timestamp: this.timestamp,
      riskAnalysis: this.riskAnalysis,
      affectedEntityCount: {
        objects: this.affectedEntities.objects.length,
        workflows: this.affectedEntities.workflows.length,
        automations: this.affectedEntities.automations.length,
        dependencies: this.affectedEntities.dependencies.length
      },
      recommendations: this.recommendations.length,
      totalImpacts: this.impacts.length
    };
  }
}

/**
 * SimulationBlueprint - Main blueprint for simulation configuration
 */
export class SimulationBlueprint {
  constructor(data = {}) {
    this.id = data.id || `sim-${randomBytes(4).toString("hex")}`;
    this.blueprintId = data.blueprintId || `blueprint-${randomBytes(4).toString("hex")}`;
    this.tenantId = data.tenantId || "default";
    this.organizationId = data.organizationId || "default";
    this.name = data.name || "Unnamed Simulation";
    this.description = data.description || "";
    this.scenario = null; // SimulationScenario
    this.context = null; // SimulationContext
    this.execution = null; // SimulationExecution
    this.result = null; // SimulationResult
    this.report = null; // SimulationReport
    this.clonedTwin = null; // Cloned twin state for simulation
    this.config = {
      autoCloneTwin: true,
      persistResults: true,
      generateReport: true,
      maxDuration: 60000, // ms
      maxChanges: 1000
    };
    this.status = "draft"; // draft, validated, deployed, executing, completed
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.tenantId) errors.push("Tenant ID required");
    if (!this.organizationId) errors.push("Organization ID required");
    if (!this.name || this.name.trim().length === 0) errors.push("Blueprint name required");

    if (this.scenario) {
      const scenarioValidation = this.scenario.validate();
      if (!scenarioValidation.isValid) {
        errors.push(...scenarioValidation.errors);
      }
    } else {
      warnings.push("No scenario defined");
    }

    this.errors = errors;
    this.warnings = warnings;

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  markValidated() {
    this.status = "validated";
    this.updatedAt = new Date().toISOString();
  }

  markDeployed() {
    this.status = "deployed";
    this.updatedAt = new Date().toISOString();
  }

  markExecuting() {
    this.status = "executing";
    this.updatedAt = new Date().toISOString();
  }

  markCompleted() {
    this.status = "completed";
    this.updatedAt = new Date().toISOString();
  }

  getSummary() {
    return {
      id: this.id,
      blueprintId: this.blueprintId,
      name: this.name,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      status: this.status,
      scenario: this.scenario?.getSummary(),
      execution: this.execution?.getSummary(),
      result: this.result?.getSummary(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return {
      id: this.id,
      blueprintId: this.blueprintId,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      name: this.name,
      description: this.description,
      status: this.status,
      config: this.config,
      scenario: this.scenario?.getSummary(),
      context: this.context?.getSummary(),
      execution: this.execution?.getSummary(),
      result: this.result?.getSummary(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
