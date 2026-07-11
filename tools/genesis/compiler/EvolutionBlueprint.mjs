/**
 * EvolutionBlueprint.mjs
 *
 * Evolution Engine contract definitions for Genesis
 * Defines 6 canonical contracts for enterprise evolution analysis
 *
 * @module tools/genesis/compiler/EvolutionBlueprint.mjs
 */

import { randomBytes } from 'crypto';

/**
 * EvolutionObservation - Observation of structural opportunities or issues
 */
export class EvolutionObservation {
  constructor(data) {
    if (!data.domain) throw new Error('EvolutionObservation requires domain');
    if (!data.aspect) throw new Error('EvolutionObservation requires aspect');
    if (data.severity === undefined) throw new Error('EvolutionObservation requires severity');

    this.id = `obs-${randomBytes(6).toString('hex')}`;
    this.domain = data.domain; // e.g., "workflow", "module", "application", "organization"
    this.aspect = data.aspect; // What is being observed
    this.description = data.description || '';
    this.severity = data.severity; // 0-1 scale
    this.source = data.source || 'analysis'; // e.g., "learning", "simulation", "runtime", "decision"
    this.evidence = data.evidence || []; // References to source data
    this.confidence = data.confidence || 0.8;
    this.timestamp = new Date().toISOString();
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  markDefined() {
    this.status = 'defined';
    return this;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      domain: this.domain,
      aspect: this.aspect,
      description: this.description,
      severity: this.severity,
      source: this.source,
      evidence: this.evidence,
      confidence: this.confidence,
      timestamp: this.timestamp,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * EvolutionCandidate - Candidate for structural improvement
 */
export class EvolutionCandidate {
  constructor(data) {
    if (!data.type) throw new Error('EvolutionCandidate requires type');
    if (!data.name) throw new Error('EvolutionCandidate requires name');

    this.id = `cand-${randomBytes(6).toString('hex')}`;
    this.type = data.type; // "workflow_redesign", "module_boundary", "app_composition", "org_structure", etc.
    this.name = data.name;
    this.description = data.description || '';
    this.observations = data.observations || []; // EvolutionObservation IDs
    this.affectedEntities = data.affectedEntities || []; // What entities are affected
    this.estimatedComplexity = data.estimatedComplexity || 'medium'; // low, medium, high, critical
    this.timelineWeeks = data.timelineWeeks || 4;
    this.prerequisites = data.prerequisites || [];
    this.risks = data.risks || [];
    this.dependencies = data.dependencies || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
  }

  markDefined() {
    this.status = 'defined';
    return this;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      observations: this.observations,
      affectedEntities: this.affectedEntities,
      estimatedComplexity: this.estimatedComplexity,
      timelineWeeks: this.timelineWeeks,
      prerequisites: this.prerequisites,
      risks: this.risks,
      dependencies: this.dependencies,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * EvolutionImpact - Expected impact of an evolution change
 */
export class EvolutionImpact {
  constructor(data) {
    if (!data.category) throw new Error('EvolutionImpact requires category');
    if (data.value === undefined) throw new Error('EvolutionImpact requires value');

    this.id = `imp-${randomBytes(6).toString('hex')}`;
    this.category = data.category; // "efficiency", "agility", "cost", "quality", "scalability", "maintainability"
    this.description = data.description || '';
    this.value = data.value; // Expected improvement as decimal (1.15 = 15% improvement)
    this.unit = data.unit || '%';
    this.timeframe = data.timeframe || '6months'; // When improvement realized
    this.confidence = data.confidence || 0.7;
    this.metrics = data.metrics || []; // Specific metrics affected
    this.status = 'draft';
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      category: this.category,
      description: this.description,
      value: this.value,
      unit: this.unit,
      timeframe: this.timeframe,
      confidence: this.confidence,
      metrics: this.metrics,
      status: this.status
    };
  }
}

/**
 * EvolutionConfidence - Confidence assessment for evolution change
 */
export class EvolutionConfidence {
  constructor(data) {
    if (data.score === undefined) throw new Error('EvolutionConfidence requires score');

    this.id = `conf-${randomBytes(6).toString('hex')}`;
    this.score = data.score; // 0-1
    this.reasoning = data.reasoning || '';
    this.evidenceQuality = data.evidenceQuality || 'medium'; // low, medium, high
    this.historicalSuccess = data.historicalSuccess || 0.5; // 0-1 based on similar changes
    this.riskFactors = data.riskFactors || [];
    this.successFactors = data.successFactors || [];
    this.assumptions = data.assumptions || [];
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      score: this.score,
      reasoning: this.reasoning,
      evidenceQuality: this.evidenceQuality,
      historicalSuccess: this.historicalSuccess,
      riskFactors: this.riskFactors,
      successFactors: this.successFactors,
      assumptions: this.assumptions,
      createdAt: this.createdAt
    };
  }
}

/**
 * EvolutionProposal - Complete evolution proposal with all details
 */
export class EvolutionProposal {
  constructor(data) {
    if (!data.candidate) throw new Error('EvolutionProposal requires candidate');
    if (!data.impacts || data.impacts.length === 0) throw new Error('EvolutionProposal requires impacts');

    this.id = `prop-${randomBytes(6).toString('hex')}`;
    this.candidate = data.candidate; // EvolutionCandidate ID
    this.candidate_obj = data.candidate_obj || null;
    this.title = data.title || '';
    this.description = data.description || '';
    this.impacts = data.impacts; // EvolutionImpact[]
    this.confidence = data.confidence || new EvolutionConfidence({ score: 0.7 });
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.implementationPhases = data.implementationPhases || [];
    this.requiredResources = data.requiredResources || [];
    this.successCriteria = data.successCriteria || [];
    this.rollbackPlan = data.rollbackPlan || '';
    this.stakeholders = data.stakeholders || [];
    this.estimatedROI = data.estimatedROI || 0; // Expected return on investment
    this.status = 'draft'; // draft → proposed → approved → implemented
    this.approvalChain = data.approvalChain || [];
    this.createdAt = new Date().toISOString();
  }

  markProposed() {
    this.status = 'proposed';
    return this;
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  markImplemented() {
    this.status = 'implemented';
    return this;
  }

  addApproval(approver, decision) {
    this.approvalChain.push({
      approver,
      decision,
      timestamp: new Date().toISOString()
    });
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      candidate: this.candidate,
      title: this.title,
      description: this.description,
      impacts: this.impacts.map(i => i.toJSON ? i.toJSON() : i),
      confidence: this.confidence.toJSON ? this.confidence.toJSON() : this.confidence,
      priority: this.priority,
      implementationPhases: this.implementationPhases,
      requiredResources: this.requiredResources,
      successCriteria: this.successCriteria,
      rollbackPlan: this.rollbackPlan,
      stakeholders: this.stakeholders,
      estimatedROI: this.estimatedROI,
      status: this.status,
      approvalChain: this.approvalChain,
      createdAt: this.createdAt
    };
  }
}

/**
 * EvolutionRecommendation - Ranked evolution recommendations
 */
export class EvolutionRecommendation {
  constructor(data) {
    if (!data.proposals || data.proposals.length === 0) throw new Error('EvolutionRecommendation requires proposals');

    this.id = `rec-${randomBytes(6).toString('hex')}`;
    this.proposals = data.proposals; // Ranked EvolutionProposal[] (best first)
    this.analysisDate = new Date().toISOString();
    this.totalOpportunities = data.totalOpportunities || 0;
    this.highPriorityCount = data.highPriorityCount || 0;
    this.estimatedTotalROI = data.estimatedTotalROI || 0;
    this.recommendedPhasing = data.recommendedPhasing || []; // Suggested order of implementation
    this.criticalDependencies = data.criticalDependencies || [];
    this.riskMitigation = data.riskMitigation || {};
    this.nextReviewDate = data.nextReviewDate || '';
    this.status = 'draft'; // draft → presented → approved → implementation_planned
    this.createdAt = new Date().toISOString();
  }

  markPresented() {
    this.status = 'presented';
    return this;
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      proposals: this.proposals.map(p => p.toJSON ? p.toJSON() : p),
      analysisDate: this.analysisDate,
      totalOpportunities: this.totalOpportunities,
      highPriorityCount: this.highPriorityCount,
      estimatedTotalROI: this.estimatedTotalROI,
      recommendedPhasing: this.recommendedPhasing,
      criticalDependencies: this.criticalDependencies,
      riskMitigation: this.riskMitigation,
      nextReviewDate: this.nextReviewDate,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * EvolutionResult - Complete evolution analysis output
 */
export class EvolutionResult {
  constructor() {
    this.id = `result-${randomBytes(6).toString('hex')}`;
    this.observations = [];
    this.candidates = [];
    this.proposals = [];
    this.recommendation = null;
    this.status = 'draft'; // draft → success → partial → failed
    this.validationErrors = [];
    this.validationWarnings = [];
    this.metrics = {
      observationsCaptured: 0,
      candidatesIdentified: 0,
      proposalsGenerated: 0,
      impactsAssessed: 0,
      highPriorityProposals: 0,
      totalEstimatedROI: 0
    };
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      observations: this.observations.map(o => o.toJSON ? o.toJSON() : o),
      candidates: this.candidates.map(c => c.toJSON ? c.toJSON() : c),
      proposals: this.proposals.map(p => p.toJSON ? p.toJSON() : p),
      recommendation: this.recommendation ? (this.recommendation.toJSON ? this.recommendation.toJSON() : this.recommendation) : null,
      status: this.status,
      validationErrors: this.validationErrors,
      validationWarnings: this.validationWarnings,
      metrics: this.metrics,
      createdAt: this.createdAt
    };
  }
}
