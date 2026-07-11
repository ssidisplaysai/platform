/**
 * Planning Blueprint - Metadata-Driven Enterprise Planning Contracts
 * 
 * This module defines the complete contract system for enterprise planning.
 * All planning is derived from runtime state and metadata, with no hardcoded business logic.
 * 
 * Supported domains:
 * - operations: Operational efficiency and process optimization
 * - manufacturing: Production planning and scheduling
 * - inventory: Stock levels and replenishment strategies
 * - purchasing: Procurement and vendor management
 * - projects: Project timelines and resource allocation
 * - staffing: Team composition and capacity planning
 * - maintenance: Preventive maintenance and equipment management
 * - sales: Revenue optimization and market positioning
 */

import crypto from 'crypto';

/**
 * PlanningGoal - Represents a strategic or operational goal
 * Goals drive planning decisions and help prioritize actions
 */
export class PlanningGoal {
  constructor(data = {}) {
    this.id = data.id || `goal-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Goal';
    this.domain = data.domain || 'operations'; // operations, manufacturing, inventory, purchasing, projects, staffing, maintenance, sales
    this.description = data.description || '';
    this.targetMetric = data.targetMetric || '';
    this.currentValue = data.currentValue || 0;
    this.targetValue = data.targetValue || 0;
    this.timeframe = data.timeframe || 30; // days
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.status = 'draft'; // draft, active, achieved, abandoned
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Goal name must be a non-empty string');
    }
    if (!['operations', 'manufacturing', 'inventory', 'purchasing', 'projects', 'staffing', 'maintenance', 'sales'].includes(this.domain)) {
      throw new Error('Invalid planning domain');
    }
    if (!['low', 'medium', 'high', 'critical'].includes(this.priority)) {
      throw new Error('Invalid priority level');
    }
    return true;
  }

  markActive() {
    this.status = 'active';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      priority: this.priority,
      targetValue: this.targetValue,
      currentValue: this.currentValue,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      description: this.description,
      targetMetric: this.targetMetric,
      currentValue: this.currentValue,
      targetValue: this.targetValue,
      timeframe: this.timeframe,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlanningConstraint - Represents a constraint on planning decisions
 * Constraints limit the scope of possible actions
 */
export class PlanningConstraint {
  constructor(data = {}) {
    this.id = data.id || `constraint-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Constraint';
    this.type = data.type || 'budget'; // budget, time, resource, regulatory, technical, capacity
    this.value = data.value || 0;
    this.unit = data.unit || ''; // currency, days, count, percentage, etc.
    this.scope = data.scope || 'enterprise'; // enterprise, department, module, entity
    this.severity = data.severity || 'medium'; // low, medium, high, critical
    this.status = 'draft'; // draft, active, violated
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Constraint name must be a non-empty string');
    }
    if (!['budget', 'time', 'resource', 'regulatory', 'technical', 'capacity'].includes(this.type)) {
      throw new Error('Invalid constraint type');
    }
    return true;
  }

  markActive() {
    this.status = 'active';
    return this;
  }

  markViolated() {
    this.status = 'violated';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      value: this.value,
      unit: this.unit,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      value: this.value,
      unit: this.unit,
      scope: this.scope,
      severity: this.severity,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlanningAction - Represents a recommended or planned action
 * Actions are the concrete steps to achieve goals
 */
export class PlanningAction {
  constructor(data = {}) {
    this.id = data.id || `action-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Action';
    this.domain = data.domain || 'operations';
    this.description = data.description || '';
    this.type = data.type || 'optimize'; // optimize, create, modify, retire, automate, scale, migrate
    this.targetObject = data.targetObject || ''; // ID of target object/module/entity
    this.targetType = data.targetType || ''; // module, entity, workflow, automation, etc.
    this.priority = data.priority || 'medium';
    this.estimatedEffort = data.estimatedEffort || 0; // hours
    this.estimatedImpact = data.estimatedImpact || 0; // 0-100 scale
    this.confidence = data.confidence || 0; // 0-100 scale
    this.dependencies = data.dependencies || []; // IDs of dependent actions
    this.constraints = data.constraints || []; // IDs of applicable constraints
    this.assumptions = data.assumptions || [];
    this.risks = data.risks || [];
    this.status = 'draft'; // draft, proposed, scheduled, in-progress, completed, rejected
    this.rationale = data.rationale || ''; // Why this action is recommended
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Action name must be a non-empty string');
    }
    if (!['optimize', 'create', 'modify', 'retire', 'automate', 'scale', 'migrate'].includes(this.type)) {
      throw new Error('Invalid action type');
    }
    return true;
  }

  markProposed() {
    this.status = 'proposed';
    return this;
  }

  markScheduled() {
    this.status = 'scheduled';
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
      type: this.type,
      priority: this.priority,
      estimatedEffort: this.estimatedEffort,
      estimatedImpact: this.estimatedImpact,
      confidence: this.confidence,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      description: this.description,
      type: this.type,
      targetObject: this.targetObject,
      targetType: this.targetType,
      priority: this.priority,
      estimatedEffort: this.estimatedEffort,
      estimatedImpact: this.estimatedImpact,
      confidence: this.confidence,
      dependencies: this.dependencies,
      constraints: this.constraints,
      assumptions: this.assumptions,
      risks: this.risks,
      status: this.status,
      rationale: this.rationale,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlanningRecommendation - Represents a recommendation or strategy
 * Recommendations are higher-level guidance based on analysis
 */
export class PlanningRecommendation {
  constructor(data = {}) {
    this.id = data.id || `rec-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Recommendation';
    this.domain = data.domain || 'operations';
    this.description = data.description || '';
    this.category = data.category || 'process'; // process, technology, organizational, financial, strategic
    this.impactArea = data.impactArea || ''; // Which metrics/areas affected
    this.expectedBenefit = data.expectedBenefit || ''; // Quantified or qualified benefit
    this.implementationCost = data.implementationCost || 'medium'; // low, medium, high, very-high
    this.timeToValue = data.timeToValue || 'medium'; // immediate, short-term, medium-term, long-term
    this.confidence = data.confidence || 0; // 0-100
    this.basedOn = data.basedOn || []; // IDs of analysis/metrics this is based on
    this.actions = data.actions || []; // IDs of actions to implement
    this.alternatives = data.alternatives || []; // IDs of alternative recommendations
    this.status = 'draft'; // draft, approved, implemented, rejected
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Recommendation name must be a non-empty string');
    }
    if (!['process', 'technology', 'organizational', 'financial', 'strategic'].includes(this.category)) {
      throw new Error('Invalid recommendation category');
    }
    return true;
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  markImplemented() {
    this.status = 'implemented';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      confidence: this.confidence,
      expectedBenefit: this.expectedBenefit,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      description: this.description,
      category: this.category,
      impactArea: this.impactArea,
      expectedBenefit: this.expectedBenefit,
      implementationCost: this.implementationCost,
      timeToValue: this.timeToValue,
      confidence: this.confidence,
      basedOn: this.basedOn,
      actions: this.actions,
      alternatives: this.alternatives,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlanningContext - Context for planning execution
 * Contains tenant, scope, and execution mode information
 */
export class PlanningContext {
  constructor(data = {}) {
    this.id = data.id || `ctx-${crypto.randomBytes(4).toString('hex')}`;
    this.tenantId = data.tenantId || 'default';
    this.organizationId = data.organizationId || '';
    this.planningDomain = data.planningDomain || 'operations'; // Which domain to plan for
    this.planningLevel = data.planningLevel || 'enterprise'; // enterprise, department, module
    this.planningHorizon = data.planningHorizon || 90; // days
    this.executionMode = data.executionMode || 'analysis'; // analysis, dry-run, planning, execution
    this.constraints = data.constraints || [];
    this.goals = data.goals || [];
    this.status = 'draft'; // draft, active, completed
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.tenantId || typeof this.tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!['operations', 'manufacturing', 'inventory', 'purchasing', 'projects', 'staffing', 'maintenance', 'sales'].includes(this.planningDomain)) {
      throw new Error('Invalid planning domain');
    }
    if (!['analysis', 'dry-run', 'planning', 'execution'].includes(this.executionMode)) {
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
      planningDomain: this.planningDomain,
      planningLevel: this.planningLevel,
      planningHorizon: this.planningHorizon,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      organizationId: this.organizationId,
      planningDomain: this.planningDomain,
      planningLevel: this.planningLevel,
      planningHorizon: this.planningHorizon,
      executionMode: this.executionMode,
      constraints: this.constraints,
      goals: this.goals,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlanningResult - Result of planning execution
 * Contains generated actions, recommendations, and metrics
 */
export class PlanningResult {
  constructor(data = {}) {
    this.id = data.id || `result-${crypto.randomBytes(4).toString('hex')}`;
    this.planId = data.planId || '';
    this.planningDomain = data.planningDomain || 'operations';
    this.actions = data.actions || []; // PlanningAction instances
    this.recommendations = data.recommendations || []; // PlanningRecommendation instances
    this.alternativePlans = data.alternativePlans || []; // Alternative planning approaches
    this.metrics = {
      totalActionsGenerated: 0,
      highPriorityActions: 0,
      totalRecommendations: 0,
      implementationTimeframe: 0, // days
      estimatedTotalEffort: 0, // hours
      estimatedTotalImpact: 0, // 0-100
      averageConfidence: 0, // 0-100
      affectedModules: 0,
      affectedObjects: 0,
      constraintsConsidered: 0,
      goalsAddressed: 0
    };
    this.status = 'draft'; // draft, approved, in-execution, completed
    this.createdAt = new Date().toISOString();
  }

  recordAction(action) {
    this.actions.push(action);
    this.metrics.totalActionsGenerated++;
    if (action.priority === 'high' || action.priority === 'critical') {
      this.metrics.highPriorityActions++;
    }
    this.metrics.estimatedTotalEffort += action.estimatedEffort;
    this.metrics.estimatedTotalImpact = Math.min(100, this.metrics.estimatedTotalImpact + action.estimatedImpact);
    return this;
  }

  recordRecommendation(recommendation) {
    this.recommendations.push(recommendation);
    this.metrics.totalRecommendations++;
    return this;
  }

  recordAlternativePlan(plan) {
    this.alternativePlans.push(plan);
    return this;
  }

  finalize() {
    // Calculate average confidence
    const allItems = [...this.actions, ...this.recommendations];
    if (allItems.length > 0) {
      const totalConfidence = allItems.reduce((sum, item) => sum + (item.confidence || 0), 0);
      this.metrics.averageConfidence = Math.round(totalConfidence / allItems.length);
    }
    this.status = 'approved';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      planningDomain: this.planningDomain,
      totalActions: this.metrics.totalActionsGenerated,
      highPriorityActions: this.metrics.highPriorityActions,
      totalRecommendations: this.metrics.totalRecommendations,
      averageConfidence: this.metrics.averageConfidence,
      estimatedImpact: this.metrics.estimatedTotalImpact,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      planId: this.planId,
      planningDomain: this.planningDomain,
      actions: this.actions.map(a => a.toJSON ? a.toJSON() : a),
      recommendations: this.recommendations.map(r => r.toJSON ? r.toJSON() : r),
      alternativePlans: this.alternativePlans,
      metrics: this.metrics,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * EnterprisePlan - Main planning contract
 * Represents a complete enterprise plan with goals, constraints, actions, and recommendations
 */
export class EnterprisePlan {
  constructor(data = {}) {
    this.id = data.id || `plan-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Enterprise Plan';
    this.domain = data.domain || 'operations';
    this.description = data.description || '';
    this.goals = data.goals || []; // PlanningGoal instances
    this.constraints = data.constraints || []; // PlanningConstraint instances
    this.context = data.context || null; // PlanningContext instance
    this.result = data.result || null; // PlanningResult instance
    this.metadata = {
      createdBy: data.createdBy || 'system',
      approvedBy: data.approvedBy || '',
      reviewedAt: '',
      approvedAt: '',
      executedAt: ''
    };
    this.status = 'draft'; // draft, validated, approved, in-execution, completed
    this.version = 1;
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Plan name must be a non-empty string');
    }
    if (!['operations', 'manufacturing', 'inventory', 'purchasing', 'projects', 'staffing', 'maintenance', 'sales'].includes(this.domain)) {
      throw new Error('Invalid planning domain');
    }
    return true;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  markApproved(approvedBy = 'system') {
    this.status = 'approved';
    this.metadata.approvedBy = approvedBy;
    this.metadata.approvedAt = new Date().toISOString();
    return this;
  }

  markExecuting() {
    this.status = 'in-execution';
    this.metadata.executedAt = new Date().toISOString();
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
      domain: this.domain,
      status: this.status,
      version: this.version,
      totalGoals: this.goals.length,
      totalConstraints: this.constraints.length,
      resultSummary: this.result ? this.result.getSummary() : null
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      description: this.description,
      goals: this.goals.map(g => g.toJSON ? g.toJSON() : g),
      constraints: this.constraints.map(c => c.toJSON ? c.toJSON() : c),
      context: this.context ? (this.context.toJSON ? this.context.toJSON() : this.context) : null,
      result: this.result ? (this.result.toJSON ? this.result.toJSON() : this.result) : null,
      metadata: this.metadata,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt
    };
  }
}
