/**
 * BusinessBlueprint.mjs
 *
 * Defines all contracts for the Genesis Business Compiler v1
 * Transforms business descriptions into canonical Genesis metadata
 *
 * @module tools/genesis/compiler/BusinessBlueprint.mjs
 */

import crypto from 'crypto';

/**
 * BusinessIntent
 * Represents the high-level business intent or requirement
 */
export class BusinessIntent {
  constructor(data = {}) {
    this.id = data.id || `intent-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Intent';
    this.description = data.description || '';
    this.businessValue = data.businessValue || '';
    this.successMetrics = data.successMetrics || [];
    this.timeframe = data.timeframe || ''; // short-term, medium-term, long-term
    this.priority = data.priority || 'medium'; // low, medium, high, critical
    this.stakeholders = data.stakeholders || [];
    this.constraints = data.constraints || [];
    this.assumptions = data.assumptions || [];
    this.status = 'draft'; // draft, analyzed, validated, approved
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Intent name must be a non-empty string');
    }
    const validTimeframes = ['short-term', 'medium-term', 'long-term'];
    if (this.timeframe && !validTimeframes.includes(this.timeframe)) {
      throw new Error(`Invalid timeframe: ${this.timeframe}`);
    }
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(this.priority)) {
      throw new Error(`Invalid priority: ${this.priority}`);
    }
    return true;
  }

  markAnalyzed() { this.status = 'analyzed'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      timeframe: this.timeframe,
      value: this.businessValue
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      businessValue: this.businessValue,
      successMetrics: this.successMetrics,
      timeframe: this.timeframe,
      priority: this.priority,
      stakeholders: this.stakeholders,
      constraints: this.constraints,
      assumptions: this.assumptions,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessDomain
 * Represents a business domain (operations, finance, hr, etc.)
 */
export class BusinessDomain {
  constructor(data = {}) {
    this.id = data.id || `domain-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Domain';
    this.type = data.type || 'functional'; // functional, process, organizational, technical
    this.description = data.description || '';
    this.capabilities = data.capabilities || [];
    this.entities = data.entities || [];
    this.processes = data.processes || [];
    this.stakeholders = data.stakeholders || [];
    this.dependencies = data.dependencies || []; // Other domains this depends on
    this.status = 'identified'; // identified, defined, validated
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Domain name must be a non-empty string');
    }
    const validTypes = ['functional', 'process', 'organizational', 'technical'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid domain type: ${this.type}`);
    }
    return true;
  }

  markDefined() {
    this.status = 'defined';
    return this;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities.length,
      entities: this.entities.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      capabilities: this.capabilities,
      entities: this.entities,
      processes: this.processes,
      stakeholders: this.stakeholders,
      dependencies: this.dependencies,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessCapability
 * Represents a capability the business needs
 */
export class BusinessCapability {
  constructor(data = {}) {
    this.id = data.id || `cap-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Capability';
    this.description = data.description || '';
    this.domain = data.domain || '';
    this.type = data.type || 'operational'; // operational, analytical, supportive, enabling
    this.currentState = data.currentState || 'manual'; // manual, partial, automated, optimized
    this.targetState = data.targetState || 'automated'; // manual, partial, automated, optimized
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.actors = data.actors || [];
    this.systems = data.systems || [];
    this.priority = data.priority || 'medium';
    this.status = 'identified'; // identified, defined, validated
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

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      type: this.type,
      currentState: this.currentState,
      targetState: this.targetState
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      domain: this.domain,
      type: this.type,
      currentState: this.currentState,
      targetState: this.targetState,
      inputs: this.inputs,
      outputs: this.outputs,
      actors: this.actors,
      systems: this.systems,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessRequirement
 * Represents a specific business requirement
 */
export class BusinessRequirement {
  constructor(data = {}) {
    this.id = data.id || `req-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Requirement';
    this.description = data.description || '';
    this.type = data.type || 'functional'; // functional, non-functional, business, technical
    this.priority = data.priority || 'medium';
    this.capability = data.capability || '';
    this.acceptanceCriteria = data.acceptanceCriteria || [];
    this.dependencies = data.dependencies || [];
    this.estimatedEffort = data.estimatedEffort || null;
    this.status = 'identified'; // identified, analyzed, validated, implemented
    this.createdAt = new Date().toISOString();
  }

  markAnalyzed() {
    this.status = 'analyzed';
    return this;
  }

  markValidated() {
    this.status = 'validated';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      priority: this.priority,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      priority: this.priority,
      capability: this.capability,
      acceptanceCriteria: this.acceptanceCriteria,
      dependencies: this.dependencies,
      estimatedEffort: this.estimatedEffort,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessConstraint
 * Represents constraints on the business model
 */
export class BusinessConstraint {
  constructor(data = {}) {
    this.id = data.id || `con-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Constraint';
    this.description = data.description || '';
    this.type = data.type || 'regulatory'; // regulatory, technical, operational, financial, timeline
    this.severity = data.severity || 'medium'; // low, medium, high, critical
    this.affectedDomains = data.affectedDomains || [];
    this.mitigation = data.mitigation || '';
    this.createdAt = new Date().toISOString();
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      severity: this.severity
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      severity: this.severity,
      affectedDomains: this.affectedDomains,
      mitigation: this.mitigation,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessModel
 * Represents the complete business model
 */
export class BusinessModel {
  constructor(data = {}) {
    this.id = data.id || `model-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Business Model';
    this.description = data.description || '';
    this.intent = data.intent || null;
    this.domains = data.domains || [];
    this.capabilities = data.capabilities || [];
    this.requirements = data.requirements || [];
    this.constraints = data.constraints || [];
    this.identifiedObjects = data.identifiedObjects || [];
    this.identifiedModules = data.identifiedModules || [];
    this.identifiedApplications = data.identifiedApplications || [];
    this.identifiedSolutions = data.identifiedSolutions || [];
    this.identifiedWorkflows = data.identifiedWorkflows || [];
    this.identifiedAutomations = data.identifiedAutomations || [];
    this.identifiedAgents = data.identifiedAgents || [];
    this.status = 'draft'; // draft, analyzed, validated, approved
    this.version = data.version || '1.0';
    this.createdAt = new Date().toISOString();
  }

  markAnalyzed() {
    this.status = 'analyzed';
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

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      domains: this.domains.length,
      capabilities: this.capabilities.length,
      objects: this.identifiedObjects.length,
      modules: this.identifiedModules.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      intent: this.intent?.toJSON?.() || this.intent,
      domains: this.domains.map(d => d.toJSON?.() || d),
      capabilities: this.capabilities.map(c => c.toJSON?.() || c),
      requirements: this.requirements.map(r => r.toJSON?.() || r),
      constraints: this.constraints.map(c => c.toJSON?.() || c),
      identifiedObjects: this.identifiedObjects,
      identifiedModules: this.identifiedModules,
      identifiedApplications: this.identifiedApplications,
      identifiedSolutions: this.identifiedSolutions,
      identifiedWorkflows: this.identifiedWorkflows,
      identifiedAutomations: this.identifiedAutomations,
      identifiedAgents: this.identifiedAgents,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt
    };
  }
}

/**
 * GEDLDefinition
 * Genesis Enterprise Definition Language metadata
 */
export class GEDLDefinition {
  constructor(data = {}) {
    this.id = data.id || `gedl-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Definition';
    this.type = data.type || 'object'; // object, module, application, solution, workflow, automation, agent
    this.domain = data.domain || '';
    this.version = data.version || '1.0';
    this.metadata = data.metadata || {};
    this.relationships = data.relationships || [];
    this.dependencies = data.dependencies || [];
    this.properties = data.properties || {};
    this.status = 'draft'; // draft, defined, validated, generated
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

  markGenerated() {
    this.status = 'generated';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      domain: this.domain,
      version: this.version,
      metadata: this.metadata,
      relationships: this.relationships,
      dependencies: this.dependencies,
      properties: this.properties,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * CompilationArtifact
 * Represents generated artifact (code, definition, etc.)
 */
export class CompilationArtifact {
  constructor(data = {}) {
    this.id = data.id || `artifact-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Artifact';
    this.type = data.type || 'definition'; // definition, metadata, schema, code
    this.content = data.content || '';
    this.format = data.format || 'json'; // json, yaml, javascript, typescript
    this.targetCompiler = data.targetCompiler || 'object'; // object, module, application, solution
    this.dependencies = data.dependencies || [];
    this.validationStatus = data.validationStatus || 'pending'; // pending, valid, invalid
    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
  }

  markValid() {
    this.validationStatus = 'valid';
    return this;
  }

  markInvalid() {
    this.validationStatus = 'invalid';
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      content: this.content,
      format: this.format,
      targetCompiler: this.targetCompiler,
      dependencies: this.dependencies,
      validationStatus: this.validationStatus,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

/**
 * BusinessCompilationResult
 * Result of business compilation
 */
export class BusinessCompilationResult {
  constructor(data = {}) {
    this.id = data.id || `result-${crypto.randomBytes(4).toString('hex')}`;
    this.businessModel = data.businessModel || null;
    this.businessIntent = data.businessIntent || null;
    this.identifiedDomains = data.identifiedDomains || [];
    this.identifiedCapabilities = data.identifiedCapabilities || [];
    this.gedlDefinitions = data.gedlDefinitions || [];
    this.artifacts = data.artifacts || [];
    this.validationErrors = data.validationErrors || [];
    this.validationWarnings = data.validationWarnings || [];
    this.status = 'draft'; // draft, success, partial, failed
    this.metrics = {
      domainsIdentified: 0,
      capabilitiesIdentified: 0,
      objectsIdentified: 0,
      modulesIdentified: 0,
      applicationsIdentified: 0,
      solutionsIdentified: 0,
      workflowsIdentified: 0,
      automationsIdentified: 0,
      agentsIdentified: 0,
      gedlDefinitionsGenerated: 0,
      artifactsGenerated: 0
    };
    this.createdAt = new Date().toISOString();
  }

  markSuccess() {
    this.status = 'success';
    return this;
  }

  markPartial() {
    this.status = 'partial';
    return this;
  }

  markFailed() {
    this.status = 'failed';
    return this;
  }

  addValidationError(error) {
    this.validationErrors.push({ message: error, timestamp: new Date().toISOString() });
    return this;
  }

  addValidationWarning(warning) {
    this.validationWarnings.push({ message: warning, timestamp: new Date().toISOString() });
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      status: this.status,
      domainsIdentified: this.metrics.domainsIdentified,
      objectsIdentified: this.metrics.objectsIdentified,
      errors: this.validationErrors.length,
      warnings: this.validationWarnings.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      businessModel: this.businessModel?.toJSON?.() || this.businessModel,
      businessIntent: this.businessIntent?.toJSON?.() || this.businessIntent,
      identifiedDomains: this.identifiedDomains.map(d => d.toJSON?.() || d),
      identifiedCapabilities: this.identifiedCapabilities.map(c => c.toJSON?.() || c),
      gedlDefinitions: this.gedlDefinitions.map(g => g.toJSON?.() || g),
      artifacts: this.artifacts.map(a => a.toJSON?.() || a),
      validationErrors: this.validationErrors,
      validationWarnings: this.validationWarnings,
      status: this.status,
      metrics: this.metrics,
      createdAt: this.createdAt
    };
  }
}
