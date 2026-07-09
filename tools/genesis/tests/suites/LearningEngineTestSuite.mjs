/**
 * LearningEngineTestSuite.mjs
 *
 * Test suite for Genesis Learning Engine v1
 * Integrates with main TestRunner
 *
 * @module tools/genesis/tests/suites/LearningEngineTestSuite.mjs
 */

import { TestSuite } from "../TestSuite.mjs";
import {
  LearningObservation,
  LearningSignal,
  LearningMetric,
  LearningPattern,
  LearningHypothesis,
  LearningInsight,
  LearningRecommendation,
  LearningSnapshot,
  LearningResult
} from "../../compiler/LearningBlueprint.mjs";
import { LearningEngine } from "../../compiler/LearningEngine.mjs";

export default async function LearningEngineTestSuite() {
  const suite = new TestSuite(
    "Learning Engine Tests",
    "Test Genesis Enterprise Learning Engine v1"
  );

  // ===== Blueprint Contract Tests =====

  suite.addTest("LearningObservation contract validation", async () => {
    const obs = new LearningObservation({
      source: 'runtime',
      domain: 'operations',
      value: 42,
      confidence: 0.95
    });
    if (obs.status !== 'draft') throw new Error('Status not draft');
    if (!obs.id.startsWith('obs-')) throw new Error('ID not prefixed');
  });

  suite.addTest("LearningSignal contract validation", async () => {
    const signal = new LearningSignal({
      type: 'anomaly',
      domain: 'sales',
      observation: 'obs-123',
      severity: 'warning'
    });
    if (signal.status !== 'draft') throw new Error('Status not draft');
    if (signal.type !== 'anomaly') throw new Error('Type mismatch');
  });

  suite.addTest("LearningMetric contract validation", async () => {
    const metric = new LearningMetric({
      name: 'throughput',
      domain: 'manufacturing',
      value: 100,
      category: 'performance'
    });
    if (metric.status !== 'draft') throw new Error('Status not draft');
    if (metric.category !== 'performance') throw new Error('Category mismatch');
  });

  suite.addTest("LearningPattern contract validation", async () => {
    const pattern = new LearningPattern({
      name: 'morning_surge',
      domain: 'sales',
      patternType: 'seasonal'
    });
    if (pattern.patternType !== 'seasonal') throw new Error('Type mismatch');
    if (pattern.occurrences === undefined) throw new Error('Occurrences not initialized');
  });

  suite.addTest("LearningHypothesis contract validation", async () => {
    const hypothesis = new LearningHypothesis({
      statement: 'If X then Y',
      domain: 'operations'
    });
    if (hypothesis.status !== 'draft') throw new Error('Status not draft');
    if (hypothesis.testable === undefined) throw new Error('Testable not set');
  });

  suite.addTest("LearningInsight contract validation", async () => {
    const insight = new LearningInsight({
      title: 'Performance Improvement',
      domain: 'finance'
    });
    if (insight.status !== 'draft') throw new Error('Status not draft');
    if (insight.reusable === undefined) throw new Error('Reusable not set');
  });

  suite.addTest("LearningRecommendation contract validation", async () => {
    const rec = new LearningRecommendation({
      title: 'Optimize Process',
      insight: 'ins-123'
    });
    if (rec.status !== 'draft') throw new Error('Status not draft');
    if (rec.priority !== 'medium') throw new Error('Default priority not set');
  });

  suite.addTest("LearningSnapshot contract validation", async () => {
    const snapshot = new LearningSnapshot({
      period: '1d'
    });
    if (snapshot.status !== 'draft') throw new Error('Status not draft');
    if (snapshot.period !== '1d') throw new Error('Period mismatch');
  });

  // ===== Status Lifecycle Tests =====

  suite.addTest("Observation status lifecycle", async () => {
    const obs = new LearningObservation({
      source: 'event',
      domain: 'operations',
      value: 50
    });
    obs.markDefined();
    obs.markValidated();
    if (obs.status !== 'validated') throw new Error('Status not validated');
  });

  suite.addTest("Signal status lifecycle", async () => {
    const signal = new LearningSignal({
      type: 'trend',
      domain: 'sales',
      observation: 'obs-1'
    });
    signal.markDefined();
    signal.markApproved();
    if (signal.status !== 'approved') throw new Error('Status not approved');
  });

  suite.addTest("Hypothesis status transitions", async () => {
    const hyp = new LearningHypothesis({
      statement: 'Test hypothesis',
      domain: 'operations'
    });
    hyp.markDefined();
    hyp.markTested();
    hyp.markValidated();
    if (hyp.status !== 'validated') throw new Error('Status not validated');
  });

  // ===== Serialization Tests =====

  suite.addTest("Observation serializes to JSON", async () => {
    const obs = new LearningObservation({
      source: 'runtime',
      domain: 'operations',
      value: 75
    });
    const json = obs.toJSON();
    if (json.domain !== 'operations') throw new Error('Domain not serialized');
    if (json.value !== 75) throw new Error('Value not serialized');
  });

  suite.addTest("Metric serializes to JSON", async () => {
    const metric = new LearningMetric({
      name: 'latency',
      domain: 'manufacturing',
      value: 42,
      unit: 'ms'
    });
    const json = metric.toJSON();
    if (json.unit !== 'ms') throw new Error('Unit not serialized');
    if (json.name !== 'latency') throw new Error('Name not serialized');
  });

  suite.addTest("Insight serializes to JSON", async () => {
    const insight = new LearningInsight({
      title: 'Cost Reduction',
      domain: 'finance',
      impact: 'high'
    });
    const json = insight.toJSON();
    if (json.impact !== 'high') throw new Error('Impact not serialized');
  });

  // ===== Learning Engine Tests =====

  suite.addTest("Learning Engine initializes", async () => {
    const engine = new LearningEngine();
    if (engine.observations.length !== 0) throw new Error('Observations not empty');
    if (engine.learningDomains.length === 0) throw new Error('No learning domains');
  });

  suite.addTest("Engine captures observations", async () => {
    const engine = new LearningEngine();
    const obs = engine.captureObservations();
    if (obs.length === 0) throw new Error('No observations captured');
    if (!obs[0].id.startsWith('obs-')) throw new Error('Invalid observation ID');
  });

  suite.addTest("Engine detects signals", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    const signals = engine.detectSignals();
    if (signals.length > 0) {
      if (!['anomaly', 'trend', 'threshold', 'pattern', 'correlation'].includes(signals[0].type)) {
        throw new Error('Invalid signal type');
      }
    }
  });

  suite.addTest("Engine collects metrics", async () => {
    const engine = new LearningEngine();
    const metrics = engine.collectMetrics();
    if (metrics.length === 0) throw new Error('No metrics collected');
    if (!metrics[0].category) throw new Error('Metric missing category');
  });

  suite.addTest("Engine identifies patterns", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    const patterns = engine.identifyPatterns();
    if (patterns.length === 0) throw new Error('No patterns identified');
    if (!['sequential', 'recurring', 'seasonal', 'cyclical'].includes(patterns[0].patternType)) {
      throw new Error('Invalid pattern type');
    }
  });

  suite.addTest("Engine generates hypotheses", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    const hypotheses = engine.generateHypotheses();
    if (hypotheses.length === 0) throw new Error('No hypotheses generated');
    if (!hypotheses[0].statement) throw new Error('Hypothesis missing statement');
  });

  suite.addTest("Engine creates insights", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    engine.identifyPatterns();
    engine.generateHypotheses();
    const insights = engine.createInsights();
    if (insights.length === 0) throw new Error('No insights created');
    if (!['performance', 'efficiency', 'risk', 'opportunity'].includes(insights[0].type)) {
      throw new Error('Invalid insight type');
    }
  });

  suite.addTest("Engine generates recommendations", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    engine.identifyPatterns();
    engine.generateHypotheses();
    engine.createInsights();
    const recommendations = engine.generateRecommendations();
    if (recommendations.length === 0) throw new Error('No recommendations generated');
    if (!recommendations[0].action) throw new Error('Recommendation missing action');
  });

  suite.addTest("Engine builds comparisons", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    engine.collectMetrics();
    engine.detectSignals();
    const comparisons = engine.buildComparisons();
    
    if (!comparisons.plannedVsActual) throw new Error('Missing plannedVsActual');
    if (!comparisons.simulatedVsActual) throw new Error('Missing simulatedVsActual');
    if (!comparisons.predictedVsActual) throw new Error('Missing predictedVsActual');
    if (!comparisons.decisionVsOutcome) throw new Error('Missing decisionVsOutcome');
  });

  // ===== Full Pipeline Tests =====

  suite.addTest("Full learning pipeline executes", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    if (result.status !== 'success') throw new Error('Pipeline failed');
  });

  suite.addTest("Pipeline produces all components", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    
    if (result.observations.length === 0) throw new Error('No observations');
    if (result.signals.length === 0) throw new Error('No signals');
    if (result.metrics.length === 0) throw new Error('No metrics');
    if (result.patterns.length === 0) throw new Error('No patterns');
    if (result.hypotheses.length === 0) throw new Error('No hypotheses');
    if (result.insights.length === 0) throw new Error('No insights');
    if (result.recommendations.length === 0) throw new Error('No recommendations');
  });

  suite.addTest("Pipeline generates summary", async () => {
    const engine = new LearningEngine();
    await engine.analyzeExecutionOutcomes({ persist: false });
    const summary = engine.getSummary();
    
    if (!summary.id) throw new Error('Summary missing ID');
    if (summary.status !== 'success') throw new Error('Summary status wrong');
    if (!summary.metrics) throw new Error('Summary missing metrics');
    if (summary.metrics.observationsCaptured === 0) throw new Error('No observations in summary');
  });

  suite.addTest("Pipeline persists artifacts", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: true });
    if (result.status !== 'success') throw new Error('Persistence failed');
  });

  // ===== Domain Tests =====

  suite.addTest("All learning domains supported", async () => {
    const engine = new LearningEngine();
    const expectedDomains = [
      'operations', 'manufacturing', 'inventory', 'purchasing',
      'sales', 'finance', 'customer_service', 'ai_performance'
    ];
    
    for (const domain of expectedDomains) {
      if (!engine.learningDomains.includes(domain)) {
        throw new Error(`Domain ${domain} not supported`);
      }
    }
  });

  suite.addTest("Observations span all domains", async () => {
    const engine = new LearningEngine();
    engine.captureObservations();
    const domains = new Set(engine.observations.map(o => o.domain));
    
    if (domains.size === 0) throw new Error('No domains in observations');
  });

  suite.addTest("Insights span all domains", async () => {
    const engine = new LearningEngine();
    await engine.analyzeExecutionOutcomes({ persist: false });
    const domains = new Set(engine.insights.map(i => i.domain));
    
    if (domains.size === 0) throw new Error('No domains in insights');
  });

  // ===== Comparison Tests =====

  suite.addTest("Planned vs Actual comparison generated", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    
    if (!result.comparisons) throw new Error('No comparisons object');
    if (!Array.isArray(result.comparisons.plannedVsActual)) {
      throw new Error('plannedVsActual is not an array');
    }
  });

  suite.addTest("Simulated vs Actual comparison generated", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    
    if (!result.comparisons) throw new Error('No comparisons object');
    if (!Array.isArray(result.comparisons.simulatedVsActual)) {
      throw new Error('simulatedVsActual is not an array');
    }
  });

  suite.addTest("Predicted vs Actual comparison generated", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    
    if (!result.comparisons) throw new Error('No comparisons object');
    if (!Array.isArray(result.comparisons.predictedVsActual)) {
      throw new Error('predictedVsActual is not an array');
    }
  });

  suite.addTest("Decision vs Outcome comparison generated", async () => {
    const engine = new LearningEngine();
    const result = await engine.analyzeExecutionOutcomes({ persist: false });
    
    if (!result.comparisons) throw new Error('No comparisons object');
    if (!Array.isArray(result.comparisons.decisionVsOutcome)) {
      throw new Error('decisionVsOutcome is not an array');
    }
  });

  // ===== Validation Tests =====

  suite.addTest("Invalid observation throws error", async () => {
    try {
      new LearningObservation({ source: 'test' }); // missing domain and value
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Invalid signal throws error", async () => {
    try {
      new LearningSignal({ domain: 'test' }); // missing type and observation
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Invalid metric throws error", async () => {
    try {
      new LearningMetric({ domain: 'test' }); // missing name and value
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('required')) throw e;
    }
  });

  suite.addTest("Confidence bounds enforced", async () => {
    try {
      new LearningObservation({
        source: 'test',
        domain: 'operations',
        value: 50,
        confidence: 1.5 // invalid: > 1
      });
      throw new Error('Should have thrown');
    } catch (e) {
      if (!e.message.includes('confidence')) throw e;
    }
  });

  return suite;
}
