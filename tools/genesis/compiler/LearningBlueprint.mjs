/**
 * LearningBlueprint.mjs
 *
 * Canonical contracts for Genesis Enterprise Learning Engine v1
 * Enables continuous capture of enterprise performance and generation of reusable organizational knowledge
 *
 * 8 Core Contracts:
 * 1. LearningObservation - Raw facts from execution
 * 2. LearningSignal - Meaningful events/anomalies
 * 3. LearningMetric - Measurable performance data
 * 4. LearningPattern - Recurring behaviors
 * 5. LearningHypothesis - Theories about what's happening
 * 6. LearningInsight - Validated knowledge
 * 7. LearningRecommendation - Actionable suggestions
 * 8. LearningSnapshot - Time-scoped collection
 *
 * @module tools/genesis/compiler/LearningBlueprint.mjs
 */

import { randomBytes } from 'crypto';

/**
 * Generate deterministic ID
 */
function generateId(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

/**
 * LearningObservation
 * Raw facts captured from enterprise execution
 */
export class LearningObservation {
  constructor(data) {
    if (!data.source) throw new Error('LearningObservation requires source');
    if (!data.domain) throw new Error('LearningObservation requires domain');
    if (data.value === undefined) throw new Error('LearningObservation requires value');

    this.id = generateId('obs');
    this.source = data.source;           // "runtime" | "event" | "workflow" | "automation" | "planning" | "decision" | "simulation" | "ai"
    this.domain = data.domain;           // Learning domain (operations, manufacturing, etc.)
    this.type = data.type || 'event';    // "event" | "metric" | "outcome" | "anomaly"
    this.value = data.value;             // Observed value
    this.timestamp = data.timestamp || new Date().toISOString();
    this.context = data.context || {};   // Additional context
    this.metadata = data.metadata || {}; // Tracing metadata
    this.confidence = data.confidence || 1.0; // 0-1 confidence level
    this.tags = data.tags || [];         // Classification tags
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.source) throw new Error('source required');
    if (!this.domain) throw new Error('domain required');
    if (this.value === undefined) throw new Error('value required');
    if (this.confidence < 0 || this.confidence > 1) throw new Error('confidence must be 0-1');
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      source: this.source,
      domain: this.domain,
      type: this.type,
      value: this.value,
      timestamp: this.timestamp,
      context: this.context,
      metadata: this.metadata,
      confidence: this.confidence,
      tags: this.tags,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningSignal
 * Meaningful events or anomalies detected from observations
 */
export class LearningSignal {
  constructor(data) {
    if (!data.type) throw new Error('LearningSignal requires type');
    if (!data.domain) throw new Error('LearningSignal requires domain');
    if (!data.observation) throw new Error('LearningSignal requires observation reference');

    this.id = generateId('sig');
    this.type = data.type;               // "anomaly" | "trend" | "threshold" | "pattern" | "correlation"
    this.domain = data.domain;
    this.severity = data.severity || 'info'; // "info" | "warning" | "critical"
    this.observation = data.observation; // Reference to LearningObservation
    this.description = data.description || '';
    this.threshold = data.threshold;     // Trigger threshold if applicable
    this.actual = data.actual;           // Actual observed value
    this.expected = data.expected;       // Expected baseline
    this.deviation = data.deviation;     // Deviation magnitude
    this.correlations = data.correlations || []; // Related signal IDs
    this.confidence = data.confidence || 0.8;
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.type) throw new Error('type required');
    if (!this.domain) throw new Error('domain required');
    if (!this.observation) throw new Error('observation required');
    if (!['anomaly', 'trend', 'threshold', 'pattern', 'correlation'].includes(this.type)) {
      throw new Error('Invalid signal type');
    }
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      domain: this.domain,
      severity: this.severity,
      observation: this.observation,
      description: this.description,
      threshold: this.threshold,
      actual: this.actual,
      expected: this.expected,
      deviation: this.deviation,
      correlations: this.correlations,
      confidence: this.confidence,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningMetric
 * Measurable performance data
 */
export class LearningMetric {
  constructor(data) {
    if (!data.name) throw new Error('LearningMetric requires name');
    if (!data.domain) throw new Error('LearningMetric requires domain');
    if (data.value === undefined) throw new Error('LearningMetric requires value');

    this.id = generateId('met');
    this.name = data.name;               // Metric name (throughput, latency, accuracy, etc.)
    this.domain = data.domain;
    this.category = data.category || 'performance'; // "performance" | "quality" | "efficiency" | "cost" | "risk"
    this.value = data.value;
    this.unit = data.unit || '';
    this.baseline = data.baseline;       // Historical baseline
    this.target = data.target;           // Target value
    this.trend = data.trend || 'stable'; // "improving" | "declining" | "stable" | "volatile"
    this.period = data.period || '1h';   // Measurement period
    this.timestamp = data.timestamp || new Date().toISOString();
    this.tags = data.tags || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.name) throw new Error('name required');
    if (!this.domain) throw new Error('domain required');
    if (this.value === undefined) throw new Error('value required');
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      category: this.category,
      value: this.value,
      unit: this.unit,
      baseline: this.baseline,
      target: this.target,
      trend: this.trend,
      period: this.period,
      timestamp: this.timestamp,
      tags: this.tags,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningPattern
 * Recurring behaviors or sequences
 */
export class LearningPattern {
  constructor(data) {
    if (!data.name) throw new Error('LearningPattern requires name');
    if (!data.domain) throw new Error('LearningPattern requires domain');

    this.id = generateId('pat');
    this.name = data.name;
    this.domain = data.domain;
    this.patternType = data.patternType || 'sequential'; // "sequential" | "recurring" | "seasonal" | "cyclical"
    this.description = data.description || '';
    this.observations = data.observations || []; // IDs of observations forming pattern
    this.frequency = data.frequency || 0; // How often observed (0-1)
    this.duration = data.duration || ''; // Typical duration
    this.conditions = data.conditions || []; // Preconditions
    this.consequences = data.consequences || []; // Typical outcomes
    this.confidence = data.confidence || 0.7;
    this.occurrences = data.occurrences || 0;
    this.firstSeen = data.firstSeen || new Date().toISOString();
    this.lastSeen = data.lastSeen || new Date().toISOString();
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.name) throw new Error('name required');
    if (!this.domain) throw new Error('domain required');
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      patternType: this.patternType,
      description: this.description,
      observations: this.observations,
      frequency: this.frequency,
      duration: this.duration,
      conditions: this.conditions,
      consequences: this.consequences,
      confidence: this.confidence,
      occurrences: this.occurrences,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningHypothesis
 * Theories about causation and relationships
 */
export class LearningHypothesis {
  constructor(data) {
    if (!data.statement) throw new Error('LearningHypothesis requires statement');
    if (!data.domain) throw new Error('LearningHypothesis requires domain');

    this.id = generateId('hyp');
    this.statement = data.statement;     // The hypothesis statement
    this.domain = data.domain;
    this.causation = data.causation || []; // {cause, effect, strength}
    this.correlations = data.correlations || []; // Related metrics/signals
    this.confidence = data.confidence || 0.5; // Confidence 0-1
    this.evidenceFor = data.evidenceFor || []; // Supporting observation IDs
    this.evidenceAgainst = data.evidenceAgainst || []; // Contradicting observation IDs
    this.testable = data.testable !== false; // Can this be tested?
    this.status = 'draft'; // draft → tested → validated → approved
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.statement) throw new Error('statement required');
    if (!this.domain) throw new Error('domain required');
    if (this.confidence < 0 || this.confidence > 1) throw new Error('confidence must be 0-1');
  }

  markDefined() { this.status = 'defined'; return this; }
  markTested() { this.status = 'tested'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      statement: this.statement,
      domain: this.domain,
      causation: this.causation,
      correlations: this.correlations,
      confidence: this.confidence,
      evidenceFor: this.evidenceFor,
      evidenceAgainst: this.evidenceAgainst,
      testable: this.testable,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningInsight
 * Validated knowledge - reusable across enterprises
 */
export class LearningInsight {
  constructor(data) {
    if (!data.title) throw new Error('LearningInsight requires title');
    if (!data.domain) throw new Error('LearningInsight requires domain');

    this.id = generateId('ins');
    this.title = data.title;
    this.domain = data.domain;
    this.description = data.description || '';
    this.type = data.type || 'performance'; // "performance" | "efficiency" | "risk" | "opportunity"
    this.source = data.source || []; // IDs of observations/patterns/hypotheses
    this.impact = data.impact || 'medium'; // "low" | "medium" | "high" | "critical"
    this.confidence = data.confidence || 0.9;
    this.applicability = data.applicability || []; // Industries/domains where applicable
    this.conditions = data.conditions || []; // When this insight applies
    this.relatedInsights = data.relatedInsights || [];
    this.reusable = data.reusable !== false; // Can be applied to other enterprises
    this.status = 'draft';
    this.approvedAt = data.approvedAt;
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.title) throw new Error('title required');
    if (!this.domain) throw new Error('domain required');
    if (this.confidence < 0 || this.confidence > 1) throw new Error('confidence must be 0-1');
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { 
    this.status = 'approved';
    this.approvedAt = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      domain: this.domain,
      description: this.description,
      type: this.type,
      source: this.source,
      impact: this.impact,
      confidence: this.confidence,
      applicability: this.applicability,
      conditions: this.conditions,
      relatedInsights: this.relatedInsights,
      reusable: this.reusable,
      status: this.status,
      approvedAt: this.approvedAt,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningRecommendation
 * Actionable suggestions based on insights
 */
export class LearningRecommendation {
  constructor(data) {
    if (!data.title) throw new Error('LearningRecommendation requires title');
    if (!data.insight) throw new Error('LearningRecommendation requires insight reference');

    this.id = generateId('rec');
    this.title = data.title;
    this.insight = data.insight;        // Reference to LearningInsight
    this.domain = data.domain || '';
    this.description = data.description || '';
    this.action = data.action || '';    // Specific action to take
    this.priority = data.priority || 'medium'; // "low" | "medium" | "high" | "critical"
    this.expectedBenefit = data.expectedBenefit || '';
    this.effort = data.effort || 'medium'; // "low" | "medium" | "high"
    this.riskLevel = data.riskLevel || 'low'; // "low" | "medium" | "high"
    this.implementationSteps = data.implementationSteps || [];
    this.metrics = data.metrics || []; // Success metrics
    this.targetDate = data.targetDate;
    this.status = 'draft'; // draft → proposed → approved → implemented
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.title) throw new Error('title required');
    if (!this.insight) throw new Error('insight required');
  }

  markDefined() { this.status = 'defined'; return this; }
  markProposed() { this.status = 'proposed'; return this; }
  markApproved() { this.status = 'approved'; return this; }
  markImplemented() { this.status = 'implemented'; return this; }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      insight: this.insight,
      domain: this.domain,
      description: this.description,
      action: this.action,
      priority: this.priority,
      expectedBenefit: this.expectedBenefit,
      effort: this.effort,
      riskLevel: this.riskLevel,
      implementationSteps: this.implementationSteps,
      metrics: this.metrics,
      targetDate: this.targetDate,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningSnapshot
 * Time-scoped collection of all learning components
 */
export class LearningSnapshot {
  constructor(data) {
    if (!data.period) throw new Error('LearningSnapshot requires period');

    this.id = generateId('snap');
    this.period = data.period;           // "1h" | "1d" | "1w" | "1mo"
    this.timestamp = data.timestamp || new Date().toISOString();
    this.observations = data.observations || [];
    this.signals = data.signals || [];
    this.metrics = data.metrics || [];
    this.patterns = data.patterns || [];
    this.hypotheses = data.hypotheses || [];
    this.insights = data.insights || [];
    this.recommendations = data.recommendations || [];
    this.domains = data.domains || [];
    this.comparisons = data.comparisons || {
      plannedVsActual: [],
      simulatedVsActual: [],
      predictedVsActual: [],
      decisionVsOutcome: []
    };
    this.metrics_summary = data.metrics_summary || {};
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  validate() {
    if (!this.period) throw new Error('period required');
  }

  markDefined() { this.status = 'defined'; return this; }
  markAnalyzed() { this.status = 'analyzed'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  toJSON() {
    return {
      id: this.id,
      period: this.period,
      timestamp: this.timestamp,
      observations: this.observations,
      signals: this.signals,
      metrics: this.metrics,
      patterns: this.patterns,
      hypotheses: this.hypotheses,
      insights: this.insights,
      recommendations: this.recommendations,
      domains: this.domains,
      comparisons: this.comparisons,
      metrics_summary: this.metrics_summary,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * LearningResult
 * Aggregated learning output
 */
export class LearningResult {
  constructor() {
    this.id = generateId('result');
    this.observations = [];
    this.signals = [];
    this.metrics = [];
    this.patterns = [];
    this.hypotheses = [];
    this.insights = [];
    this.recommendations = [];
    this.snapshots = [];
    this.comparisons = {
      plannedVsActual: [],
      simulatedVsActual: [],
      predictedVsActual: [],
      decisionVsOutcome: []
    };
    this.status = 'draft';
    this.validationErrors = [];
    this.validationWarnings = [];
    this.metrics_data = {};
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      observations: this.observations.length,
      signals: this.signals.length,
      metrics: this.metrics.length,
      patterns: this.patterns.length,
      hypotheses: this.hypotheses.length,
      insights: this.insights.length,
      recommendations: this.recommendations.length,
      snapshots: this.snapshots.length,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}
