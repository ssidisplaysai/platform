/**
 * GenesisPlatformBlueprint.mjs
 *
 * Genesis Meta Compiler - Platform Blueprint Contracts
 * Defines the metadata schema for Genesis architecture
 * Enables Genesis to describe, compile, and validate its own structure
 *
 * @module tools/genesis/compiler/GenesisPlatformBlueprint.mjs
 */

import { randomBytes } from 'crypto';

/**
 * ComponentDefinition - Describes a Genesis platform component
 * Components are the building blocks of Genesis architecture
 */
export class ComponentDefinition {
  constructor(data) {
    if (!data.name) throw new Error('ComponentDefinition requires name');
    if (!data.type) throw new Error('ComponentDefinition requires type');

    this.id = `comp-${randomBytes(6).toString('hex')}`;
    this.name = data.name; // e.g., "RuntimeEngine", "BusinessCompiler", "DigitalTwin"
    this.type = data.type; // "runtime" | "compiler" | "engine" | "graph" | "twin" | "cli" | "orchestrator" | "kernel"
    this.description = data.description || '';
    this.version = data.version || '1.0.0';
    this.status = data.status || 'stable'; // draft | beta | stable | deprecated
    this.responsibilities = data.responsibilities || []; // Array of responsibility descriptions
    this.capabilities = data.capabilities || []; // e.g., ["compilation", "validation", "execution"]
    this.dependencies = data.dependencies || []; // Component names this depends on
    this.inputTypes = data.inputTypes || []; // Data types consumed
    this.outputTypes = data.outputTypes || []; // Data types produced
    this.configuration = data.configuration || {}; // Configuration schema
    this.metadata = data.metadata || {}; // Additional metadata
    this.status_lifecycle = 'draft';
    this.createdAt = new Date().toISOString();
  }

  markDefined() {
    this.status_lifecycle = 'defined';
    return this;
  }

  markValidated() {
    this.status_lifecycle = 'validated';
    return this;
  }

  markApproved() {
    this.status_lifecycle = 'approved';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      version: this.version,
      status: this.status,
      responsibilities: this.responsibilities,
      capabilities: this.capabilities,
      dependencies: this.dependencies,
      inputTypes: this.inputTypes,
      outputTypes: this.outputTypes,
      configuration: this.configuration,
      metadata: this.metadata,
      status_lifecycle: this.status_lifecycle,
      createdAt: this.createdAt
    };
  }
}

/**
 * RelationshipDefinition - Describes how components interact
 */
export class RelationshipDefinition {
  constructor(data) {
    if (!data.source) throw new Error('RelationshipDefinition requires source');
    if (!data.target) throw new Error('RelationshipDefinition requires target');
    if (!data.type) throw new Error('RelationshipDefinition requires type');

    this.id = `rel-${randomBytes(6).toString('hex')}`;
    this.source = data.source; // Component name
    this.target = data.target; // Component name
    this.type = data.type; // "input" | "output" | "dependency" | "integration" | "orchestration" | "feedback"
    this.description = data.description || '';
    this.required = data.required !== false; // Is this relationship required?
    this.dataFlow = data.dataFlow || []; // Description of data flowing through this relationship
    this.synchronicity = data.synchronicity || 'async'; // "sync" | "async"
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
      source: this.source,
      target: this.target,
      type: this.type,
      description: this.description,
      required: this.required,
      dataFlow: this.dataFlow,
      synchronicity: this.synchronicity,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * ValidationRule - Defines constraints on components and relationships
 */
export class ValidationRule {
  constructor(data) {
    if (!data.name) throw new Error('ValidationRule requires name');
    if (!data.rule) throw new Error('ValidationRule requires rule');

    this.id = `rule-${randomBytes(6).toString('hex')}`;
    this.name = data.name;
    this.rule = data.rule; // Description of the rule
    this.target = data.target; // "component" | "relationship" | "architecture"
    this.severity = data.severity || 'warning'; // "warning" | "critical"
    this.message = data.message || '';
    this.validator = data.validator || null; // Function that validates
    this.autoFixable = data.autoFixable || false;
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
      name: this.name,
      rule: this.rule,
      target: this.target,
      severity: this.severity,
      message: this.message,
      autoFixable: this.autoFixable,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * PlatformBlueprint - Complete description of Genesis architecture
 * This is the master contract that defines all aspects of Genesis
 */
export class PlatformBlueprint {
  constructor(data) {
    if (!data.name) throw new Error('PlatformBlueprint requires name');
    if (!data.version) throw new Error('PlatformBlueprint requires version');

    this.id = `pb-${randomBytes(6).toString('hex')}`;
    this.name = data.name; // e.g., "Genesis Platform"
    this.version = data.version; // e.g., "1.0.0"
    this.description = data.description || '';
    this.components = data.components || []; // Array of ComponentDefinition
    this.relationships = data.relationships || []; // Array of RelationshipDefinition
    this.validationRules = data.validationRules || []; // Array of ValidationRule
    this.architecture = data.architecture || {}; // Overall architecture description
    this.status = 'draft'; // draft | defined | validated | approved
    this.approvalChain = data.approvalChain || [];
    this.createdAt = new Date().toISOString();
    this.lastUpdated = new Date().toISOString();
  }

  addComponent(component) {
    if (!component) throw new Error('Cannot add null component');
    this.components.push(component);
    this.lastUpdated = new Date().toISOString();
    return this;
  }

  addRelationship(relationship) {
    if (!relationship) throw new Error('Cannot add null relationship');
    this.relationships.push(relationship);
    this.lastUpdated = new Date().toISOString();
    return this;
  }

  addValidationRule(rule) {
    if (!rule) throw new Error('Cannot add null rule');
    this.validationRules.push(rule);
    this.lastUpdated = new Date().toISOString();
    return this;
  }

  markDefined() {
    this.status = 'defined';
    this.lastUpdated = new Date().toISOString();
    return this;
  }

  markValidated() {
    this.status = 'validated';
    this.lastUpdated = new Date().toISOString();
    return this;
  }

  markApproved() {
    this.status = 'approved';
    this.lastUpdated = new Date().toISOString();
    if (!this.approvalChain.includes(new Date().toISOString())) {
      this.approvalChain.push(new Date().toISOString());
    }
    return this;
  }

  getComponent(name) {
    return this.components.find(c => c.name === name);
  }

  getComponentsByType(type) {
    return this.components.filter(c => c.type === type);
  }

  getRelationshipsFor(componentName) {
    return this.relationships.filter(r => r.source === componentName || r.target === componentName);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      components: this.components.map(c => c.toJSON?.() || c),
      relationships: this.relationships.map(r => r.toJSON?.() || r),
      validationRules: this.validationRules.map(rule => rule.toJSON?.() || rule),
      architecture: this.architecture,
      status: this.status,
      approvalChain: this.approvalChain,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated
    };
  }
}

/**
 * ValidationResult - Result of validating Genesis architecture
 */
export class ValidationResult {
  constructor(data) {
    this.id = `vres-${randomBytes(6).toString('hex')}`;
    this.blueprintId = data.blueprintId || '';
    this.status = 'pending'; // "valid" | "invalid" | "warnings" | "pending"
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.validatedComponents = data.validatedComponents || [];
    this.validatedRelationships = data.validatedRelationships || [];
    this.timestamp = new Date().toISOString();
    this.duration = data.duration || 0; // ms
    this.details = data.details || {};
  }

  addError(error) {
    this.errors.push(error);
    if (this.status === 'pending' || this.status === 'valid' || this.status === 'warnings') {
      this.status = 'invalid';
    }
    return this;
  }

  addWarning(warning) {
    this.warnings.push(warning);
    if (this.status === 'pending' || this.status === 'valid') {
      this.status = 'warnings';
    }
    return this;
  }

  markValid() {
    if (this.errors.length === 0) {
      this.status = 'valid';
    }
    return this;
  }

  isValid() {
    return this.status === 'valid' && this.errors.length === 0;
  }

  toJSON() {
    return {
      id: this.id,
      blueprintId: this.blueprintId,
      status: this.status,
      errors: this.errors,
      warnings: this.warnings,
      validatedComponents: this.validatedComponents,
      validatedRelationships: this.validatedRelationships,
      timestamp: this.timestamp,
      duration: this.duration,
      details: this.details
    };
  }
}

/**
 * ArchitectureInspection - Result of inspecting Genesis architecture
 */
export class ArchitectureInspection {
  constructor(data) {
    this.id = `insp-${randomBytes(6).toString('hex')}`;
    this.blueprintId = data.blueprintId || '';
    this.timestamp = new Date().toISOString();
    this.componentCount = data.componentCount || 0;
    this.relationshipCount = data.relationshipCount || 0;
    this.components = data.components || {}; // Map of component name -> component status
    this.relationships = data.relationships || {}; // Map of relationship id -> status
    this.metrics = data.metrics || {};
    this.health = data.health || 'unknown'; // "healthy" | "degraded" | "critical" | "unknown"
    this.summary = data.summary || '';
    this.recommendations = data.recommendations || [];
  }

  addComponentStatus(name, status) {
    this.components[name] = status;
    return this;
  }

  addRelationshipStatus(id, status) {
    this.relationships[id] = status;
    return this;
  }

  setMetric(name, value) {
    this.metrics[name] = value;
    return this;
  }

  addRecommendation(recommendation) {
    this.recommendations.push(recommendation);
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      blueprintId: this.blueprintId,
      timestamp: this.timestamp,
      componentCount: this.componentCount,
      relationshipCount: this.relationshipCount,
      components: this.components,
      relationships: this.relationships,
      metrics: this.metrics,
      health: this.health,
      summary: this.summary,
      recommendations: this.recommendations
    };
  }
}

/**
 * Create the canonical Genesis Platform Blueprint
 * This describes Genesis v1 architecture
 */
export function createGenesisPlatformBlueprint() {
  const blueprint = new PlatformBlueprint({
    name: 'Genesis Platform',
    version: '1.0.0',
    description: 'Metadata-driven enterprise compilation and evolution platform'
  });

  // Define core components
  const components = [
    // Runtime components
    new ComponentDefinition({
      name: 'RuntimeEngine',
      type: 'runtime',
      description: 'Executes compiled enterprise systems and manages lifecycle',
      capabilities: ['execution', 'lifecycle-management', 'event-dispatching'],
      status: 'stable'
    }),

    // Compiler components
    new ComponentDefinition({
      name: 'BusinessCompiler',
      type: 'compiler',
      description: 'Compiles business definitions into executable runtime',
      capabilities: ['compilation', 'validation', 'optimization'],
      dependencies: ['RuntimeEngine', 'KnowledgeGraph'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'ObjectCompiler',
      type: 'compiler',
      description: 'Compiles object definitions with inheritance and composition',
      capabilities: ['compilation', 'validation'],
      dependencies: ['RuntimeEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'ModuleCompiler',
      type: 'compiler',
      description: 'Compiles modular compositions and dependency graphs',
      capabilities: ['compilation', 'validation', 'packaging'],
      dependencies: ['RuntimeEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'ApplicationCompiler',
      type: 'compiler',
      description: 'Compiles complete applications from module definitions',
      capabilities: ['compilation', 'validation', 'orchestration'],
      dependencies: ['ModuleCompiler', 'RuntimeEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'SolutionCompiler',
      type: 'compiler',
      description: 'Compiles enterprise solutions combining multiple applications',
      capabilities: ['compilation', 'validation', 'integration'],
      dependencies: ['ApplicationCompiler', 'RuntimeEngine'],
      status: 'stable'
    }),

    // Knowledge and data components
    new ComponentDefinition({
      name: 'KnowledgeGraph',
      type: 'graph',
      description: 'Stores and queries enterprise knowledge and relationships',
      capabilities: ['storage', 'querying', 'relationship-management'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'BusinessLanguage',
      type: 'graph',
      description: 'Defines domain-specific language for business concepts',
      capabilities: ['definition', 'validation', 'parsing'],
      dependencies: ['KnowledgeGraph'],
      status: 'stable'
    }),

    // Engine components
    new ComponentDefinition({
      name: 'DigitalTwin',
      type: 'engine',
      description: 'Creates digital representation of enterprise systems',
      capabilities: ['modeling', 'simulation-support', 'analysis'],
      dependencies: ['RuntimeEngine', 'SimulationEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'SimulationEngine',
      type: 'engine',
      description: 'Simulates system behavior under various scenarios',
      capabilities: ['simulation', 'forecasting', 'scenario-analysis'],
      dependencies: ['RuntimeEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'PlanningEngine',
      type: 'engine',
      description: 'Plans enterprise initiatives and change management',
      capabilities: ['planning', 'validation', 'risk-assessment'],
      dependencies: ['DigitalTwin', 'SimulationEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'DecisionEngine',
      type: 'engine',
      description: 'Analyzes decisions and their outcomes',
      capabilities: ['decision-analysis', 'outcome-tracking', 'learning'],
      dependencies: ['RuntimeEngine', 'LearningEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'LearningEngine',
      type: 'engine',
      description: 'Captures and analyzes enterprise execution outcomes',
      capabilities: ['observation-capture', 'pattern-recognition', 'insight-generation'],
      dependencies: ['RuntimeEngine', 'KnowledgeGraph'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'EvolutionEngine',
      type: 'engine',
      description: 'Analyzes and proposes structural improvements',
      capabilities: ['analysis', 'proposal-generation', 'impact-assessment'],
      dependencies: ['LearningEngine', 'DigitalTwin', 'DecisionEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'AIOrchestratorKernel',
      type: 'orchestrator',
      description: 'Orchestrates AI capabilities across Genesis platform',
      capabilities: ['coordination', 'decision-support', 'learning'],
      dependencies: ['RuntimeEngine', 'LearningEngine', 'DecisionEngine'],
      status: 'beta'
    }),

    // CLI and user interface
    new ComponentDefinition({
      name: 'GenesisClI',
      type: 'cli',
      description: 'Command-line interface for Genesis operations',
      capabilities: ['command-parsing', 'output-formatting', 'user-interaction'],
      dependencies: ['RuntimeEngine', 'BusinessCompiler'],
      status: 'stable'
    }),

    // System components
    new ComponentDefinition({
      name: 'PackageSystem',
      type: 'system',
      description: 'Manages packages and dependencies',
      capabilities: ['packaging', 'dependency-resolution', 'distribution'],
      dependencies: ['RuntimeEngine'],
      status: 'stable'
    }),

    new ComponentDefinition({
      name: 'EventBus',
      type: 'system',
      description: 'Manages event distribution and handling',
      capabilities: ['event-routing', 'subscription-management', 'async-dispatch'],
      dependencies: ['RuntimeEngine'],
      status: 'stable'
    })
  ];

  // Add all components
  components.forEach(comp => blueprint.addComponent(comp));

  // Define relationships
  const relationships = [
    // Compiler dependencies
    new RelationshipDefinition({
      source: 'BusinessCompiler',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'BusinessCompiler executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'ObjectCompiler',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'ObjectCompiler executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'ModuleCompiler',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'ModuleCompiler executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'ApplicationCompiler',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'ApplicationCompiler executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'ApplicationCompiler',
      target: 'ModuleCompiler',
      type: 'dependency',
      description: 'ApplicationCompiler compiles module definitions',
      required: true
    }),

    new RelationshipDefinition({
      source: 'SolutionCompiler',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'SolutionCompiler executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'SolutionCompiler',
      target: 'ApplicationCompiler',
      type: 'dependency',
      description: 'SolutionCompiler builds on ApplicationCompiler',
      required: true
    }),

    // Engine integration
    new RelationshipDefinition({
      source: 'SimulationEngine',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'SimulationEngine executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'DigitalTwin',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'DigitalTwin executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'DigitalTwin',
      target: 'SimulationEngine',
      type: 'integration',
      description: 'DigitalTwin uses SimulationEngine for forecasting',
      required: true
    }),

    new RelationshipDefinition({
      source: 'PlanningEngine',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'PlanningEngine executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'PlanningEngine',
      target: 'DigitalTwin',
      type: 'dependency',
      description: 'PlanningEngine analyzes DigitalTwin',
      required: true
    }),

    new RelationshipDefinition({
      source: 'DecisionEngine',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'DecisionEngine executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'DecisionEngine',
      target: 'LearningEngine',
      type: 'integration',
      description: 'DecisionEngine feeds outcomes to LearningEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'LearningEngine',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'LearningEngine executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'EvolutionEngine',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'EvolutionEngine executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'EvolutionEngine',
      target: 'LearningEngine',
      type: 'input',
      description: 'EvolutionEngine consumes Learning insights',
      required: true
    }),

    new RelationshipDefinition({
      source: 'EvolutionEngine',
      target: 'DigitalTwin',
      type: 'input',
      description: 'EvolutionEngine analyzes enterprise structure',
      required: true
    }),

    new RelationshipDefinition({
      source: 'AIOrchestratorKernel',
      target: 'RuntimeEngine',
      type: 'dependency',
      description: 'AI Orchestrator executes on RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'AIOrchestratorKernel',
      target: 'LearningEngine',
      type: 'orchestration',
      description: 'AI Orchestrator manages learning capabilities',
      required: false
    }),

    new RelationshipDefinition({
      source: 'GenesisClI',
      target: 'RuntimeEngine',
      type: 'input',
      description: 'CLI sends commands to RuntimeEngine',
      required: true
    }),

    new RelationshipDefinition({
      source: 'RuntimeEngine',
      target: 'EventBus',
      type: 'integration',
      description: 'RuntimeEngine dispatches events to EventBus',
      required: true
    }),

    new RelationshipDefinition({
      source: 'BusinessCompiler',
      target: 'KnowledgeGraph',
      type: 'dependency',
      description: 'BusinessCompiler queries KnowledgeGraph',
      required: true
    }),

    new RelationshipDefinition({
      source: 'BusinessLanguage',
      target: 'KnowledgeGraph',
      type: 'dependency',
      description: 'BusinessLanguage stores definitions in KnowledgeGraph',
      required: true
    }),
  ];

  // Add all relationships
  relationships.forEach(rel => blueprint.addRelationship(rel));

  // Define validation rules
  const rules = [
    new ValidationRule({
      name: 'CompilersMustHaveRuntimeDependency',
      rule: 'All compiler components must depend on RuntimeEngine',
      target: 'component',
      severity: 'critical',
      message: 'Compiler components must have RuntimeEngine as dependency'
    }),

    new ValidationRule({
      name: 'EnginesMustHaveEventBusIntegration',
      rule: 'All engine components must integrate with EventBus',
      target: 'component',
      severity: 'warning',
      message: 'Engine components should integrate with EventBus'
    }),

    new ValidationRule({
      name: 'NoCircularDependencies',
      rule: 'Component dependency graph must be acyclic',
      target: 'architecture',
      severity: 'critical',
      message: 'Circular dependencies detected in component graph'
    }),

    new ValidationRule({
      name: 'RequiredRelationshipsPresent',
      rule: 'All required relationships must be defined',
      target: 'relationship',
      severity: 'critical',
      message: 'Required relationship is missing or invalid'
    })
  ];

  // Add all rules
  rules.forEach(rule => blueprint.addValidationRule(rule));

  blueprint.markDefined();
  return blueprint;
}

export default {
  ComponentDefinition,
  RelationshipDefinition,
  ValidationRule,
  PlatformBlueprint,
  ValidationResult,
  ArchitectureInspection,
  createGenesisPlatformBlueprint
};
