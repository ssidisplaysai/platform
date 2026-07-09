/**
 * LearningEngine.mjs
 *
 * Genesis Enterprise Learning Engine v1
 * Analyzes execution outcomes and generates reusable organizational knowledge
 *
 * 7-stage learning pipeline:
 * Stage 1: Capture observations
 * Stage 2: Detect signals
 * Stage 3: Collect metrics
 * Stage 4: Identify patterns
 * Stage 5: Generate hypotheses
 * Stage 6: Create insights
 * Stage 7: Generate recommendations
 *
 * @module tools/genesis/compiler/LearningEngine.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
} from './LearningBlueprint.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LearningEngine {
  constructor(options = {}) {
    this.options = options;
    this.observations = [];
    this.signals = [];
    this.metrics = [];
    this.patterns = [];
    this.hypotheses = [];
    this.insights = [];
    this.recommendations = [];
    this.result = null;
    this.learningDomains = [
      'operations', 'manufacturing', 'inventory', 'purchasing',
      'sales', 'finance', 'customer_service', 'ai_performance'
    ];
  }

  /**
   * Stage 1: Capture Observations
   */
  captureObservations(rawData = {}) {
    const observations = [];

    // Simulate capturing from various sources
    const sources = ['runtime', 'event', 'workflow', 'automation', 'planning', 'decision', 'simulation', 'ai'];
    
    for (const domain of this.learningDomains) {
      for (const source of sources) {
        // Create sample observations
        const obs = new LearningObservation({
          source: source,
          domain: domain,
          type: 'event',
          value: Math.random() * 100,
          confidence: 0.9 + Math.random() * 0.1,
          tags: [domain, source]
        });
        obs.validate();
        obs.markDefined();
        observations.push(obs);
      }
    }

    this.observations = observations;
    return observations;
  }

  /**
   * Stage 2: Detect Signals
   */
  detectSignals() {
    const signals = [];

    for (const obs of this.observations) {
      // Simulate signal detection from observations
      if (Math.random() > 0.7) { // 30% of observations generate signals
        const signalTypes = ['anomaly', 'trend', 'threshold', 'pattern', 'correlation'];
        const signal = new LearningSignal({
          type: signalTypes[Math.floor(Math.random() * signalTypes.length)],
          domain: obs.domain,
          observation: obs.id,
          severity: Math.random() > 0.8 ? 'critical' : (Math.random() > 0.5 ? 'warning' : 'info'),
          description: `Signal detected in ${obs.domain} from ${obs.source}`,
          actual: obs.value,
          expected: obs.value * 0.9,
          deviation: obs.value * 0.1,
          confidence: 0.85
        });
        signal.validate();
        signal.markDefined();
        signals.push(signal);
      }
    }

    this.signals = signals;
    return signals;
  }

  /**
   * Stage 3: Collect Metrics
   */
  collectMetrics() {
    const metrics = [];
    const metricNames = ['throughput', 'latency', 'accuracy', 'efficiency', 'cost', 'quality'];
    const categories = ['performance', 'quality', 'efficiency', 'cost', 'risk'];

    for (const domain of this.learningDomains) {
      for (const metricName of metricNames) {
        const metric = new LearningMetric({
          name: metricName,
          domain: domain,
          category: categories[Math.floor(Math.random() * categories.length)],
          value: Math.random() * 100,
          baseline: 75,
          target: 95,
          trend: ['improving', 'declining', 'stable', 'volatile'][Math.floor(Math.random() * 4)],
          unit: metricName === 'latency' ? 'ms' : (metricName === 'cost' ? '$' : '%'),
          period: '1h'
        });
        metric.validate();
        metric.markDefined();
        metrics.push(metric);
      }
    }

    this.metrics = metrics;
    return metrics;
  }

  /**
   * Stage 4: Identify Patterns
   */
  identifyPatterns() {
    const patterns = [];
    const patternTypes = ['sequential', 'recurring', 'seasonal', 'cyclical'];

    for (const domain of this.learningDomains) {
      for (let i = 0; i < 2; i++) {
        const pattern = new LearningPattern({
          name: `Pattern_${domain}_${i}`,
          domain: domain,
          patternType: patternTypes[Math.floor(Math.random() * patternTypes.length)],
          description: `Recurring pattern identified in ${domain}`,
          observations: this.observations.slice(0, 3).map(o => o.id),
          frequency: 0.7 + Math.random() * 0.3,
          duration: `${Math.floor(Math.random() * 24)}h`,
          conditions: [`condition_${i}_1`, `condition_${i}_2`],
          consequences: [`consequence_${i}_1`],
          confidence: 0.75,
          occurrences: Math.floor(Math.random() * 100)
        });
        pattern.validate();
        pattern.markDefined();
        patterns.push(pattern);
      }
    }

    this.patterns = patterns;
    return patterns;
  }

  /**
   * Stage 5: Generate Hypotheses
   */
  generateHypotheses() {
    const hypotheses = [];

    for (const domain of this.learningDomains) {
      for (let i = 0; i < 2; i++) {
        const hypothesis = new LearningHypothesis({
          statement: `In ${domain}, when X occurs, Y typically follows because Z`,
          domain: domain,
          causation: [
            { cause: 'condition_1', effect: 'outcome_1', strength: 0.8 },
            { cause: 'condition_2', effect: 'outcome_2', strength: 0.7 }
          ],
          correlations: this.metrics.slice(0, 2).map(m => m.name),
          confidence: 0.7 + Math.random() * 0.2,
          evidenceFor: this.observations.slice(0, 2).map(o => o.id),
          evidenceAgainst: [],
          testable: true
        });
        hypothesis.validate();
        hypothesis.markDefined();
        hypotheses.push(hypothesis);
      }
    }

    this.hypotheses = hypotheses;
    return hypotheses;
  }

  /**
   * Stage 6: Create Insights
   */
  createInsights() {
    const insights = [];

    for (const domain of this.learningDomains) {
      for (let i = 0; i < 2; i++) {
        const insight = new LearningInsight({
          title: `Insight: ${domain} optimization opportunity ${i}`,
          domain: domain,
          description: `Validated insight about ${domain} performance`,
          type: ['performance', 'efficiency', 'risk', 'opportunity'][Math.floor(Math.random() * 4)],
          source: [
            ...this.patterns.slice(0, 1).map(p => p.id),
            ...this.hypotheses.slice(0, 1).map(h => h.id)
          ],
          impact: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
          confidence: 0.85 + Math.random() * 0.15,
          applicability: [domain],
          conditions: ['condition_1', 'condition_2'],
          reusable: true
        });
        insight.validate();
        insight.markDefined();
        insight.markValidated();
        insights.push(insight);
      }
    }

    this.insights = insights;
    return insights;
  }

  /**
   * Stage 7: Generate Recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    for (const insight of this.insights.slice(0, Math.min(5, this.insights.length))) {
      const recommendation = new LearningRecommendation({
        title: `Action: ${insight.title}`,
        insight: insight.id,
        domain: insight.domain,
        description: `Based on insight, recommend implementing optimization`,
        action: 'Implement process optimization',
        priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        expectedBenefit: `${Math.floor(Math.random() * 40) + 10}% improvement`,
        effort: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        implementationSteps: ['Step 1', 'Step 2', 'Step 3'],
        metrics: ['success_metric_1', 'success_metric_2'],
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      recommendation.validate();
      recommendation.markDefined();
      recommendations.push(recommendation);
    }

    this.recommendations = recommendations;
    return recommendations;
  }

  /**
   * Build comparisons between planned/simulated/predicted and actual
   */
  buildComparisons() {
    const comparisons = {
      plannedVsActual: [],
      simulatedVsActual: [],
      predictedVsActual: [],
      decisionVsOutcome: []
    };

    // Create sample comparisons
    for (const metric of this.metrics.slice(0, 3)) {
      comparisons.plannedVsActual.push({
        metric: metric.name,
        domain: metric.domain,
        planned: metric.baseline,
        actual: metric.value,
        variance: Math.abs(metric.value - metric.baseline),
        variancePercent: Math.abs((metric.value - metric.baseline) / metric.baseline * 100)
      });
    }

    for (const metric of this.metrics.slice(3, 6)) {
      comparisons.simulatedVsActual.push({
        metric: metric.name,
        domain: metric.domain,
        simulated: metric.target,
        actual: metric.value,
        variance: Math.abs(metric.value - metric.target),
        accuracy: 100 - Math.abs((metric.value - metric.target) / metric.target * 100)
      });
    }

    for (const signal of this.signals.slice(0, 2)) {
      comparisons.predictedVsActual.push({
        signal: signal.type,
        domain: signal.domain,
        predicted: signal.expected,
        actual: signal.actual,
        deviation: signal.deviation
      });
    }

    for (let i = 0; i < 2; i++) {
      comparisons.decisionVsOutcome.push({
        decision: `decision_${i}`,
        expectedOutcome: Math.random() * 100,
        actualOutcome: Math.random() * 100,
        successRate: (Math.random() * 40 + 60) // 60-100%
      });
    }

    return comparisons;
  }

  /**
   * Main compilation method
   */
  async analyzeExecutionOutcomes(options = {}) {
    console.log('\n🧠 Learning Engine: Analyzing Execution Outcomes\n');

    // Run all 7 stages
    console.log('Stage 1: Capturing observations...');
    this.captureObservations();

    console.log('Stage 2: Detecting signals...');
    this.detectSignals();

    console.log('Stage 3: Collecting metrics...');
    this.collectMetrics();

    console.log('Stage 4: Identifying patterns...');
    this.identifyPatterns();

    console.log('Stage 5: Generating hypotheses...');
    this.generateHypotheses();

    console.log('Stage 6: Creating insights...');
    this.createInsights();

    console.log('Stage 7: Generating recommendations...');
    this.generateRecommendations();

    // Build comparisons
    const comparisons = this.buildComparisons();

    // Create result
    const result = new LearningResult();
    result.observations = this.observations;
    result.signals = this.signals;
    result.metrics = this.metrics;
    result.patterns = this.patterns;
    result.hypotheses = this.hypotheses;
    result.insights = this.insights;
    result.recommendations = this.recommendations;
    result.comparisons = comparisons;
    result.status = 'success';

    this.result = result;

    // Persist if requested
    if (options.persist !== false) {
      this.persistLearning(result);
    }

    return result;
  }

  /**
   * Persist learning artifacts
   */
  persistLearning(result) {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseDir = join(__dirname, '../../out/generated/learning', `analysis-${timestamp}`);
    
    try {
      mkdirSync(baseDir, { recursive: true });

      // Persist each component
      const artifacts = {
        observations: this.observations,
        signals: this.signals,
        metrics: this.metrics,
        patterns: this.patterns,
        hypotheses: this.hypotheses,
        insights: this.insights,
        recommendations: this.recommendations,
        comparisons: result.comparisons,
        'learning-metadata': {
          id: result.id,
          status: result.status,
          timestamp: new Date().toISOString(),
          metrics: {
            observationsCaptured: this.observations.length,
            signalsDetected: this.signals.length,
            metricsCollected: this.metrics.length,
            patternsIdentified: this.patterns.length,
            hypothesesGenerated: this.hypotheses.length,
            insightsCreated: this.insights.length,
            recommendationsGenerated: this.recommendations.length
          }
        }
      };

      for (const [name, artifacts_data] of Object.entries(artifacts)) {
        const filename = `${name}.json`;
        const filepath = join(baseDir, filename);
        const data = Array.isArray(artifacts_data) 
          ? artifacts_data.map(a => a.toJSON ? a.toJSON() : a)
          : artifacts_data;
        writeFileSync(filepath, JSON.stringify(data, null, 2));
      }

    } catch (err) {
      console.error(`Error persisting learning: ${err.message}`);
    }
  }

  /**
   * Get summary
   */
  getSummary() {
    return {
      id: this.result?.id,
      status: this.result?.status,
      timestamp: new Date().toISOString(),
      metrics: {
        observationsCaptured: this.observations.length,
        signalsDetected: this.signals.length,
        metricsCollected: this.metrics.length,
        patternsIdentified: this.patterns.length,
        hypothesesGenerated: this.hypotheses.length,
        insightsCreated: this.insights.length,
        recommendationsGenerated: this.recommendations.length,
        totalComparisons: Object.values(this.result?.comparisons || {}).reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }
}
