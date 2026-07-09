/**
 * KnowledgeGraphBlueprint.mjs
 *
 * Genesis Enterprise Knowledge Graph v1
 * Defines canonical contracts for industries, domains, capabilities, processes, concepts, terminology, and regulations
 *
 * @module tools/genesis/compiler/KnowledgeGraphBlueprint.mjs
 */

import crypto from 'crypto';

/**
 * IndustryBlueprint
 * Represents an industry vertical (finance, healthcare, retail, manufacturing, etc.)
 */
export class IndustryBlueprint {
  constructor(data = {}) {
    this.id = data.id || `industry-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Industry';
    this.code = data.code || ''; // e.g., FINANCE, HEALTHCARE, RETAIL
    this.description = data.description || '';
    this.type = data.type || 'vertical'; // vertical, horizontal, functional
    this.domains = data.domains || []; // References to domain IDs
    this.regulations = data.regulations || [];
    this.keyProcesses = data.keyProcesses || [];
    this.commonEntities = data.commonEntities || [];
    this.characteristics = data.characteristics || [];
    this.status = 'draft'; // draft, defined, validated, approved
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Industry name must be a non-empty string');
    }
    const validTypes = ['vertical', 'horizontal', 'functional'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid industry type: ${this.type}`);
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      domains: this.domains.length,
      regulations: this.regulations.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      type: this.type,
      domains: this.domains,
      regulations: this.regulations,
      keyProcesses: this.keyProcesses,
      commonEntities: this.commonEntities,
      characteristics: this.characteristics,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * DomainBlueprint
 * Represents a business domain within industries
 */
export class DomainBlueprint {
  constructor(data = {}) {
    this.id = data.id || `domain-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Domain';
    this.code = data.code || '';
    this.description = data.description || '';
    this.type = data.type || 'functional'; // functional, process, organizational, technical
    this.industry = data.industry || ''; // Parent industry ID
    this.capabilities = data.capabilities || []; // Referenced capability IDs
    this.processes = data.processes || [];
    this.entities = data.entities || [];
    this.applications = data.applications || [];
    this.responsibilities = data.responsibilities || [];
    this.stakeholders = data.stakeholders || [];
    this.status = 'draft';
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

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities.length,
      processes: this.processes.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      type: this.type,
      industry: this.industry,
      capabilities: this.capabilities,
      processes: this.processes,
      entities: this.entities,
      applications: this.applications,
      responsibilities: this.responsibilities,
      stakeholders: this.stakeholders,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * CapabilityBlueprint
 * Represents a business capability
 */
export class CapabilityBlueprint {
  constructor(data = {}) {
    this.id = data.id || `capability-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Capability';
    this.code = data.code || '';
    this.description = data.description || '';
    this.domain = data.domain || '';
    this.type = data.type || 'operational'; // operational, strategic, supporting
    this.level = data.level || 'core'; // core, supporting, advanced
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.processes = data.processes || [];
    this.entities = data.entities || [];
    this.applications = data.applications || [];
    this.agents = data.agents || [];
    this.maturityLevels = data.maturityLevels || ['manual', 'semi-automated', 'automated', 'intelligent'];
    this.currentMaturity = data.currentMaturity || 'manual';
    this.targetMaturity = data.targetMaturity || 'intelligent';
    this.metrics = data.metrics || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Capability name must be a non-empty string');
    }
    const validTypes = ['operational', 'strategic', 'supporting'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid capability type: ${this.type}`);
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      level: this.level,
      maturity: this.currentMaturity,
      processes: this.processes.length,
      entities: this.entities.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      domain: this.domain,
      type: this.type,
      level: this.level,
      inputs: this.inputs,
      outputs: this.outputs,
      processes: this.processes,
      entities: this.entities,
      applications: this.applications,
      agents: this.agents,
      maturityLevels: this.maturityLevels,
      currentMaturity: this.currentMaturity,
      targetMaturity: this.targetMaturity,
      metrics: this.metrics,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * ProcessBlueprint
 * Represents a business process
 */
export class ProcessBlueprint {
  constructor(data = {}) {
    this.id = data.id || `process-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Process';
    this.code = data.code || '';
    this.description = data.description || '';
    this.capability = data.capability || '';
    this.domain = data.domain || '';
    this.type = data.type || 'operational'; // operational, support, management
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.steps = data.steps || [];
    this.actors = data.actors || [];
    this.systems = data.systems || [];
    this.objects = data.objects || [];
    this.automationLevel = data.automationLevel || 'manual';
    this.criticality = data.criticality || 'medium'; // low, medium, high, critical
    this.frequency = data.frequency || 'ongoing';
    this.kpis = data.kpis || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Process name must be a non-empty string');
    }
    const validTypes = ['operational', 'support', 'management'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid process type: ${this.type}`);
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      criticality: this.criticality,
      steps: this.steps.length,
      actors: this.actors.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      capability: this.capability,
      domain: this.domain,
      type: this.type,
      inputs: this.inputs,
      outputs: this.outputs,
      steps: this.steps,
      actors: this.actors,
      systems: this.systems,
      objects: this.objects,
      automationLevel: this.automationLevel,
      criticality: this.criticality,
      frequency: this.frequency,
      kpis: this.kpis,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * ConceptBlueprint
 * Represents abstract concepts (entities, workflows, patterns, etc.)
 */
export class ConceptBlueprint {
  constructor(data = {}) {
    this.id = data.id || `concept-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Concept';
    this.description = data.description || '';
    this.conceptType = data.conceptType || 'entity'; // entity, workflow, pattern, rule, automation, integration
    this.domain = data.domain || '';
    this.properties = data.properties || [];
    this.relationships = data.relationships || [];
    this.patterns = data.patterns || [];
    this.useCases = data.useCases || [];
    this.implementations = data.implementations || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Concept name must be a non-empty string');
    }
    const validTypes = ['entity', 'workflow', 'pattern', 'rule', 'automation', 'integration'];
    if (!validTypes.includes(this.conceptType)) {
      throw new Error(`Invalid concept type: ${this.conceptType}`);
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.conceptType,
      properties: this.properties.length,
      useCases: this.useCases.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      conceptType: this.conceptType,
      domain: this.domain,
      properties: this.properties,
      relationships: this.relationships,
      patterns: this.patterns,
      useCases: this.useCases,
      implementations: this.implementations,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * TerminologyBlueprint
 * Represents business terminology and glossary entries
 */
export class TerminologyBlueprint {
  constructor(data = {}) {
    this.id = data.id || `terminology-${crypto.randomBytes(4).toString('hex')}`;
    this.term = data.term || 'Unnamed Term';
    this.definition = data.definition || '';
    this.domain = data.domain || '';
    this.industry = data.industry || '';
    this.synonyms = data.synonyms || [];
    this.relatedTerms = data.relatedTerms || [];
    this.context = data.context || '';
    this.usage = data.usage || [];
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.term || typeof this.term !== 'string') {
      throw new Error('Term must be a non-empty string');
    }
    if (!this.definition || typeof this.definition !== 'string') {
      throw new Error('Definition must be provided');
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      term: this.term,
      domain: this.domain,
      industry: this.industry,
      synonyms: this.synonyms.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      term: this.term,
      definition: this.definition,
      domain: this.domain,
      industry: this.industry,
      synonyms: this.synonyms,
      relatedTerms: this.relatedTerms,
      context: this.context,
      usage: this.usage,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * RegulationBlueprint
 * Represents regulations and compliance requirements
 */
export class RegulationBlueprint {
  constructor(data = {}) {
    this.id = data.id || `regulation-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Regulation';
    this.code = data.code || '';
    this.description = data.description || '';
    this.jurisdiction = data.jurisdiction || '';
    this.industry = data.industry || '';
    this.domain = data.domain || '';
    this.type = data.type || 'compliance'; // compliance, privacy, security, reporting, operational
    this.requirements = data.requirements || [];
    this.penalties = data.penalties || [];
    this.applicableTo = data.applicableTo || [];
    this.effectiveDate = data.effectiveDate || '';
    this.severity = data.severity || 'medium'; // low, medium, high, critical
    this.status = 'draft';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Regulation name must be a non-empty string');
    }
    const validTypes = ['compliance', 'privacy', 'security', 'reporting', 'operational'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid regulation type: ${this.type}`);
    }
    return true;
  }

  markDefined() { this.status = 'defined'; return this; }
  markValidated() { this.status = 'validated'; return this; }
  markApproved() { this.status = 'approved'; return this; }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      jurisdiction: this.jurisdiction,
      industry: this.industry,
      severity: this.severity
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      jurisdiction: this.jurisdiction,
      industry: this.industry,
      domain: this.domain,
      type: this.type,
      requirements: this.requirements,
      penalties: this.penalties,
      applicableTo: this.applicableTo,
      effectiveDate: this.effectiveDate,
      severity: this.severity,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * RelationshipEdge
 * Represents a relationship between knowledge graph nodes
 */
export class RelationshipEdge {
  constructor(data = {}) {
    this.id = data.id || `edge-${crypto.randomBytes(4).toString('hex')}`;
    this.fromId = data.fromId || '';
    this.toId = data.toId || '';
    this.fromType = data.fromType || '';
    this.toType = data.toType || '';
    this.relationshipType = data.relationshipType || '';
    this.properties = data.properties || {};
    this.metadata = data.metadata || {};
    this.status = 'defined';
    this.createdAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      fromId: this.fromId,
      toId: this.toId,
      fromType: this.fromType,
      toType: this.toType,
      relationshipType: this.relationshipType,
      properties: this.properties,
      metadata: this.metadata,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * KnowledgeGraphIndex
 * Enables fast lookups in the knowledge graph
 */
export class KnowledgeGraphIndex {
  constructor() {
    this.byId = new Map();
    this.byName = new Map();
    this.byType = new Map();
    this.byDomain = new Map();
    this.byIndustry = new Map();
  }

  add(asset) {
    this.byId.set(asset.id, asset);
    
    if (asset.name) {
      if (!this.byName.has(asset.name)) {
        this.byName.set(asset.name, []);
      }
      this.byName.get(asset.name).push(asset);
    }

    const type = asset.type || asset.conceptType || asset.regulationType || asset.constructor.name;
    if (!this.byType.has(type)) {
      this.byType.set(type, []);
    }
    this.byType.get(type).push(asset);

    if (asset.domain) {
      if (!this.byDomain.has(asset.domain)) {
        this.byDomain.set(asset.domain, []);
      }
      this.byDomain.get(asset.domain).push(asset);
    }

    if (asset.industry) {
      if (!this.byIndustry.has(asset.industry)) {
        this.byIndustry.set(asset.industry, []);
      }
      this.byIndustry.get(asset.industry).push(asset);
    }
  }

  findById(id) {
    return this.byId.get(id);
  }

  findByName(name) {
    return this.byName.get(name) || [];
  }

  findByType(type) {
    return this.byType.get(type) || [];
  }

  findByDomain(domainId) {
    return this.byDomain.get(domainId) || [];
  }

  findByIndustry(industryId) {
    return this.byIndustry.get(industryId) || [];
  }

  getStats() {
    return {
      totalAssets: this.byId.size,
      byType: Array.from(this.byType.keys()),
      byDomain: Array.from(this.byDomain.keys()),
      byIndustry: Array.from(this.byIndustry.keys())
    };
  }
}

/**
 * KnowledgeGraphResult
 * Result of knowledge graph compilation
 */
export class KnowledgeGraphResult {
  constructor(data = {}) {
    this.id = data.id || `kgraph-${crypto.randomBytes(4).toString('hex')}`;
    this.industries = data.industries || [];
    this.domains = data.domains || [];
    this.capabilities = data.capabilities || [];
    this.processes = data.processes || [];
    this.concepts = data.concepts || [];
    this.terminology = data.terminology || [];
    this.regulations = data.regulations || [];
    this.relationships = data.relationships || [];
    this.index = data.index || new KnowledgeGraphIndex();
    this.validationErrors = [];
    this.validationWarnings = [];
    this.status = 'draft'; // draft, success, partial, failed
    this.metrics = {
      industriesLoaded: 0,
      domainsLoaded: 0,
      capabilitiesLoaded: 0,
      processesLoaded: 0,
      conceptsLoaded: 0,
      terminologyLoaded: 0,
      regulationsLoaded: 0,
      relationshipsCreated: 0,
      validationErrors: 0,
      validationWarnings: 0
    };
    this.createdAt = new Date().toISOString();
  }

  addValidationError(message) {
    this.validationErrors.push({ message, timestamp: new Date().toISOString() });
    this.metrics.validationErrors++;
    return this;
  }

  addValidationWarning(message) {
    this.validationWarnings.push({ message, timestamp: new Date().toISOString() });
    this.metrics.validationWarnings++;
    return this;
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

  toJSON() {
    return {
      id: this.id,
      industriesCount: this.industries.length,
      domainsCount: this.domains.length,
      capabilitiesCount: this.capabilities.length,
      processesCount: this.processes.length,
      conceptsCount: this.concepts.length,
      terminologyCount: this.terminology.length,
      regulationsCount: this.regulations.length,
      relationshipsCount: this.relationships.length,
      status: this.status,
      metrics: this.metrics,
      validationErrors: this.validationErrors,
      validationWarnings: this.validationWarnings,
      createdAt: this.createdAt
    };
  }
}
