/**
 * Decision Blueprint - Metadata-Driven Enterprise Decision Contracts
 * 
 * This module defines the complete contract system for enterprise decision evaluation.
 * All decision-making is based on metadata criteria, constraints, and simulation results.
 * 
 * Supported evaluation criteria:
 * - cost: Total implementation cost
 * - revenue: Revenue impact
 * - profitability: Profit margin impact
 * - schedule: Timeline impact (days)
 * - resource: Resource utilization efficiency
 * - customer: Customer satisfaction impact
 * - operational: Operational risk level
 * - strategic: Strategic alignment score
 * - compliance: Policy and regulatory compliance
 */

import crypto from 'crypto';

/**
 * DecisionCriteria - Defines a single evaluation criterion
 */
export class DecisionCriteria {
  constructor(data = {}) {
    this.id = data.id || `crit-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Criterion';
    this.type = data.type || 'cost'; // cost, revenue, profitability, schedule, resource, customer, operational, strategic, compliance
    this.weight = data.weight || 1.0; // 0-1, importance multiplier
    this.direction = data.direction || 'lower'; // lower (minimize) or higher (maximize)
    this.unit = data.unit || '';
    this.description = data.description || '';
    this.status = 'active'; // active, inactive, deprecated
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Criteria name must be a non-empty string');
    }
    if (!['cost', 'revenue', 'profitability', 'schedule', 'resource', 'customer', 'operational', 'strategic', 'compliance'].includes(this.type)) {
      throw new Error('Invalid criteria type');
    }
    if (this.weight < 0 || this.weight > 1) {
      throw new Error('Weight must be between 0 and 1');
    }
    if (!['lower', 'higher'].includes(this.direction)) {
      throw new Error('Direction must be "lower" or "higher"');
    }
    return true;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      weight: this.weight,
      direction: this.direction
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      weight: this.weight,
      direction: this.direction,
      unit: this.unit,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionConstraint - Hard constraint that must be satisfied
 */
export class DecisionConstraint {
  constructor(data = {}) {
    this.id = data.id || `dconst-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Constraint';
    this.type = data.type || 'hard'; // hard (must satisfy) or soft (prefer)
    this.criteria = data.criteria || ''; // Which criteria this constrains
    this.operator = data.operator || '<='; // <=, >=, ==, !=
    this.threshold = data.threshold || 0;
    this.description = data.description || '';
    this.violation = data.violation || 'exclude'; // exclude or penalize
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Constraint name must be a non-empty string');
    }
    if (!['hard', 'soft'].includes(this.type)) {
      throw new Error('Constraint type must be "hard" or "soft"');
    }
    if (!['<=', '>=', '==', '!='].includes(this.operator)) {
      throw new Error('Invalid operator');
    }
    return true;
  }

  isSatisfied(value) {
    switch (this.operator) {
      case '<=': return value <= this.threshold;
      case '>=': return value >= this.threshold;
      case '==': return value === this.threshold;
      case '!=': return value !== this.threshold;
      default: return false;
    }
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      operator: this.operator,
      threshold: this.threshold
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      criteria: this.criteria,
      operator: this.operator,
      threshold: this.threshold,
      description: this.description,
      violation: this.violation,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionOption - Represents an alternative plan to evaluate
 */
export class DecisionOption {
  constructor(data = {}) {
    this.id = data.id || `opt-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Option';
    this.description = data.description || '';
    this.planId = data.planId || '';
    this.planDetails = data.planDetails || {}; // From planning engine
    this.simulationId = data.simulationId || '';
    this.simulationResults = data.simulationResults || {}; // From simulation engine
    this.metrics = data.metrics || {}; // Values for evaluation criteria
    this.assumptions = data.assumptions || [];
    this.risks = data.risks || [];
    this.cost = data.cost || 0;
    this.revenue = data.revenue || 0;
    this.profitability = data.profitability || 0;
    this.schedule = data.schedule || 0; // days
    this.resourceUtilization = data.resourceUtilization || 0; // 0-100
    this.customerImpact = data.customerImpact || 0; // 0-100
    this.operationalRisk = data.operationalRisk || 0; // 0-100
    this.strategicAlignment = data.strategicAlignment || 0; // 0-100
    this.complianceScore = data.complianceScore || 0; // 0-100
    this.status = 'draft'; // draft, evaluated, selected, rejected
    this.createdAt = new Date().toISOString();
  }

  getAllMetrics() {
    return {
      cost: this.cost,
      revenue: this.revenue,
      profitability: this.profitability,
      schedule: this.schedule,
      resourceUtilization: this.resourceUtilization,
      customerImpact: this.customerImpact,
      operationalRisk: this.operationalRisk,
      strategicAlignment: this.strategicAlignment,
      complianceScore: this.complianceScore
    };
  }

  getMetricValue(criteriaType) {
    const metrics = this.getAllMetrics();
    return metrics[criteriaType] || 0;
  }

  markEvaluated() {
    this.status = 'evaluated';
    return this;
  }

  markSelected() {
    this.status = 'selected';
    return this;
  }

  markRejected() {
    this.status = 'rejected';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      planId: this.planId,
      status: this.status,
      cost: this.cost,
      revenue: this.revenue,
      schedule: this.schedule
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      planId: this.planId,
      simulationId: this.simulationId,
      metrics: this.getAllMetrics(),
      assumptions: this.assumptions,
      risks: this.risks,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionScore - Scoring result for an option
 */
export class DecisionScore {
  constructor(data = {}) {
    this.id = data.id || `score-${crypto.randomBytes(4).toString('hex')}`;
    this.optionId = data.optionId || '';
    this.criteriaScores = data.criteriaScores || {}; // Map of criteria ID -> score
    this.totalScore = data.totalScore || 0;
    this.normalizedScore = data.normalizedScore || 0; // 0-100
    this.rank = data.rank || 0;
    this.constraintStatus = data.constraintStatus || {}; // Map of constraint ID -> boolean
    this.constraintViolations = data.constraintViolations || [];
    this.breakdownByType = data.breakdownByType || {}; // Grouped scores by criteria type
    this.createdAt = new Date().toISOString();
  }

  recordCriteriaScore(criteriaId, score) {
    this.criteriaScores[criteriaId] = score;
    return this;
  }

  recordConstraintStatus(constraintId, satisfied) {
    this.constraintStatus[constraintId] = satisfied;
    if (!satisfied) {
      this.constraintViolations.push(constraintId);
    }
    return this;
  }

  hasViolations() {
    return this.constraintViolations.length > 0;
  }

  getSummary() {
    return {
      optionId: this.optionId,
      totalScore: this.totalScore,
      normalizedScore: this.normalizedScore,
      rank: this.rank,
      violations: this.constraintViolations.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      optionId: this.optionId,
      criteriaScores: this.criteriaScores,
      totalScore: this.totalScore,
      normalizedScore: this.normalizedScore,
      rank: this.rank,
      constraintStatus: this.constraintStatus,
      constraintViolations: this.constraintViolations,
      breakdownByType: this.breakdownByType,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionExplanation - Explains the reasoning behind a decision
 */
export class DecisionExplanation {
  constructor(data = {}) {
    this.id = data.id || `expl-${crypto.randomBytes(4).toString('hex')}`;
    this.decisionId = data.decisionId || '';
    this.recommendedOptionId = data.recommendedOptionId || '';
    this.summary = data.summary || '';
    this.rationale = data.rationale || [];
    this.strengths = data.strengths || [];
    this.weaknesses = data.weaknesses || [];
    this.tradeoffs = data.tradeoffs || [];
    this.riskFactors = data.riskFactors || [];
    this.alternativeConsiderations = data.alternativeConsiderations || [];
    this.assumptions = data.assumptions || [];
    this.nextSteps = data.nextSteps || [];
    this.confidence = data.confidence || 0; // 0-100
    this.createdAt = new Date().toISOString();
  }

  addRationale(point) {
    this.rationale.push(point);
    return this;
  }

  addStrength(strength) {
    this.strengths.push(strength);
    return this;
  }

  addWeakness(weakness) {
    this.weaknesses.push(weakness);
    return this;
  }

  addTradeoff(tradeoff) {
    this.tradeoffs.push(tradeoff);
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      recommendedOptionId: this.recommendedOptionId,
      summary: this.summary,
      confidence: this.confidence,
      strengths: this.strengths.length,
      weaknesses: this.weaknesses.length,
      tradeoffs: this.tradeoffs.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      decisionId: this.decisionId,
      recommendedOptionId: this.recommendedOptionId,
      summary: this.summary,
      rationale: this.rationale,
      strengths: this.strengths,
      weaknesses: this.weaknesses,
      tradeoffs: this.tradeoffs,
      riskFactors: this.riskFactors,
      alternativeConsiderations: this.alternativeConsiderations,
      assumptions: this.assumptions,
      nextSteps: this.nextSteps,
      confidence: this.confidence,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionRecommendation - The recommended action
 */
export class DecisionRecommendation {
  constructor(data = {}) {
    this.id = data.id || `rec-${crypto.randomBytes(4).toString('hex')}`;
    this.decisionId = data.decisionId || '';
    this.recommendedOptionId = data.recommendedOptionId || '';
    this.recommendedOption = data.recommendedOption || null;
    this.priority = data.priority || 'high'; // low, medium, high, critical
    this.confidence = data.confidence || 0; // 0-100
    this.expectedOutcome = data.expectedOutcome || '';
    this.implementation = data.implementation || '';
    this.timeline = data.timeline || '';
    this.dependencies = data.dependencies || [];
    this.successCriteria = data.successCriteria || [];
    this.status = 'draft'; // draft, approved, in-execution, completed
    this.createdAt = new Date().toISOString();
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  markExecuting() {
    this.status = 'in-execution';
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      recommendedOptionId: this.recommendedOptionId,
      priority: this.priority,
      confidence: this.confidence,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      decisionId: this.decisionId,
      recommendedOptionId: this.recommendedOptionId,
      priority: this.priority,
      confidence: this.confidence,
      expectedOutcome: this.expectedOutcome,
      implementation: this.implementation,
      timeline: this.timeline,
      dependencies: this.dependencies,
      successCriteria: this.successCriteria,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * DecisionContext - Context for decision evaluation
 */
export class DecisionContext {
  constructor(data = {}) {
    this.id = data.id || `dctx-${crypto.randomBytes(4).toString('hex')}`;
    this.tenantId = data.tenantId || 'default';
    this.organizationId = data.organizationId || '';
    this.decisionType = data.decisionType || 'enterprise'; // enterprise, departmental, module
    this.businessObjective = data.businessObjective || '';
    this.decisionHorizon = data.decisionHorizon || 90; // days
    this.executionMode = data.executionMode || 'analysis'; // analysis, dry-run, decision, execution
    this.criteria = data.criteria || []; // DecisionCriteria[]
    this.constraints = data.constraints || []; // DecisionConstraint[]
    this.policies = data.policies || [];
    this.status = 'draft'; // draft, active, completed
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.tenantId || typeof this.tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!['enterprise', 'departmental', 'module'].includes(this.decisionType)) {
      throw new Error('Invalid decision type');
    }
    if (!['analysis', 'dry-run', 'decision', 'execution'].includes(this.executionMode)) {
      throw new Error('Invalid execution mode');
    }
    return true;
  }

  markActive() {
    this.status = 'active';
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      decisionType: this.decisionType,
      businessObjective: this.businessObjective,
      criteriaCount: this.criteria.length,
      constraintCount: this.constraints.length,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      decisionType: this.decisionType,
      businessObjective: this.businessObjective,
      decisionHorizon: this.decisionHorizon,
      executionMode: this.executionMode,
      criteria: this.criteria.map(c => c.toJSON ? c.toJSON() : c),
      constraints: this.constraints.map(c => c.toJSON ? c.toJSON() : c),
      policies: this.policies,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * EnterpriseDecision - Main decision contract
 */
export class EnterpriseDecision {
  constructor(data = {}) {
    this.id = data.id || `dec-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Decision';
    this.description = data.description || '';
    this.businessObjective = data.businessObjective || '';
    this.context = data.context || null; // DecisionContext
    this.options = data.options || []; // DecisionOption[]
    this.scores = data.scores || []; // DecisionScore[]
    this.rankedOptions = data.rankedOptions || []; // Ranked option IDs
    this.selectedOption = data.selectedOption || null; // DecisionOption
    this.recommendation = data.recommendation || null; // DecisionRecommendation
    this.explanation = data.explanation || null; // DecisionExplanation
    this.metadata = {
      createdBy: data.createdBy || 'system',
      approvedBy: data.approvedBy || '',
      reviewedAt: '',
      decidedAt: '',
      implementedAt: ''
    };
    this.status = 'draft'; // draft, validated, evaluated, decided, approved, executing, completed
    this.version = 1;
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Decision name must be a non-empty string');
    }
    return true;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  markEvaluated() {
    this.status = 'evaluated';
    return this;
  }

  markDecided(selectedOptionId) {
    this.status = 'decided';
    this.selectedOption = this.options.find(o => o.id === selectedOptionId);
    this.metadata.decidedAt = new Date().toISOString();
    return this;
  }

  markApproved(approvedBy = 'system') {
    this.status = 'approved';
    this.metadata.approvedBy = approvedBy;
    this.metadata.reviewedAt = new Date().toISOString();
    return this;
  }

  markExecuting() {
    this.status = 'executing';
    this.metadata.implementedAt = new Date().toISOString();
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      businessObjective: this.businessObjective,
      status: this.status,
      optionCount: this.options.length,
      selectedOption: this.selectedOption ? this.selectedOption.name : null,
      recommendationConfidence: this.recommendation ? this.recommendation.confidence : 0
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      businessObjective: this.businessObjective,
      context: this.context ? (this.context.toJSON ? this.context.toJSON() : this.context) : null,
      options: this.options.map(o => o.toJSON ? o.toJSON() : o),
      scores: this.scores.map(s => s.toJSON ? s.toJSON() : s),
      rankedOptions: this.rankedOptions,
      selectedOption: this.selectedOption ? (this.selectedOption.toJSON ? this.selectedOption.toJSON() : this.selectedOption) : null,
      recommendation: this.recommendation ? (this.recommendation.toJSON ? this.recommendation.toJSON() : this.recommendation) : null,
      explanation: this.explanation ? (this.explanation.toJSON ? this.explanation.toJSON() : this.explanation) : null,
      metadata: this.metadata,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt
    };
  }
}
