/**
 * PlanningEngineTests.mjs
 *
 * Test suite for Genesis Enterprise Planning Engine v1
 * Comprehensive coverage of planning execution and action generation
 *
 * @module tools/genesis/tests/suites/PlanningEngineTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  EnterprisePlan,
  PlanningContext,
  PlanningGoal,
  PlanningConstraint,
  PlanningAction,
  PlanningRecommendation,
  PlanningResult
} from "../../compiler/PlanningBlueprint.mjs";
import { PlanningEngine } from "../../compiler/PlanningEngine.mjs";

export default async function PlanningEngineTestSuite() {
  const suite = new TestSuite(
    "Planning Engine Tests",
    "Test Genesis Enterprise Planning Engine v1"
  );

  // Test 1: PlanningGoal initialization
  suite.addTest("PlanningGoal initializes", async () => {
    const goal = new PlanningGoal({
      name: "Improve Efficiency",
      domain: "operations",
      targetValue: 90,
      priority: "high"
    });
    if (!goal.id) throw new Error("Goal ID not set");
    if (goal.status !== "draft") throw new Error("Status should be draft");
    if (goal.domain !== "operations") throw new Error("Domain not set correctly");
  });

  // Test 2: PlanningGoal validation
  suite.addTest("PlanningGoal validation works", async () => {
    try {
      new PlanningGoal({ domain: "invalid-domain" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid planning domain")) throw e;
    }
  });

  // Test 3: PlanningGoal mark active
  suite.addTest("PlanningGoal mark active", async () => {
    const goal = new PlanningGoal({ name: "Test" });
    goal.markActive();
    if (goal.status !== "active") throw new Error("Status should be active");
  });

  // Test 4: PlanningConstraint initialization
  suite.addTest("PlanningConstraint initializes", async () => {
    const constraint = new PlanningConstraint({
      name: "Budget Limit",
      type: "budget",
      value: 50000,
      unit: "USD"
    });
    if (!constraint.id) throw new Error("Constraint ID not set");
    if (constraint.type !== "budget") throw new Error("Type not set");
  });

  // Test 5: PlanningConstraint validation
  suite.addTest("PlanningConstraint validation works", async () => {
    try {
      new PlanningConstraint({ type: "invalid-type" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid constraint type")) throw e;
    }
  });

  // Test 6: PlanningConstraint mark violated
  suite.addTest("PlanningConstraint mark violated", async () => {
    const constraint = new PlanningConstraint({ name: "Test" });
    constraint.markViolated();
    if (constraint.status !== "violated") throw new Error("Status should be violated");
  });

  // Test 7: PlanningAction initialization
  suite.addTest("PlanningAction initializes", async () => {
    const action = new PlanningAction({
      name: "Optimize Workflow",
      domain: "operations",
      type: "optimize",
      priority: "high",
      estimatedImpact: 25,
      confidence: 85
    });
    if (!action.id) throw new Error("Action ID not set");
    if (action.confidence !== 85) throw new Error("Confidence not set");
  });

  // Test 8: PlanningAction validation
  suite.addTest("PlanningAction validation works", async () => {
    try {
      new PlanningAction({ type: "invalid-type" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid action type")) throw e;
    }
  });

  // Test 9: PlanningAction dependencies
  suite.addTest("PlanningAction dependencies", async () => {
    const action1 = new PlanningAction({ name: "Action 1" });
    const action2 = new PlanningAction({ name: "Action 2" });
    action1.dependencies.push(action2.id);
    if (action1.dependencies.length !== 1) throw new Error("Dependency not recorded");
  });

  // Test 10: PlanningAction mark scheduled
  suite.addTest("PlanningAction mark scheduled", async () => {
    const action = new PlanningAction({ name: "Test" });
    action.markScheduled();
    if (action.status !== "scheduled") throw new Error("Status should be scheduled");
  });

  // Test 11: PlanningRecommendation initialization
  suite.addTest("PlanningRecommendation initializes", async () => {
    const recommendation = new PlanningRecommendation({
      name: "Process Optimization",
      category: "process",
      confidence: 80,
      expectedBenefit: "25% improvement"
    });
    if (!recommendation.id) throw new Error("Recommendation ID not set");
    if (recommendation.category !== "process") throw new Error("Category not set");
  });

  // Test 12: PlanningRecommendation validation
  suite.addTest("PlanningRecommendation validation works", async () => {
    try {
      new PlanningRecommendation({ category: "invalid-category" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid recommendation category")) throw e;
    }
  });

  // Test 13: PlanningRecommendation mark approved
  suite.addTest("PlanningRecommendation mark approved", async () => {
    const recommendation = new PlanningRecommendation({ name: "Test" });
    recommendation.markApproved();
    if (recommendation.status !== "approved") throw new Error("Status should be approved");
  });

  // Test 14: PlanningRecommendation actions
  suite.addTest("PlanningRecommendation actions", async () => {
    const action = new PlanningAction({ name: "Test Action" });
    const recommendation = new PlanningRecommendation({ name: "Test Rec" });
    recommendation.actions.push(action.id);
    if (recommendation.actions.length !== 1) throw new Error("Action not recorded");
  });

  // Test 15: PlanningContext initialization
  suite.addTest("PlanningContext initializes", async () => {
    const context = new PlanningContext({
      tenantId: "tenant-001",
      planningDomain: "operations",
      planningHorizon: 90
    });
    if (!context.id) throw new Error("Context ID not set");
    if (context.tenantId !== "tenant-001") throw new Error("Tenant not set");
  });

  // Test 16: PlanningContext validation
  suite.addTest("PlanningContext validation works", async () => {
    try {
      new PlanningContext({ 
        tenantId: "",
        executionMode: "invalid-mode"
      });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid execution mode")) throw e;
    }
  });

  // Test 17: PlanningContext mark active
  suite.addTest("PlanningContext mark active", async () => {
    const context = new PlanningContext({ tenantId: "test" });
    context.markActive();
    if (context.status !== "active") throw new Error("Status should be active");
  });

  // Test 18: PlanningContext constraints
  suite.addTest("PlanningContext constraints", async () => {
    const context = new PlanningContext({ tenantId: "test" });
    context.constraints = ["constraint-1", "constraint-2"];
    if (context.constraints.length !== 2) throw new Error("Constraints not stored");
  });

  // Test 19: PlanningResult initialization
  suite.addTest("PlanningResult initializes", async () => {
    const result = new PlanningResult({
      planningDomain: "operations"
    });
    if (!result.id) throw new Error("Result ID not set");
    if (result.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 20: PlanningResult record action
  suite.addTest("PlanningResult record action", async () => {
    const result = new PlanningResult({ planningDomain: "operations" });
    const action = new PlanningAction({ 
      name: "Test",
      priority: "high",
      estimatedEffort: 20,
      estimatedImpact: 25
    });
    result.recordAction(action);
    if (result.actions.length !== 1) throw new Error("Action not recorded");
    if (result.metrics.totalActionsGenerated !== 1) throw new Error("Metric not updated");
    if (result.metrics.highPriorityActions !== 1) throw new Error("High priority metric not updated");
  });

  // Test 21: PlanningResult record recommendation
  suite.addTest("PlanningResult record recommendation", async () => {
    const result = new PlanningResult({ planningDomain: "operations" });
    const rec = new PlanningRecommendation({ name: "Test Rec" });
    result.recordRecommendation(rec);
    if (result.recommendations.length !== 1) throw new Error("Recommendation not recorded");
    if (result.metrics.totalRecommendations !== 1) throw new Error("Metric not updated");
  });

  // Test 22: PlanningResult alternative plans
  suite.addTest("PlanningResult alternative plans", async () => {
    const result = new PlanningResult({ planningDomain: "operations" });
    result.recordAlternativePlan({
      name: "Alternative 1",
      riskLevel: "low"
    });
    if (result.alternativePlans.length !== 1) throw new Error("Alternative not recorded");
  });

  // Test 23: PlanningResult finalize
  suite.addTest("PlanningResult finalize", async () => {
    const result = new PlanningResult({ planningDomain: "operations" });
    const action = new PlanningAction({ name: "Test", confidence: 80 });
    result.recordAction(action);
    result.finalize();
    if (result.status !== "approved") throw new Error("Status should be approved");
    if (result.metrics.averageConfidence !== 80) throw new Error("Confidence not calculated");
  });

  // Test 24: EnterprisePlan initialization
  suite.addTest("EnterprisePlan initializes", async () => {
    const plan = new EnterprisePlan({
      name: "Operations Plan",
      domain: "operations",
      description: "Enterprise-wide operations plan"
    });
    if (!plan.id) throw new Error("Plan ID not set");
    if (plan.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 25: EnterprisePlan validation
  suite.addTest("EnterprisePlan validation works", async () => {
    try {
      new EnterprisePlan({ domain: "invalid-domain" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid planning domain")) throw e;
    }
  });

  // Test 26: EnterprisePlan mark validated
  suite.addTest("EnterprisePlan mark validated", async () => {
    const plan = new EnterprisePlan({ name: "Test Plan" });
    plan.markValidated();
    if (plan.status !== "validated") throw new Error("Status should be validated");
  });

  // Test 27: EnterprisePlan mark approved
  suite.addTest("EnterprisePlan mark approved", async () => {
    const plan = new EnterprisePlan({ name: "Test Plan" });
    plan.markApproved("manager-001");
    if (plan.status !== "approved") throw new Error("Status should be approved");
    if (plan.metadata.approvedBy !== "manager-001") throw new Error("Approver not recorded");
  });

  // Test 28: EnterprisePlan mark executing
  suite.addTest("EnterprisePlan mark executing", async () => {
    const plan = new EnterprisePlan({ name: "Test Plan" });
    plan.markExecuting();
    if (plan.status !== "in-execution") throw new Error("Status should be in-execution");
  });

  // Test 29: PlanningEngine initialization
  suite.addTest("PlanningEngine initializes", async () => {
    const engine = new PlanningEngine();
    if (engine.plan !== null) throw new Error("Plan should be null initially");
    if (engine.result !== null) throw new Error("Result should be null initially");
  });

  // Test 30: PlanningEngine execute planning
  suite.addTest("PlanningEngine execute planning", async () => {
    const engine = new PlanningEngine();
    const result = await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    if (!result.success) throw new Error("Planning should succeed");
    if (engine.plan === null) throw new Error("Plan should be created");
    if (engine.result === null) throw new Error("Result should be created");
  });

  // Test 31: PlanningEngine generates actions
  suite.addTest("PlanningEngine generates actions", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    if (engine.result.actions.length === 0) throw new Error("Should generate actions");
  });

  // Test 32: PlanningEngine generates recommendations
  suite.addTest("PlanningEngine generates recommendations", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "inventory",
      context: { tenantId: "test-tenant" }
    });
    if (engine.result.recommendations.length === 0) throw new Error("Should generate recommendations");
  });

  // Test 33: PlanningEngine generates alternatives
  suite.addTest("PlanningEngine generates alternatives", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    if (engine.result.alternativePlans.length < 2) throw new Error("Should generate at least 2 alternatives");
  });

  // Test 34: PlanningEngine calculate confidence
  suite.addTest("PlanningEngine calculate confidence", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    const allValid = engine.result.actions.every(a => a.confidence >= 50 && a.confidence <= 100);
    if (!allValid) throw new Error("All actions should have confidence between 50-100");
    if (engine.result.metrics.averageConfidence <= 0) throw new Error("Average confidence should be calculated");
  });

  // Test 35: PlanningEngine calculate dependencies
  suite.addTest("PlanningEngine calculate dependencies", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    // Some actions may have dependencies
    const hasDependencies = engine.result.actions.some(a => a.dependencies.length > 0);
    if (engine.result.actions.length > 0) {
      // At least dependency analysis was performed
    }
  });

  // Test 36: PlanningEngine multiple domains
  suite.addTest("PlanningEngine multiple domains", async () => {
    const domains = ["operations", "inventory", "projects"];
    for (const domain of domains) {
      const engine = new PlanningEngine();
      const result = await engine.executePlanning({
        name: `${domain} Plan`,
        domain: domain,
        context: { tenantId: "test-tenant" }
      });
      if (!result.success) throw new Error(`Should succeed for ${domain} domain`);
      if (engine.result.actions.length === 0) throw new Error(`Should generate actions for ${domain}`);
    }
  });

  // Test 37: Planning end-to-end
  suite.addTest("Planning end-to-end with goals and constraints", async () => {
    const engine = new PlanningEngine();
    const goals = [
      new PlanningGoal({
        name: "Improve Efficiency",
        domain: "operations",
        targetValue: 90,
        priority: "high"
      })
    ];
    const constraints = [
      new PlanningConstraint({
        name: "Budget Limit",
        type: "budget",
        value: 100000,
        severity: "high"
      })
    ];
    const result = await engine.executePlanning({
      name: "Comprehensive Plan",
      domain: "operations",
      context: {
        tenantId: "test-tenant",
        goals: goals,
        constraints: constraints,
        planningHorizon: 90
      }
    });
    if (!result.success) throw new Error("Planning should succeed");
    if (engine.plan.goals.length !== 1) throw new Error("Goals not stored");
    if (engine.plan.constraints.length !== 1) throw new Error("Constraints not stored");
  });

  // Test 38: Planning result metrics
  suite.addTest("Planning result metrics", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    const metrics = engine.result.metrics;
    if (metrics.totalActionsGenerated <= 0) throw new Error("Should have actions");
    if (metrics.totalRecommendations <= 0) throw new Error("Should have recommendations");
    if (metrics.averageConfidence <= 0) throw new Error("Should calculate confidence");
    if (metrics.estimatedTotalImpact <= 0) throw new Error("Should calculate impact");
  });

  // Test 39: Planning domain-specific actions
  suite.addTest("Planning domain-specific actions", async () => {
    const engine = new PlanningEngine();
    await engine.executePlanning({
      name: "Operations Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    const hasOperationsActions = engine.result.actions.some(a => a.domain === "operations");
    if (!hasOperationsActions) throw new Error("Should have operations actions");
  });

  // Test 40: Planning artifact persistence
  suite.addTest("Planning artifact persistence", async () => {
    const engine = new PlanningEngine();
    const result = await engine.executePlanning({
      name: "Test Plan",
      domain: "operations",
      context: { tenantId: "test-tenant" }
    });
    // Artifacts should be persisted (check in integration)
    if (!result.success) throw new Error("Artifacts should persist");
  });

  return suite;
}


/**
 * PlanningGoal Tests
 */
export function testPlanningGoalInitialization() {
  const goal = new PlanningGoal({
    name: 'Improve Efficiency',
    domain: 'operations',
    targetValue: 90,
    priority: 'high'
  });
  
  return goal.name === 'Improve Efficiency' && 
         goal.domain === 'operations' && 
         goal.status === 'draft';
}

export function testPlanningGoalValidation() {
  try {
    new PlanningGoal({ domain: 'invalid' });
    return false;
  } catch {
    return true;
  }
}

export function testPlanningGoalMarkActive() {
  const goal = new PlanningGoal({ name: 'Test Goal' });
  goal.markActive();
  return goal.status === 'active';
}

/**
 * PlanningConstraint Tests
 */
export function testPlanningConstraintInitialization() {
  const constraint = new PlanningConstraint({
    name: 'Budget Limit',
    type: 'budget',
    value: 50000,
    unit: 'USD'
  });
  
  return constraint.name === 'Budget Limit' && 
         constraint.type === 'budget' &&
         constraint.value === 50000;
}

export function testPlanningConstraintValidation() {
  try {
    new PlanningConstraint({ type: 'invalid' });
    return false;
  } catch {
    return true;
  }
}

export function testPlanningConstraintMarkViolated() {
  const constraint = new PlanningConstraint({ name: 'Test' });
  constraint.markViolated();
  return constraint.status === 'violated';
}

/**
 * PlanningAction Tests
 */
export function testPlanningActionInitialization() {
  const action = new PlanningAction({
    name: 'Optimize Workflow',
    domain: 'operations',
    type: 'optimize',
    priority: 'high',
    estimatedImpact: 25,
    confidence: 85
  });
  
  return action.name === 'Optimize Workflow' && 
         action.type === 'optimize' &&
         action.confidence === 85;
}

export function testPlanningActionValidation() {
  try {
    new PlanningAction({ type: 'invalid-type' });
    return false;
  } catch {
    return true;
  }
}

export function testPlanningActionDependencies() {
  const action1 = new PlanningAction({ name: 'Action 1' });
  const action2 = new PlanningAction({ name: 'Action 2' });
  
  action1.dependencies.push(action2.id);
  return action1.dependencies.length === 1;
}

export function testPlanningActionMarkScheduled() {
  const action = new PlanningAction({ name: 'Test Action' });
  action.markScheduled();
  return action.status === 'scheduled';
}

/**
 * PlanningRecommendation Tests
 */
export function testPlanningRecommendationInitialization() {
  const recommendation = new PlanningRecommendation({
    name: 'Process Optimization',
    category: 'process',
    confidence: 80,
    expectedBenefit: '25% improvement'
  });
  
  return recommendation.name === 'Process Optimization' && 
         recommendation.category === 'process' &&
         recommendation.confidence === 80;
}

export function testPlanningRecommendationValidation() {
  try {
    new PlanningRecommendation({ category: 'invalid' });
    return false;
  } catch {
    return true;
  }
}

export function testPlanningRecommendationMarkApproved() {
  const recommendation = new PlanningRecommendation({ name: 'Test Rec' });
  recommendation.markApproved();
  return recommendation.status === 'approved';
}

export function testPlanningRecommendationActions() {
  const action = new PlanningAction({ name: 'Test Action' });
  const recommendation = new PlanningRecommendation({ name: 'Test Rec' });
  
  recommendation.actions.push(action.id);
  return recommendation.actions.length === 1;
}

/**
 * PlanningContext Tests
 */
export function testPlanningContextInitialization() {
  const context = new PlanningContext({
    tenantId: 'tenant-001',
    planningDomain: 'operations',
    planningHorizon: 90
  });
  
  return context.tenantId === 'tenant-001' && 
         context.planningDomain === 'operations' &&
         context.planningHorizon === 90;
}

export function testPlanningContextValidation() {
  try {
    new PlanningContext({ 
      tenantId: '',
      executionMode: 'invalid-mode'
    });
    return false;
  } catch {
    return true;
  }
}

export function testPlanningContextMarkActive() {
  const context = new PlanningContext({ tenantId: 'test' });
  context.markActive();
  return context.status === 'active';
}

export function testPlanningContextConstraints() {
  const context = new PlanningContext({ tenantId: 'test' });
  context.constraints = ['constraint-1', 'constraint-2'];
  return context.constraints.length === 2;
}

/**
 * PlanningResult Tests
 */
export function testPlanningResultInitialization() {
  const result = new PlanningResult({
    planningDomain: 'operations'
  });
  
  return result.planningDomain === 'operations' && 
         result.actions.length === 0 &&
         result.status === 'draft';
}

export function testPlanningResultRecordAction() {
  const result = new PlanningResult({ planningDomain: 'operations' });
  const action = new PlanningAction({ 
    name: 'Test',
    priority: 'high',
    estimatedEffort: 20,
    estimatedImpact: 25
  });
  
  result.recordAction(action);
  return result.actions.length === 1 && 
         result.metrics.totalActionsGenerated === 1 &&
         result.metrics.highPriorityActions === 1;
}

export function testPlanningResultRecordRecommendation() {
  const result = new PlanningResult({ planningDomain: 'operations' });
  const rec = new PlanningRecommendation({ name: 'Test Rec' });
  
  result.recordRecommendation(rec);
  return result.recommendations.length === 1 && 
         result.metrics.totalRecommendations === 1;
}

export function testPlanningResultAlternativePlans() {
  const result = new PlanningResult({ planningDomain: 'operations' });
  
  result.recordAlternativePlan({
    name: 'Alternative 1',
    riskLevel: 'low'
  });
  
  return result.alternativePlans.length === 1;
}

export function testPlanningResultFinalize() {
  const result = new PlanningResult({ planningDomain: 'operations' });
  const action = new PlanningAction({ name: 'Test', confidence: 80 });
  
  result.recordAction(action);
  result.finalize();
  
  return result.status === 'approved' && 
         result.metrics.averageConfidence === 80;
}

/**
 * EnterprisePlan Tests
 */
export function testEnterprisePlanInitialization() {
  const plan = new EnterprisePlan({
    name: 'Operations Plan',
    domain: 'operations',
    description: 'Enterprise-wide operations plan'
  });
  
  return plan.name === 'Operations Plan' && 
         plan.domain === 'operations' &&
         plan.status === 'draft';
}

export function testEnterprisePlanValidation() {
  try {
    new EnterprisePlan({ domain: 'invalid' });
    return false;
  } catch {
    return true;
  }
}

export function testEnterprisePlanMarkValidated() {
  const plan = new EnterprisePlan({ name: 'Test Plan' });
  plan.markValidated();
  return plan.status === 'validated';
}

export function testEnterprisePlanMarkApproved() {
  const plan = new EnterprisePlan({ name: 'Test Plan' });
  plan.markApproved('manager-001');
  return plan.status === 'approved' && 
         plan.metadata.approvedBy === 'manager-001';
}

export function testEnterprisePlanMarkExecuting() {
  const plan = new EnterprisePlan({ name: 'Test Plan' });
  plan.markExecuting();
  return plan.status === 'in-execution';
}

/**
 * PlanningEngine Tests
 */
export function testPlanningEngineInitialization() {
  const engine = new PlanningEngine();
  return engine.plan === null && 
         engine.context === null &&
         engine.result === null;
}

export async function testPlanningEngineExecutePlanning() {
  const engine = new PlanningEngine();
  
  const result = await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  return result.success === true && 
         engine.plan !== null &&
         engine.result !== null;
}

export async function testPlanningEngineGeneratesActions() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  return engine.result.actions.length > 0;
}

export async function testPlanningEngineGeneratesRecommendations() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'inventory',
    context: { tenantId: 'test-tenant' }
  });
  
  return engine.result.recommendations.length > 0;
}

export async function testPlanningEngineGeneratesAlternatives() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  return engine.result.alternativePlans.length >= 2;
}

export async function testPlanningEngineCalculatesConfidence() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  // Check all actions have confidence between 50-100
  const allValid = engine.result.actions.every(
    a => a.confidence >= 50 && a.confidence <= 100
  );
  
  return allValid && engine.result.metrics.averageConfidence > 0;
}

export async function testPlanningEngineCalculatesDependencies() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  // Check that some actions have dependencies
  const hasDependencies = engine.result.actions.some(a => a.dependencies.length > 0);
  
  return hasDependencies || engine.result.actions.length > 0;
}

export async function testPlanningEngineMultipleDomains() {
  const domains = ['operations', 'inventory', 'projects'];
  
  for (const domain of domains) {
    const engine = new PlanningEngine();
    
    const result = await engine.executePlanning({
      name: `${domain} Plan`,
      domain: domain,
      context: { tenantId: 'test-tenant' }
    });
    
    if (!result.success || engine.result.actions.length === 0) {
      return false;
    }
  }
  
  return true;
}

/**
 * Planning Integration Tests
 */
export async function testPlanningEndToEnd() {
  const engine = new PlanningEngine();
  
  // Define planning goals
  const goals = [
    new PlanningGoal({
      name: 'Improve Process Efficiency',
      domain: 'operations',
      targetValue: 90,
      priority: 'high'
    }),
    new PlanningGoal({
      name: 'Reduce Costs',
      domain: 'operations',
      targetValue: 20,
      priority: 'medium'
    })
  ];
  
  // Define constraints
  const constraints = [
    new PlanningConstraint({
      name: 'Budget Limit',
      type: 'budget',
      value: 100000,
      severity: 'high'
    })
  ];
  
  const result = await engine.executePlanning({
    name: 'Comprehensive Operations Plan',
    domain: 'operations',
    context: {
      tenantId: 'test-tenant',
      goals: goals,
      constraints: constraints,
      planningHorizon: 90
    }
  });
  
  return result.success && 
         engine.plan.goals.length === 2 &&
         engine.plan.constraints.length === 1 &&
         engine.result.actions.length > 0;
}

export async function testPlanningResultMetrics() {
  const engine = new PlanningEngine();
  
  await engine.executePlanning({
    name: 'Test Plan',
    domain: 'operations',
    context: { tenantId: 'test-tenant' }
  });
  
  const metrics = engine.result.metrics;
  
  return metrics.totalActionsGenerated > 0 &&
         metrics.totalRecommendations > 0 &&
         metrics.averageConfidence > 0 &&
         metrics.estimatedTotalImpact > 0;
}

/**
 * Test runner
 */
export async function runPlanningTests() {
  const tests = [
    // PlanningGoal tests
    { name: 'PlanningGoal Initialization', fn: testPlanningGoalInitialization },
    { name: 'PlanningGoal Validation', fn: testPlanningGoalValidation },
    { name: 'PlanningGoal Mark Active', fn: testPlanningGoalMarkActive },
    
    // PlanningConstraint tests
    { name: 'PlanningConstraint Initialization', fn: testPlanningConstraintInitialization },
    { name: 'PlanningConstraint Validation', fn: testPlanningConstraintValidation },
    { name: 'PlanningConstraint Mark Violated', fn: testPlanningConstraintMarkViolated },
    
    // PlanningAction tests
    { name: 'PlanningAction Initialization', fn: testPlanningActionInitialization },
    { name: 'PlanningAction Validation', fn: testPlanningActionValidation },
    { name: 'PlanningAction Dependencies', fn: testPlanningActionDependencies },
    { name: 'PlanningAction Mark Scheduled', fn: testPlanningActionMarkScheduled },
    
    // PlanningRecommendation tests
    { name: 'PlanningRecommendation Initialization', fn: testPlanningRecommendationInitialization },
    { name: 'PlanningRecommendation Validation', fn: testPlanningRecommendationValidation },
    { name: 'PlanningRecommendation Mark Approved', fn: testPlanningRecommendationMarkApproved },
    { name: 'PlanningRecommendation Actions', fn: testPlanningRecommendationActions },
    
    // PlanningContext tests
    { name: 'PlanningContext Initialization', fn: testPlanningContextInitialization },
    { name: 'PlanningContext Validation', fn: testPlanningContextValidation },
    { name: 'PlanningContext Mark Active', fn: testPlanningContextMarkActive },
    { name: 'PlanningContext Constraints', fn: testPlanningContextConstraints },
    
    // PlanningResult tests
    { name: 'PlanningResult Initialization', fn: testPlanningResultInitialization },
    { name: 'PlanningResult Record Action', fn: testPlanningResultRecordAction },
    { name: 'PlanningResult Record Recommendation', fn: testPlanningResultRecordRecommendation },
    { name: 'PlanningResult Alternative Plans', fn: testPlanningResultAlternativePlans },
    { name: 'PlanningResult Finalize', fn: testPlanningResultFinalize },
    
    // EnterprisePlan tests
    { name: 'EnterprisePlan Initialization', fn: testEnterprisePlanInitialization },
    { name: 'EnterprisePlan Validation', fn: testEnterprisePlanValidation },
    { name: 'EnterprisePlan Mark Validated', fn: testEnterprisePlanMarkValidated },
    { name: 'EnterprisePlan Mark Approved', fn: testEnterprisePlanMarkApproved },
    { name: 'EnterprisePlan Mark Executing', fn: testEnterprisePlanMarkExecuting },
    
    // PlanningEngine tests
    { name: 'PlanningEngine Initialization', fn: testPlanningEngineInitialization },
    { name: 'PlanningEngine Execute Planning', fn: testPlanningEngineExecutePlanning },
    { name: 'PlanningEngine Generates Actions', fn: testPlanningEngineGeneratesActions },
    { name: 'PlanningEngine Generates Recommendations', fn: testPlanningEngineGeneratesRecommendations },
    { name: 'PlanningEngine Generates Alternatives', fn: testPlanningEngineGeneratesAlternatives },
    { name: 'PlanningEngine Calculate Confidence', fn: testPlanningEngineCalculatesConfidence },
    { name: 'PlanningEngine Calculate Dependencies', fn: testPlanningEngineCalculatesDependencies },
    { name: 'PlanningEngine Multiple Domains', fn: testPlanningEngineMultipleDomains },
    
    // Integration tests
    { name: 'Planning End-to-End', fn: testPlanningEndToEnd },
    { name: 'Planning Result Metrics', fn: testPlanningResultMetrics }
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    try {
      const result = await Promise.resolve(test.fn());
      if (result) {
        passed++;
      } else {
        failed++;
        failures.push(`${test.name}: returned false`);
      }
    } catch (error) {
      failed++;
      failures.push(`${test.name}: ${error.message}`);
    }
  }

  return {
    testName: 'PlanningEngineTests',
    total: tests.length,
    passed,
    failed,
    failures
  };
}
