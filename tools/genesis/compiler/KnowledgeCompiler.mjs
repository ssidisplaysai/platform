/**
 * KnowledgeCompiler.mjs
 *
 * Genesis Enterprise Knowledge Graph Compiler v1
 * Compiles and validates enterprise knowledge graphs
 *
 * @module tools/genesis/compiler/KnowledgeCompiler.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  IndustryBlueprint,
  DomainBlueprint,
  CapabilityBlueprint,
  ProcessBlueprint,
  ConceptBlueprint,
  TerminologyBlueprint,
  RegulationBlueprint,
  RelationshipEdge,
  KnowledgeGraphIndex,
  KnowledgeGraphResult
} from './KnowledgeGraphBlueprint.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class KnowledgeCompiler {
  constructor() {
    this.result = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Stage 1: Initialize and Load Knowledge Assets
   */
  initializeKnowledgeGraph() {
    const industries = this.loadIndustries();
    const domains = this.loadDomains();
    const capabilities = this.loadCapabilities();
    const processes = this.loadProcesses();
    const concepts = this.loadConcepts();
    const terminology = this.loadTerminology();
    const regulations = this.loadRegulations();

    // Link industries to domains (all domains apply to all industries for flexibility)
    for (const industry of industries) {
      industry.domains = domains.slice(0, 3).map(d => d.id); // Link first 3 domains to each industry
    }

    // Link domains to capabilities
    for (const domain of domains) {
      domain.capabilities = capabilities.slice(0, 2).map(c => c.id); // Link capabilities
    }

    // Link capabilities to processes
    for (const capability of capabilities) {
      capability.processes = processes.slice(0, 1).map(p => p.id); // Link processes
    }

    return {
      industries,
      domains,
      capabilities,
      processes,
      concepts,
      terminology,
      regulations
    };
  }

  /**
   * Load canonical industries
   */
  loadIndustries() {
    const industries = [
      new IndustryBlueprint({
        name: 'Financial Services',
        code: 'FINANCE',
        description: 'Banking, insurance, investment management',
        type: 'vertical',
        keyProcesses: ['Lending', 'Payment Processing', 'Investment Management', 'Compliance Reporting'],
        commonEntities: ['Customer', 'Account', 'Transaction', 'Loan', 'Investment'],
        characteristics: ['Highly Regulated', 'Risk Management Critical', 'Data Security Essential']
      }),
      new IndustryBlueprint({
        name: 'Healthcare',
        code: 'HEALTHCARE',
        description: 'Medical services, pharmaceuticals, health insurance',
        type: 'vertical',
        keyProcesses: ['Patient Care', 'Prescription Management', 'Claims Processing', 'Research'],
        commonEntities: ['Patient', 'Provider', 'Medication', 'Procedure', 'Claim'],
        characteristics: ['HIPAA Compliance', 'Life Safety Critical', 'Complex Workflows']
      }),
      new IndustryBlueprint({
        name: 'Retail',
        code: 'RETAIL',
        description: 'Consumer products, e-commerce, brick-and-mortar',
        type: 'vertical',
        keyProcesses: ['Order Management', 'Inventory Control', 'Customer Service', 'Fulfillment'],
        commonEntities: ['Product', 'Order', 'Customer', 'Inventory', 'Store'],
        characteristics: ['High Volume', 'Customer Centric', 'Omnichannel']
      }),
      new IndustryBlueprint({
        name: 'Manufacturing',
        code: 'MANUFACTURING',
        description: 'Production, quality, supply chain',
        type: 'vertical',
        keyProcesses: ['Production Planning', 'Quality Assurance', 'Supply Chain', 'Logistics'],
        commonEntities: ['Product', 'Order', 'Material', 'Equipment', 'Facility'],
        characteristics: ['Process Heavy', 'Asset Intensive', 'Efficiency Focused']
      }),
      new IndustryBlueprint({
        name: 'Energy & Utilities',
        code: 'ENERGY',
        description: 'Power generation, distribution, renewable energy',
        type: 'vertical',
        keyProcesses: ['Generation', 'Distribution', 'Billing', 'Maintenance'],
        commonEntities: ['Customer', 'Meter', 'Grid', 'Generation Asset', 'Outage'],
        characteristics: ['Mission Critical', 'Highly Regulated', 'Infrastructure Heavy']
      })
    ];

    for (const industry of industries) {
      industry.markDefined();
    }

    return industries;
  }

  /**
   * Load canonical domains
   */
  loadDomains() {
    const domains = [
      new DomainBlueprint({
        name: 'Operations',
        code: 'OPS',
        description: 'Core operational execution and process management',
        type: 'functional',
        entities: ['Task', 'Process', 'Workflow', 'Schedule'],
        responsibilities: ['Process Execution', 'Quality Control', 'Resource Management'],
        stakeholders: ['Operations Manager', 'Process Owner', 'Team Lead']
      }),
      new DomainBlueprint({
        name: 'Finance',
        code: 'FIN',
        description: 'Financial management, accounting, budgeting',
        type: 'functional',
        entities: ['Account', 'Transaction', 'Budget', 'Invoice'],
        responsibilities: ['Financial Reporting', 'Risk Management', 'Cost Control'],
        stakeholders: ['CFO', 'Accountant', 'Financial Analyst']
      }),
      new DomainBlueprint({
        name: 'Sales',
        code: 'SALES',
        description: 'Customer acquisition, deal management, revenue',
        type: 'functional',
        entities: ['Customer', 'Opportunity', 'Deal', 'Contract'],
        responsibilities: ['Lead Generation', 'Sales Execution', 'Contract Management'],
        stakeholders: ['Sales Manager', 'Account Executive', 'Sales Rep']
      }),
      new DomainBlueprint({
        name: 'Marketing',
        code: 'MKTG',
        description: 'Customer engagement, brand management, campaigns',
        type: 'functional',
        entities: ['Campaign', 'Lead', 'Asset', 'Segment'],
        responsibilities: ['Campaign Execution', 'Brand Management', 'Demand Generation'],
        stakeholders: ['Marketing Manager', 'Campaign Manager', 'Analyst']
      }),
      new DomainBlueprint({
        name: 'Human Resources',
        code: 'HR',
        description: 'Employee management, recruitment, payroll',
        type: 'functional',
        entities: ['Employee', 'Position', 'Payroll', 'Benefit'],
        responsibilities: ['Recruitment', 'Payroll', 'Employee Development'],
        stakeholders: ['HR Manager', 'Recruiter', 'Payroll Administrator']
      }),
      new DomainBlueprint({
        name: 'IT',
        code: 'IT',
        description: 'Technology, infrastructure, systems',
        type: 'technical',
        entities: ['System', 'Server', 'Application', 'License'],
        responsibilities: ['Infrastructure Management', 'System Administration', 'Security'],
        stakeholders: ['CIO', 'IT Manager', 'System Admin']
      }),
      new DomainBlueprint({
        name: 'Compliance & Risk',
        code: 'COMPLIANCE',
        description: 'Regulatory compliance, risk management, audit',
        type: 'functional',
        entities: ['Regulation', 'Risk', 'Control', 'Audit'],
        responsibilities: ['Compliance Monitoring', 'Risk Assessment', 'Audit Management'],
        stakeholders: ['Compliance Officer', 'Risk Manager', 'Auditor']
      })
    ];

    for (const domain of domains) {
      domain.markDefined();
    }

    return domains;
  }

  /**
   * Load canonical capabilities
   */
  loadCapabilities() {
    const capabilities = [
      new CapabilityBlueprint({
        name: 'Data Management',
        code: 'DATA-MGT',
        description: 'Store, manage, and retrieve business data',
        type: 'operational',
        level: 'core',
        outputs: ['Data Access', 'Data Integrity', 'Data Security'],
        currentMaturity: 'semi-automated',
        targetMaturity: 'intelligent'
      }),
      new CapabilityBlueprint({
        name: 'Workflow Automation',
        code: 'WF-AUTO',
        description: 'Automate business processes and workflows',
        type: 'operational',
        level: 'core',
        outputs: ['Process Efficiency', 'Error Reduction', 'Audit Trail'],
        currentMaturity: 'semi-automated',
        targetMaturity: 'intelligent'
      }),
      new CapabilityBlueprint({
        name: 'Reporting & Analytics',
        code: 'REPORTING',
        description: 'Generate reports and analyze business data',
        type: 'strategic',
        level: 'core',
        outputs: ['Business Insights', 'Decision Support', 'Performance Metrics'],
        currentMaturity: 'manual',
        targetMaturity: 'intelligent'
      }),
      new CapabilityBlueprint({
        name: 'Customer Management',
        code: 'CUST-MGT',
        description: 'Manage customer relationships and interactions',
        type: 'operational',
        level: 'core',
        outputs: ['Customer Satisfaction', 'Loyalty', 'Revenue'],
        currentMaturity: 'semi-automated',
        targetMaturity: 'intelligent'
      }),
      new CapabilityBlueprint({
        name: 'Compliance Management',
        code: 'COMPLIANCE',
        description: 'Ensure regulatory compliance and manage risk',
        type: 'strategic',
        level: 'core',
        outputs: ['Compliance Assurance', 'Risk Mitigation', 'Audit Reports'],
        currentMaturity: 'manual',
        targetMaturity: 'automated'
      }),
      new CapabilityBlueprint({
        name: 'Financial Management',
        code: 'FIN-MGT',
        description: 'Manage finances, budgets, and accounting',
        type: 'operational',
        level: 'core',
        outputs: ['Financial Accuracy', 'Budget Control', 'Cost Visibility'],
        currentMaturity: 'semi-automated',
        targetMaturity: 'intelligent'
      })
    ];

    for (const capability of capabilities) {
      capability.markDefined();
    }

    return capabilities;
  }

  /**
   * Load canonical processes
   */
  loadProcesses() {
    const processes = [
      new ProcessBlueprint({
        name: 'Order Processing',
        code: 'PROC-ORDER',
        description: 'End-to-end order management from creation to fulfillment',
        type: 'operational',
        inputs: ['Customer Request'],
        outputs: ['Fulfilled Order'],
        steps: ['Create Order', 'Validate', 'Process Payment', 'Pick', 'Pack', 'Ship'],
        actors: ['Sales Rep', 'Operations', 'Warehouse'],
        criticality: 'high',
        frequency: 'continuous'
      }),
      new ProcessBlueprint({
        name: 'Customer Onboarding',
        code: 'PROC-ONBOARD',
        description: 'New customer setup and account initialization',
        type: 'operational',
        inputs: ['Customer Application'],
        outputs: ['Active Account'],
        steps: ['Verify', 'Setup Account', 'Configure Access', 'Train'],
        actors: ['Onboarding Specialist', 'IT', 'Trainer'],
        criticality: 'medium',
        frequency: 'ongoing'
      }),
      new ProcessBlueprint({
        name: 'Financial Reporting',
        code: 'PROC-REPORT',
        description: 'Generate periodic financial statements and reports',
        type: 'support',
        inputs: ['Transaction Data'],
        outputs: ['Financial Reports'],
        steps: ['Consolidate', 'Verify', 'Analyze', 'Generate'],
        actors: ['Accountant', 'Analyst'],
        criticality: 'high',
        frequency: 'periodic'
      })
    ];

    for (const process of processes) {
      process.markDefined();
    }

    return processes;
  }

  /**
   * Load canonical concepts
   */
  loadConcepts() {
    const concepts = [
      new ConceptBlueprint({
        name: 'Entity',
        description: 'Core business entity (Customer, Order, Product, etc.)',
        conceptType: 'entity',
        properties: ['id', 'name', 'description', 'status', 'createdAt'],
        useCases: ['Data storage', 'Business representation']
      }),
      new ConceptBlueprint({
        name: 'Workflow',
        description: 'Sequence of steps to accomplish a business outcome',
        conceptType: 'workflow',
        properties: ['steps', 'actors', 'inputs', 'outputs'],
        useCases: ['Process automation', 'Orchestration']
      }),
      new ConceptBlueprint({
        name: 'Automation Rule',
        description: 'Rule-based automation of business logic',
        conceptType: 'automation',
        properties: ['condition', 'action', 'trigger'],
        useCases: ['Business rule execution', 'Process automation']
      })
    ];

    for (const concept of concepts) {
      concept.markDefined();
    }

    return concepts;
  }

  /**
   * Load canonical terminology
   */
  loadTerminology() {
    const terminology = [
      new TerminologyBlueprint({
        term: 'Customer',
        definition: 'An individual or organization that purchases products or services',
        context: 'Any business domain',
        synonyms: ['Client', 'Account', 'Stakeholder']
      }),
      new TerminologyBlueprint({
        term: 'Order',
        definition: 'A request from a customer to purchase products or services',
        context: 'Sales and Operations',
        synonyms: ['Purchase Request', 'Transaction', 'Deal']
      }),
      new TerminologyBlueprint({
        term: 'Workflow',
        definition: 'A sequence of connected steps to complete a business process',
        context: 'Process Management',
        synonyms: ['Process', 'Procedure', 'Flow']
      }),
      new TerminologyBlueprint({
        term: 'Capability',
        definition: 'The ability of an organization to perform a business function',
        context: 'Business Architecture',
        synonyms: ['Function', 'Competency', 'Service']
      })
    ];

    for (const term of terminology) {
      term.markDefined();
    }

    return terminology;
  }

  /**
   * Load canonical regulations
   */
  loadRegulations() {
    const regulations = [
      new RegulationBlueprint({
        name: 'GDPR',
        code: 'GDPR-2018',
        description: 'General Data Protection Regulation - EU data protection law',
        jurisdiction: 'European Union',
        type: 'privacy',
        requirements: ['Data Subject Rights', 'Consent Management', 'Data Minimization', 'Right to Erasure'],
        severity: 'critical',
        applicableTo: ['Customer Data', 'Employee Data', 'Third Party Data']
      }),
      new RegulationBlueprint({
        name: 'HIPAA',
        code: 'HIPAA-1996',
        description: 'Health Insurance Portability and Accountability Act',
        jurisdiction: 'United States',
        industry: 'HEALTHCARE',
        type: 'privacy',
        requirements: ['Data Encryption', 'Access Controls', 'Audit Logs', 'Breach Notification'],
        severity: 'critical',
        applicableTo: ['Patient Records', 'Medical Data']
      }),
      new RegulationBlueprint({
        name: 'PCI DSS',
        code: 'PCI-DSS-3.2.1',
        description: 'Payment Card Industry Data Security Standard',
        jurisdiction: 'Global',
        industry: 'FINANCE',
        type: 'security',
        requirements: ['Encryption', 'Access Control', 'Regular Testing', 'Compliance Monitoring'],
        severity: 'critical',
        applicableTo: ['Payment Data', 'Card Numbers', 'Transaction Records']
      })
    ];

    for (const regulation of regulations) {
      regulation.markDefined();
    }

    return regulations;
  }

  /**
   * Stage 2: Validate Knowledge Assets
   */
  validateAssets(assets) {
    const errors = [];
    const warnings = [];

    for (const category of Object.keys(assets)) {
      const items = assets[category];
      for (const item of items) {
        try {
          if (item.validate) {
            item.validate();
          }
        } catch (error) {
          errors.push(`${category}: ${item.name || item.term} - ${error.message}`);
        }

        // Check for missing key fields
        if (!item.id) {
          warnings.push(`${category}: Missing ID for ${item.name || item.term}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Stage 3: Build Relationship Graph
   */
  buildRelationshipGraph(assets) {
    const relationships = [];

    // Industry → Domain relationships
    for (const industry of assets.industries) {
      for (const domainId of industry.domains || []) {
        const domain = assets.domains.find(d => d.id === domainId);
        if (domain) {
          relationships.push(new RelationshipEdge({
            fromId: industry.id,
            toId: domain.id,
            fromType: 'Industry',
            toType: 'Domain',
            relationshipType: 'has-domain'
          }));
        }
      }
    }

    // Domain → Capability relationships
    for (const domain of assets.domains) {
      for (const capId of domain.capabilities || []) {
        const capability = assets.capabilities.find(c => c.id === capId);
        if (capability) {
          relationships.push(new RelationshipEdge({
            fromId: domain.id,
            toId: capability.id,
            fromType: 'Domain',
            toType: 'Capability',
            relationshipType: 'has-capability'
          }));
        }
      }
    }

    // Capability → Process relationships
    for (const capability of assets.capabilities) {
      for (const procId of capability.processes || []) {
        const process = assets.processes.find(p => p.id === procId);
        if (process) {
          relationships.push(new RelationshipEdge({
            fromId: capability.id,
            toId: process.id,
            fromType: 'Capability',
            toType: 'Process',
            relationshipType: 'enables-process'
          }));
        }
      }
    }

    // Regulation → Domain relationships
    for (const regulation of assets.regulations) {
      if (regulation.domain) {
        const domain = assets.domains.find(d => d.id === regulation.domain);
        if (domain) {
          relationships.push(new RelationshipEdge({
            fromId: regulation.id,
            toId: domain.id,
            fromType: 'Regulation',
            toType: 'Domain',
            relationshipType: 'applies-to'
          }));
        }
      }
    }

    return relationships;
  }

  /**
   * Stage 4: Resolve References
   */
  resolveReferences(assets, relationships) {
    const allIds = new Set();
    
    for (const category of Object.keys(assets)) {
      for (const item of assets[category]) {
        allIds.add(item.id);
      }
    }

    const unresolvedRefs = [];
    for (const rel of relationships) {
      if (!allIds.has(rel.fromId)) {
        unresolvedRefs.push(`Unresolved source: ${rel.fromId}`);
      }
      if (!allIds.has(rel.toId)) {
        unresolvedRefs.push(`Unresolved target: ${rel.toId}`);
      }
    }

    return unresolvedRefs;
  }

  /**
   * Stage 5: Build Knowledge Index
   */
  buildIndex(assets) {
    const index = new KnowledgeGraphIndex();

    for (const category of Object.keys(assets)) {
      for (const item of assets[category]) {
        index.add(item);
      }
    }

    return index;
  }

  /**
   * Stage 6: Generate Canonical Schemas
   */
  generateCanonicalSchemas(assets) {
    const schemas = {
      industrySchema: this.generateIndustrySchema(assets.industries),
      domainSchema: this.generateDomainSchema(assets.domains),
      capabilitySchema: this.generateCapabilitySchema(assets.capabilities),
      processSchema: this.generateProcessSchema(assets.processes),
      conceptSchema: this.generateConceptSchema(assets.concepts)
    };

    return schemas;
  }

  generateIndustrySchema(industries) {
    return {
      type: 'Industry',
      fields: ['id', 'name', 'code', 'type', 'domains', 'keyProcesses'],
      examples: industries.slice(0, 2).map(i => ({ name: i.name, code: i.code }))
    };
  }

  generateDomainSchema(domains) {
    return {
      type: 'Domain',
      fields: ['id', 'name', 'code', 'type', 'capabilities', 'processes'],
      examples: domains.slice(0, 2).map(d => ({ name: d.name, code: d.code }))
    };
  }

  generateCapabilitySchema(capabilities) {
    return {
      type: 'Capability',
      fields: ['id', 'name', 'type', 'level', 'currentMaturity', 'targetMaturity'],
      examples: capabilities.slice(0, 2).map(c => ({ name: c.name, level: c.level }))
    };
  }

  generateProcessSchema(processes) {
    return {
      type: 'Process',
      fields: ['id', 'name', 'type', 'steps', 'actors', 'criticality'],
      examples: processes.slice(0, 2).map(p => ({ name: p.name, steps: p.steps.length }))
    };
  }

  generateConceptSchema(concepts) {
    return {
      type: 'Concept',
      fields: ['id', 'name', 'conceptType', 'properties', 'useCases'],
      examples: concepts.slice(0, 2).map(c => ({ name: c.name, type: c.conceptType }))
    };
  }

  /**
   * Stage 7: Persist and Return Result
   */
  async compileKnowledgeGraph(options = {}) {
    try {
      this.result = new KnowledgeGraphResult();

      // Stage 1: Initialize and load
      const assets = this.initializeKnowledgeGraph();

      // Stage 2: Validate
      const validation = this.validateAssets(assets);
      if (validation.errors.length > 0) {
        validation.errors.forEach(e => this.result.addValidationError(e));
      }
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w => this.result.addValidationWarning(w));
      }

      // Stage 3: Build relationships
      const relationships = this.buildRelationshipGraph(assets);

      // Stage 4: Resolve references
      const unresolvedRefs = this.resolveReferences(assets, relationships);
      unresolvedRefs.forEach(ref => this.result.addValidationWarning(ref));

      // Stage 5: Build index
      const index = this.buildIndex(assets);

      // Stage 6: Generate schemas
      const schemas = this.generateCanonicalSchemas(assets);

      // Stage 7: Populate result
      this.result.industries = assets.industries;
      this.result.domains = assets.domains;
      this.result.capabilities = assets.capabilities;
      this.result.processes = assets.processes;
      this.result.concepts = assets.concepts;
      this.result.terminology = assets.terminology;
      this.result.regulations = assets.regulations;
      this.result.relationships = relationships;
      this.result.index = index;

      // Update metrics
      this.result.metrics.industriesLoaded = assets.industries.length;
      this.result.metrics.domainsLoaded = assets.domains.length;
      this.result.metrics.capabilitiesLoaded = assets.capabilities.length;
      this.result.metrics.processesLoaded = assets.processes.length;
      this.result.metrics.conceptsLoaded = assets.concepts.length;
      this.result.metrics.terminologyLoaded = assets.terminology.length;
      this.result.metrics.regulationsLoaded = assets.regulations.length;
      this.result.metrics.relationshipsCreated = relationships.length;

      this.result.markSuccess();

      // Persist if requested
      if (options.persist !== false) {
        await this.persistKnowledgeGraph(this.result, schemas);
      }

      return this.result;
    } catch (error) {
      this.result.markFailed();
      this.result.addValidationError(error.message);
      throw error;
    }
  }

  /**
   * Persist knowledge graph
   */
  async persistKnowledgeGraph(result, schemas) {
    const outputDir = path.join(
      __dirname,
      '../../..',
      'out/generated/knowledge-graph',
      `graph-${new Date().toISOString().slice(0, 10)}`
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write industries
    fs.writeFileSync(
      path.join(outputDir, 'industries.json'),
      JSON.stringify(result.industries.map(i => i.toJSON()), null, 2)
    );

    // Write domains
    fs.writeFileSync(
      path.join(outputDir, 'domains.json'),
      JSON.stringify(result.domains.map(d => d.toJSON()), null, 2)
    );

    // Write capabilities
    fs.writeFileSync(
      path.join(outputDir, 'capabilities.json'),
      JSON.stringify(result.capabilities.map(c => c.toJSON()), null, 2)
    );

    // Write processes
    fs.writeFileSync(
      path.join(outputDir, 'processes.json'),
      JSON.stringify(result.processes.map(p => p.toJSON()), null, 2)
    );

    // Write terminology
    fs.writeFileSync(
      path.join(outputDir, 'terminology.json'),
      JSON.stringify(result.terminology.map(t => t.toJSON()), null, 2)
    );

    // Write regulations
    fs.writeFileSync(
      path.join(outputDir, 'regulations.json'),
      JSON.stringify(result.regulations.map(r => r.toJSON()), null, 2)
    );

    // Write relationships
    fs.writeFileSync(
      path.join(outputDir, 'relationships.json'),
      JSON.stringify(result.relationships.map(r => r.toJSON()), null, 2)
    );

    // Write schemas
    fs.writeFileSync(
      path.join(outputDir, 'schemas.json'),
      JSON.stringify(schemas, null, 2)
    );

    // Write graph metadata
    fs.writeFileSync(
      path.join(outputDir, 'graph-metadata.json'),
      JSON.stringify(result.toJSON(), null, 2)
    );

    return outputDir;
  }

  /**
   * Get summary
   */
  getSummary() {
    return {
      graphId: this.result?.id,
      status: this.result?.status,
      industriesLoaded: this.result?.metrics.industriesLoaded || 0,
      domainsLoaded: this.result?.metrics.domainsLoaded || 0,
      capabilitiesLoaded: this.result?.metrics.capabilitiesLoaded || 0,
      processesLoaded: this.result?.metrics.processesLoaded || 0,
      terminologyLoaded: this.result?.metrics.terminologyLoaded || 0,
      regulationsLoaded: this.result?.metrics.regulationsLoaded || 0,
      relationshipsCreated: this.result?.metrics.relationshipsCreated || 0,
      totalAssets: (this.result?.metrics.industriesLoaded || 0) +
                   (this.result?.metrics.domainsLoaded || 0) +
                   (this.result?.metrics.capabilitiesLoaded || 0) +
                   (this.result?.metrics.processesLoaded || 0),
      errors: this.result?.validationErrors.length || 0,
      warnings: this.result?.validationWarnings.length || 0
    };
  }
}
