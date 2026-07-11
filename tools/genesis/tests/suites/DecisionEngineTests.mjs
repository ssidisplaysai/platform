/**
 * DecisionEngineTests.mjs
 *
 * Test suite for Genesis Enterprise Decision Engine v1
 * Comprehensive coverage of decision evaluation and ranking
 *
 * @module tools/genesis/tests/suites/DecisionEngineTests.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  EnterpriseDecision,
  DecisionContext,
  DecisionCriteria,
  DecisionConstraint,
  DecisionOption,
  DecisionScore,
  DecisionExplanation,
  DecisionRecommendation
} from "../../compiler/DecisionBlueprint.mjs";
import { DecisionEngine } from "../../compiler/DecisionEngine.mjs";

export default async function DecisionEngineTestSuite() {
  const suite = new TestSuite(
    "Decision Engine Tests",
    "Test Genesis Enterprise Decision Engine v1"
  );

  // Test 1: DecisionCriteria initialization
  suite.addTest("DecisionCriteria initializes", async () => {
    const criteria = new DecisionCriteria({
      name: "Cost",
      type: "cost",
      weight: 0.20,
      direction: "lower"
    });
    if (!criteria.id) throw new Error("Criteria ID not set");
    if (criteria.weight !== 0.20) throw new Error("Weight not set");
  });

  // Test 2: DecisionCriteria validation
  suite.addTest("DecisionCriteria validation works", async () => {
    try {
      new DecisionCriteria({ type: "invalid-type" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid criteria type")) throw e;
    }
  });

  // Test 3: DecisionCriteria weight validation
  suite.addTest("DecisionCriteria weight validation", async () => {
    try {
      new DecisionCriteria({ name: "Test", type: "cost", weight: 1.5 });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Weight must be between")) throw e;
    }
  });

  // Test 4: DecisionConstraint initialization
  suite.addTest("DecisionConstraint initializes", async () => {
    const constraint = new DecisionConstraint({
      name: "Budget Limit",
      type: "hard",
      criteria: "cost",
      operator: "<=",
      threshold: 100000
    });
    if (!constraint.id) throw new Error("Constraint ID not set");
    if (constraint.operator !== "<=") throw new Error("Operator not set");
  });

  // Test 5: DecisionConstraint validation
  suite.addTest("DecisionConstraint validation works", async () => {
    try {
      new DecisionConstraint({ type: "invalid" });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("must be")) throw e;
    }
  });

  // Test 6: DecisionConstraint satisfaction check
  suite.addTest("DecisionConstraint satisfaction check", async () => {
    const constraint = new DecisionConstraint({
      name: "Budget",
      type: "hard",
      operator: "<=",
      threshold: 100000
    });
    if (!constraint.isSatisfied(90000)) throw new Error("Should satisfy");
    if (constraint.isSatisfied(110000)) throw new Error("Should not satisfy");
  });

  // Test 7: DecisionOption initialization
  suite.addTest("DecisionOption initializes", async () => {
    const option = new DecisionOption({
      name: "Option A",
      cost: 100000,
      revenue: 30,
      profitability: 35
    });
    if (!option.id) throw new Error("Option ID not set");
    if (option.cost !== 100000) throw new Error("Cost not set");
  });

  // Test 8: DecisionOption get all metrics
  suite.addTest("DecisionOption get all metrics", async () => {
    const option = new DecisionOption({
      name: "Test",
      cost: 100,
      revenue: 50,
      schedule: 60
    });
    const metrics = option.getAllMetrics();
    if (!metrics.cost) throw new Error("Cost not in metrics");
    if (metrics.revenue !== 50) throw new Error("Revenue not set correctly");
  });

  // Test 9: DecisionOption mark selected
  suite.addTest("DecisionOption mark selected", async () => {
    const option = new DecisionOption({ name: "Test" });
    option.markSelected();
    if (option.status !== "selected") throw new Error("Status should be selected");
  });

  // Test 10: DecisionOption mark rejected
  suite.addTest("DecisionOption mark rejected", async () => {
    const option = new DecisionOption({ name: "Test" });
    option.markRejected();
    if (option.status !== "rejected") throw new Error("Status should be rejected");
  });

  // Test 11: DecisionScore initialization
  suite.addTest("DecisionScore initializes", async () => {
    const score = new DecisionScore({
      optionId: "opt-1",
      totalScore: 75
    });
    if (!score.id) throw new Error("Score ID not set");
    if (score.totalScore !== 75) throw new Error("Total score not set");
  });

  // Test 12: DecisionScore record criteria score
  suite.addTest("DecisionScore record criteria score", async () => {
    const score = new DecisionScore({ optionId: "opt-1" });
    score.recordCriteriaScore("crit-1", 80);
    if (score.criteriaScores["crit-1"] !== 80) throw new Error("Score not recorded");
  });

  // Test 13: DecisionScore constraint violations
  suite.addTest("DecisionScore constraint violations", async () => {
    const score = new DecisionScore({ optionId: "opt-1" });
    score.recordConstraintStatus("const-1", false);
    if (!score.hasViolations()) throw new Error("Should have violations");
    if (score.constraintViolations.length !== 1) throw new Error("Violation not recorded");
  });

  // Test 14: DecisionExplanation initialization
  suite.addTest("DecisionExplanation initializes", async () => {
    const explanation = new DecisionExplanation({
      recommendedOptionId: "opt-1",
      summary: "Test explanation"
    });
    if (!explanation.id) throw new Error("Explanation ID not set");
    if (explanation.summary !== "Test explanation") throw new Error("Summary not set");
  });

  // Test 15: DecisionExplanation add rationale
  suite.addTest("DecisionExplanation add rationale", async () => {
    const explanation = new DecisionExplanation({ recommendedOptionId: "opt-1" });
    explanation.addRationale("Test rationale");
    if (explanation.rationale.length !== 1) throw new Error("Rationale not added");
  });

  // Test 16: DecisionExplanation add tradeoff
  suite.addTest("DecisionExplanation add tradeoff", async () => {
    const explanation = new DecisionExplanation({ recommendedOptionId: "opt-1" });
    explanation.addTradeoff("vs option B: higher cost but faster");
    if (explanation.tradeoffs.length !== 1) throw new Error("Tradeoff not added");
  });

  // Test 17: DecisionRecommendation initialization
  suite.addTest("DecisionRecommendation initializes", async () => {
    const recommendation = new DecisionRecommendation({
      recommendedOptionId: "opt-1",
      priority: "high",
      confidence: 85
    });
    if (!recommendation.id) throw new Error("Recommendation ID not set");
    if (recommendation.priority !== "high") throw new Error("Priority not set");
  });

  // Test 18: DecisionRecommendation mark approved
  suite.addTest("DecisionRecommendation mark approved", async () => {
    const recommendation = new DecisionRecommendation({ recommendedOptionId: "opt-1" });
    recommendation.markApproved();
    if (recommendation.status !== "approved") throw new Error("Status should be approved");
  });

  // Test 19: DecisionContext initialization
  suite.addTest("DecisionContext initializes", async () => {
    const context = new DecisionContext({
      tenantId: "test-tenant",
      decisionType: "enterprise",
      businessObjective: "Select best option"
    });
    if (!context.id) throw new Error("Context ID not set");
    if (context.decisionType !== "enterprise") throw new Error("Decision type not set");
  });

  // Test 20: DecisionContext validation
  suite.addTest("DecisionContext validation works", async () => {
    try {
      new DecisionContext({ 
        tenantId: "",
        executionMode: "invalid"
      });
      throw new Error("Should have thrown");
    } catch (e) {
      if (!e.message.includes("Invalid execution mode")) throw e;
    }
  });

  // Test 21: DecisionContext mark active
  suite.addTest("DecisionContext mark active", async () => {
    const context = new DecisionContext({ tenantId: "test" });
    context.markActive();
    if (context.status !== "active") throw new Error("Status should be active");
  });

  // Test 22: EnterpriseDecision initialization
  suite.addTest("EnterpriseDecision initializes", async () => {
    const decision = new EnterpriseDecision({
      name: "Strategic Decision",
      businessObjective: "Maximize ROI"
    });
    if (!decision.id) throw new Error("Decision ID not set");
    if (decision.status !== "draft") throw new Error("Status should be draft");
  });

  // Test 23: EnterpriseDecision mark validated
  suite.addTest("EnterpriseDecision mark validated", async () => {
    const decision = new EnterpriseDecision({ name: "Test" });
    decision.markValidated();
    if (decision.status !== "validated") throw new Error("Status should be validated");
  });

  // Test 24: EnterpriseDecision mark decided
  suite.addTest("EnterpriseDecision mark decided", async () => {
    const decision = new EnterpriseDecision({ name: "Test" });
    const option = new DecisionOption({ name: "Option A" });
    decision.options.push(option);
    decision.markDecided(option.id);
    if (decision.status !== "decided") throw new Error("Status should be decided");
    if (!decision.selectedOption) throw new Error("Selected option not set");
  });

  // Test 25: EnterpriseDecision mark approved
  suite.addTest("EnterpriseDecision mark approved", async () => {
    const decision = new EnterpriseDecision({ name: "Test" });
    decision.markApproved("manager-1");
    if (decision.status !== "approved") throw new Error("Status should be approved");
    if (decision.metadata.approvedBy !== "manager-1") throw new Error("Approver not set");
  });

  // Test 26: DecisionEngine initialization
  suite.addTest("DecisionEngine initializes", async () => {
    const engine = new DecisionEngine();
    if (engine.decision !== null) throw new Error("Decision should be null initially");
    if (engine.context !== null) throw new Error("Context should be null initially");
  });

  // Test 27: DecisionEngine execute decision
  suite.addTest("DecisionEngine execute decision", async () => {
    const engine = new DecisionEngine();
    const result = await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select best option"
    });
    if (!result.success) throw new Error("Decision should succeed");
    if (engine.decision === null) throw new Error("Decision should be created");
  });

  // Test 28: DecisionEngine evaluates options
  suite.addTest("DecisionEngine evaluates options", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    if (engine.scores.length === 0) throw new Error("Should generate scores");
    if (engine.decision.scores.length === 0) throw new Error("Scores not attached to decision");
  });

  // Test 29: DecisionEngine ranks alternatives
  suite.addTest("DecisionEngine ranks alternatives", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    if (engine.decision.rankedOptions.length === 0) throw new Error("Should rank options");
    const ranks = engine.scores.map(s => s.rank);
    if (ranks.some(r => r === 0)) throw new Error("All options should be ranked");
  });

  // Test 30: DecisionEngine generates explanation
  suite.addTest("DecisionEngine generates explanation", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    if (!engine.decision.explanation) throw new Error("Explanation not generated");
    if (engine.decision.explanation.summary.length === 0) throw new Error("Summary is empty");
  });

  // Test 31: DecisionEngine creates recommendation
  suite.addTest("DecisionEngine creates recommendation", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    if (!engine.decision.recommendation) throw new Error("Recommendation not created");
    if (engine.decision.recommendation.status !== "approved") throw new Error("Recommendation should be approved");
  });

  // Test 32: DecisionEngine score normalization
  suite.addTest("DecisionEngine score normalization", async () => {
    const engine = new DecisionEngine();
    
    // Test cost normalization (lower is better)
    const costScore = engine.normalizeScore('cost', 100000);
    const costScore2 = engine.normalizeScore('cost', 200000);
    if (costScore <= costScore2) throw new Error("Lower cost should score higher");
    
    // Test revenue normalization (higher is better)
    const revScore = engine.normalizeScore('revenue', 50);
    const revScore2 = engine.normalizeScore('revenue', 30);
    if (revScore <= revScore2) throw new Error("Higher revenue should score higher");
  });

  // Test 33: DecisionEngine constraint evaluation
  suite.addTest("DecisionEngine constraint evaluation", async () => {
    const engine = new DecisionEngine();
    const option = new DecisionOption({ name: "Test", cost: 100000 });
    const constraint = new DecisionConstraint({
      name: "Budget",
      type: "hard",
      operator: "<=",
      threshold: 500000
    });
    
    if (!constraint.isSatisfied(option.cost)) throw new Error("Should satisfy constraint");
  });

  // Test 34: DecisionEngine multiple criteria
  suite.addTest("DecisionEngine multiple criteria", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option",
      context: {
        tenantId: "test"
      }
    });
    if (engine.context.criteria.length !== 9) throw new Error("Should have 9 default criteria");
  });

  // Test 35: DecisionEngine multiple constraints
  suite.addTest("DecisionEngine multiple constraints", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option",
      context: {
        tenantId: "test"
      }
    });
    if (engine.context.constraints.length !== 3) throw new Error("Should have 3 default constraints");
  });

  // Test 36: DecisionEngine end-to-end with custom criteria
  suite.addTest("DecisionEngine end-to-end with custom criteria", async () => {
    const engine = new DecisionEngine();
    
    const customCriteria = [
      new DecisionCriteria({ name: "Cost", type: "cost", weight: 0.4, direction: "lower" }),
      new DecisionCriteria({ name: "Revenue", type: "revenue", weight: 0.6, direction: "higher" })
    ];
    
    const result = await engine.executeDecision({
      name: "Custom Decision",
      businessObjective: "Cost vs Revenue tradeoff",
      context: {
        tenantId: "test",
        criteria: customCriteria
      }
    });
    
    if (!result.success) throw new Error("Should succeed with custom criteria");
    if (engine.context.criteria.length !== 2) throw new Error("Custom criteria not used");
  });

  // Test 37: DecisionEngine option comparison
  suite.addTest("DecisionEngine option comparison", async () => {
    const engine = new DecisionEngine();
    
    const options = [
      new DecisionOption({ name: "Option A", cost: 100000, revenue: 50, schedule: 90 }),
      new DecisionOption({ name: "Option B", cost: 150000, revenue: 75, schedule: 60 }),
      new DecisionOption({ name: "Option C", cost: 200000, revenue: 90, schedule: 30 })
    ];
    
    const result = await engine.executeDecision({
      name: "Compare Options",
      businessObjective: "Find best balance",
      options: options
    });
    
    if (engine.decision.rankedOptions.length !== 3) throw new Error("Should rank all options");
  });

  // Test 38: DecisionEngine explanation completeness
  suite.addTest("DecisionEngine explanation completeness", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    
    const explanation = engine.decision.explanation;
    if (!explanation.summary) throw new Error("Summary missing");
    if (explanation.rationale.length === 0) throw new Error("Rationale missing");
    if (explanation.nextSteps.length === 0) throw new Error("Next steps missing");
  });

  // Test 39: DecisionEngine recommendation completeness
  suite.addTest("DecisionEngine recommendation completeness", async () => {
    const engine = new DecisionEngine();
    await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    
    const recommendation = engine.decision.recommendation;
    if (!recommendation.expectedOutcome) throw new Error("Expected outcome missing");
    if (!recommendation.timeline) throw new Error("Timeline missing");
    if (recommendation.successCriteria.length === 0) throw new Error("Success criteria missing");
  });

  // Test 40: DecisionEngine artifact persistence
  suite.addTest("DecisionEngine artifact persistence", async () => {
    const engine = new DecisionEngine();
    const result = await engine.executeDecision({
      name: "Test Decision",
      businessObjective: "Select option"
    });
    if (!result.success) throw new Error("Should persist artifacts successfully");
  });

  return suite;
}
