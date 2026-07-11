/**
 * BusinessCompiler.mjs
 *
 * Genesis Business Compiler v1
 * Transforms business descriptions into canonical Genesis metadata
 *
 * @module tools/genesis/compiler/BusinessCompiler.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  BusinessIntent,
  BusinessDomain,
  BusinessCapability,
  BusinessRequirement,
  BusinessConstraint,
  BusinessModel,
  GEDLDefinition,
  CompilationArtifact,
  BusinessCompilationResult
} from './BusinessBlueprint.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class BusinessCompiler {
  constructor() {
    this.result = null;
    this.businessIntent = null;
    this.businessModel = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Stage 1: Parse Business Intent
   */
  parseBusinessIntent(description) {
    const intent = new BusinessIntent({
      name: this.extractIntentName(description),
      description: description,
      businessValue: this.extractBusinessValue(description),
      successMetrics: this.extractSuccessMetrics(description),
      timeframe: this.extractTimeframe(description),
      priority: this.extractPriority(description)
    });

    this.businessIntent = intent;
    return intent;
  }

  extractIntentName(description) {
    const lines = description.split('\n');
    return lines[0].substring(0, 80) || 'Business Initiative';
  }

  extractBusinessValue(description) {
    const match = description.match(/value|benefit|result|outcome/i);
    return match ? `Improves ${match[0]} for the business` : 'Business improvement';
  }

  extractSuccessMetrics(description) {
    const metrics = [];
    if (description.match(/revenue|increase|growth/i)) metrics.push('Revenue growth');
    if (description.match(/efficiency|reduce|decrease/i)) metrics.push('Operational efficiency');
    if (description.match(/customer|satisfaction|experience/i)) metrics.push('Customer satisfaction');
    if (description.match(/cost|savings|reduce/i)) metrics.push('Cost reduction');
    return metrics.length > 0 ? metrics : ['Business objective achieved'];
  }

  extractTimeframe(description) {
    if (description.match(/immediate|now|urgent|today/i)) return 'short-term';
    if (description.match(/year|long|strategic|future/i)) return 'long-term';
    return 'medium-term';
  }

  extractPriority(description) {
    if (description.match(/critical|urgent|blocking|essential/i)) return 'critical';
    if (description.match(/important|high|priority/i)) return 'high';
    if (description.match(/low|nice-to-have|optional/i)) return 'low';
    return 'medium';
  }

  /**
   * Stage 2: Identify Business Domains
   */
  identifyDomains(description) {
    const domains = [];
    const domainPatterns = {
      'operations': /operation|process|workflow|execution|manufacturing|supply|logistics|inventory/i,
      'finance': /finance|accounting|budget|cost|revenue|payment|billing|invoice/i,
      'sales': /sales|customer|market|deal|pipeline|forecast|territory|commission/i,
      'marketing': /marketing|campaign|brand|promotion|advertising|content|engagement/i,
      'hr': /human|resource|employee|recruitment|payroll|benefits|training|performance/i,
      'it': /technology|system|infrastructure|network|security|data|application|software/i,
      'compliance': /compliance|regulation|legal|audit|governance|policy|risk|standard/i,
      'strategy': /strategy|planning|roadmap|vision|mission|direction|alignment|goal/i
    };

    for (const [domainName, pattern] of Object.entries(domainPatterns)) {
      if (pattern.test(description)) {
        const domain = new BusinessDomain({
          name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
          type: 'functional',
          description: `${domainName} domain for business operations`
        });
        domain.markDefined();
        domains.push(domain);
      }
    }

    if (domains.length === 0) {
      domains.push(new BusinessDomain({
        name: 'General',
        type: 'functional',
        description: 'General business domain'
      }).markDefined());
    }

    return domains;
  }

  /**
   * Stage 3: Identify Business Capabilities
   */
  identifyCapabilities(domains, description) {
    const capabilities = [];
    const capabilityPatterns = {
      'Data Management': /data|database|storage|record|document|file/i,
      'Workflow Automation': /automate|workflow|process|task|step|schedule/i,
      'Reporting & Analytics': /report|analytics|metric|dashboard|insight|analysis/i,
      'Customer Management': /customer|client|account|contact|relationship/i,
      'Financial Management': /budget|cost|revenue|payment|invoice|transaction/i,
      'Resource Planning': /resource|allocation|planning|capacity|schedule/i,
      'Compliance & Governance': /compliance|audit|policy|regulation|control|governance/i,
      'Collaboration': /collaborate|share|communicate|team|group|notification/i
    };

    for (const [capName, pattern] of Object.entries(capabilityPatterns)) {
      if (pattern.test(description)) {
        const capability = new BusinessCapability({
          name: capName,
          domain: domains.length > 0 ? domains[0].name : 'General',
          type: 'operational',
          currentState: 'manual',
          targetState: 'automated',
          description: `Enable ${capName.toLowerCase()} capability`
        });
        capability.markDefined();
        capabilities.push(capability);
      }
    }

    // Ensure at least one capability
    if (capabilities.length === 0) {
      capabilities.push(new BusinessCapability({
        name: 'Core Business Process',
        domain: domains.length > 0 ? domains[0].name : 'General',
        type: 'operational',
        currentState: 'manual',
        targetState: 'automated'
      }).markDefined());
    }

    return capabilities;
  }

  /**
   * Stage 4: Identify Requirements
   */
  identifyRequirements(description) {
    const requirements = [];
    
    // Extract numbered/bulleted requirements
    const lines = description.split('\n').filter(l => l.trim());
    const reqKeywords = ['must', 'should', 'need', 'require', 'can', 'ability'];

    for (const line of lines) {
      if (reqKeywords.some(kw => line.toLowerCase().includes(kw))) {
        const requirement = new BusinessRequirement({
          name: line.substring(0, 100),
          description: line,
          type: 'functional',
          priority: this.extractPriority(line)
        });
        requirement.markAnalyzed();
        requirements.push(requirement);
      }
    }

    if (requirements.length === 0) {
      requirements.push(new BusinessRequirement({
        name: 'Primary Business Requirement',
        description: description,
        type: 'functional',
        priority: 'high'
      }).markAnalyzed());
    }

    return requirements;
  }

  /**
   * Stage 5: Identify Required Objects
   */
  identifyObjects(description, domains, capabilities) {
    const objects = [];
    
    // Common business objects
    const objectPatterns = {
      'Customer': /customer|client|account|user|person/i,
      'Order': /order|purchase|sale|transaction|deal/i,
      'Product': /product|service|item|offering|solution/i,
      'Invoice': /invoice|billing|receipt|payment/i,
      'Employee': /employee|staff|resource|person|user/i,
      'Department': /department|team|group|division|unit/i,
      'Project': /project|initiative|program|campaign/i,
      'Budget': /budget|financial|cost|expense|allocation/i,
      'Document': /document|form|report|file|record/i,
      'Task': /task|activity|work|action|step/i
    };

    for (const [objName, pattern] of Object.entries(objectPatterns)) {
      if (pattern.test(description)) {
        objects.push({
          name: objName,
          domain: domains.length > 0 ? domains[0].name : 'General',
          type: 'entity',
          status: 'identified',
          properties: [`id`, `name`, `description`, `createdAt`, `status`]
        });
      }
    }

    if (objects.length === 0) {
      objects.push({
        name: 'Entity',
        domain: domains.length > 0 ? domains[0].name : 'General',
        type: 'entity',
        status: 'identified',
        properties: ['id', 'name', 'description', 'createdAt']
      });
    }

    return objects;
  }

  /**
   * Stage 6: Identify Relationships
   */
  identifyRelationships(objects) {
    const relationships = [];

    // Define standard relationships
    const relationshipPatterns = [
      { from: 'Order', to: 'Customer', type: 'many-to-one', name: 'placedBy' },
      { from: 'Order', to: 'Product', type: 'many-to-many', name: 'contains' },
      { from: 'Invoice', to: 'Order', type: 'one-to-one', name: 'billedFrom' },
      { from: 'Employee', to: 'Department', type: 'many-to-one', name: 'worksIn' },
      { from: 'Project', to: 'Task', type: 'one-to-many', name: 'hasTasks' },
      { from: 'Task', to: 'Employee', type: 'many-to-one', name: 'assignedTo' }
    ];

    const objectNames = objects.map(o => o.name);

    for (const pattern of relationshipPatterns) {
      if (objectNames.includes(pattern.from) && objectNames.includes(pattern.to)) {
        relationships.push({
          from: pattern.from,
          to: pattern.to,
          type: pattern.type,
          name: pattern.name
        });
      }
    }

    return relationships;
  }

  /**
   * Stage 7: Identify Workflows
   */
  identifyWorkflows(description, capabilities, objects) {
    const workflows = [];
    
    const workflowPatterns = {
      'Order Processing': /order|process|fulfillment|payment/i,
      'Customer Onboarding': /onboard|register|signup|welcome/i,
      'Approval': /approve|review|decision|authorize|validate/i,
      'Reporting': /report|generate|analyze|export|dashboard/i,
      'Scheduling': /schedule|assign|allocate|plan|coordinate/i
    };

    for (const [wfName, pattern] of Object.entries(workflowPatterns)) {
      if (pattern.test(description)) {
        workflows.push({
          name: wfName + ' Workflow',
          description: `Workflow for ${wfName.toLowerCase()}`,
          steps: 5,
          objects: objects.slice(0, 2).map(o => o.name),
          status: 'identified'
        });
      }
    }

    if (workflows.length === 0) {
      workflows.push({
        name: 'Primary Workflow',
        description: 'Main business workflow',
        steps: 3,
        objects: objects.slice(0, 1).map(o => o.name),
        status: 'identified'
      });
    }

    return workflows;
  }

  /**
   * Stage 8: Identify Automations
   */
  identifyAutomations(description, workflows, capabilities) {
    const automations = [];

    const automationPatterns = [
      { name: 'Data Validation', trigger: 'validate|verify|check', condition: 'data entry' },
      { name: 'Notification', trigger: 'notify|alert|message', condition: 'status change' },
      { name: 'Calculation', trigger: 'calculate|compute|aggregate', condition: 'data change' },
      { name: 'Escalation', trigger: 'escalate|urgency|priority', condition: 'timeout' },
      { name: 'Reporting', trigger: 'report|generate|export', condition: 'schedule' }
    ];

    for (const pattern of automationPatterns) {
      if (new RegExp(pattern.trigger, 'i').test(description)) {
        automations.push({
          name: pattern.name,
          type: 'rule-based',
          trigger: pattern.trigger,
          condition: pattern.condition,
          action: `Execute ${pattern.name.toLowerCase()}`,
          status: 'identified'
        });
      }
    }

    if (automations.length === 0) {
      automations.push({
        name: 'Data Processing',
        type: 'rule-based',
        trigger: 'manual',
        condition: 'user action',
        action: 'Process business data',
        status: 'identified'
      });
    }

    return automations;
  }

  /**
   * Stage 9: Identify AI Agents
   */
  identifyAgents(description, capabilities, objects) {
    const agents = [];

    const agentPatterns = {
      'Data Analyst': /analyze|insight|metric|pattern|trend/i,
      'Process Optimizer': /optimize|improve|efficiency|automate/i,
      'Decision Advisor': /decision|recommend|advise|suggest/i,
      'Customer Service': /customer|support|help|service|complaint/i,
      'Forecaster': /predict|forecast|estimate|project|trend/i
    };

    for (const [agentName, pattern] of Object.entries(agentPatterns)) {
      if (pattern.test(description)) {
        agents.push({
          name: agentName + ' Agent',
          domain: 'analysis',
          role: 'specialist',
          capabilities: capabilities.slice(0, 2).map(c => c.name),
          status: 'identified'
        });
      }
    }

    if (agents.length === 0) {
      agents.push({
        name: 'Business Assistant',
        domain: 'general',
        role: 'specialist',
        capabilities: ['Data analysis', 'Recommendation'],
        status: 'identified'
      });
    }

    return agents;
  }

  /**
   * Stage 10: Identify Applications
   */
  identifyApplications(domains, objects, workflows) {
    const applications = [];

    // Map domains to typical applications
    const appPatterns = {
      'Operations': 'Operations Management System',
      'Finance': 'Financial Management System',
      'Sales': 'Customer Relationship System',
      'Marketing': 'Campaign Management System',
      'HR': 'Human Resources System',
      'IT': 'IT Management System',
      'Compliance': 'Governance & Compliance System',
      'Strategy': 'Strategic Planning System'
    };

    for (const domain of domains) {
      const appName = appPatterns[domain.name] || `${domain.name} System`;
      applications.push({
        name: appName,
        domain: domain.name,
        type: 'business-application',
        modules: 3,
        objects: objects.slice(0, 2).map(o => o.name),
        status: 'identified'
      });
    }

    return applications;
  }

  /**
   * Stage 11: Identify Solutions
   */
  identifySolutions(applications, workflows) {
    const solutions = [];

    // Group applications into solutions
    for (let i = 0; i < applications.length; i += 2) {
      const apps = applications.slice(i, i + 2);
      solutions.push({
        name: `${apps[0].domain} Solution`,
        description: `Integrated solution for ${apps[0].domain.toLowerCase()} operations`,
        type: 'enterprise-solution',
        applications: apps.map(a => a.name),
        workflows: workflows.slice(0, 2).map(w => w.name),
        status: 'identified'
      });
    }

    if (solutions.length === 0) {
      solutions.push({
        name: 'Integrated Business Solution',
        description: 'Complete business management solution',
        type: 'enterprise-solution',
        applications: applications.map(a => a.name),
        workflows: workflows.map(w => w.name),
        status: 'identified'
      });
    }

    return solutions;
  }

  /**
   * Stage 12: Generate GEDL Definitions
   */
  generateGEDLDefinitions(businessModel) {
    const definitions = [];

    // Generate object definitions
    for (const obj of businessModel.identifiedObjects) {
      const def = new GEDLDefinition({
        name: obj.name,
        type: 'object',
        domain: obj.domain,
        metadata: {
          properties: obj.properties || []
        }
      });
      def.markDefined();
      definitions.push(def);
    }

    // Generate workflow definitions
    for (const wf of businessModel.identifiedWorkflows) {
      const def = new GEDLDefinition({
        name: wf.name,
        type: 'workflow',
        domain: businessModel.domains[0]?.name || 'General',
        metadata: {
          steps: wf.steps,
          objects: wf.objects
        }
      });
      def.markDefined();
      definitions.push(def);
    }

    // Generate automation definitions
    for (const auto of businessModel.identifiedAutomations) {
      const def = new GEDLDefinition({
        name: auto.name,
        type: 'automation',
        domain: businessModel.domains[0]?.name || 'General',
        metadata: {
          trigger: auto.trigger,
          condition: auto.condition,
          action: auto.action
        }
      });
      def.markDefined();
      definitions.push(def);
    }

    // Generate agent definitions
    for (const agent of businessModel.identifiedAgents) {
      const def = new GEDLDefinition({
        name: agent.name,
        type: 'agent',
        domain: agent.domain,
        metadata: {
          role: agent.role,
          capabilities: agent.capabilities
        }
      });
      def.markDefined();
      definitions.push(def);
    }

    return definitions;
  }

  /**
   * Compile business description to model
   */
  async compileBusinessDescription(description) {
    try {
      this.result = new BusinessCompilationResult();

      // Stage 1: Parse Intent
      const intent = this.parseBusinessIntent(description);
      this.result.businessIntent = intent;

      // Stage 2: Identify Domains
      const domains = this.identifyDomains(description);
      this.result.identifiedDomains = domains;

      // Stage 3: Identify Capabilities
      const capabilities = this.identifyCapabilities(domains, description);
      this.result.identifiedCapabilities = capabilities;

      // Stage 4: Identify Requirements
      const requirements = this.identifyRequirements(description);

      // Stage 5: Identify Objects
      const objects = this.identifyObjects(description, domains, capabilities);

      // Stage 6: Identify Relationships
      const relationships = this.identifyRelationships(objects);

      // Stage 7: Identify Workflows
      const workflows = this.identifyWorkflows(description, capabilities, objects);

      // Stage 8: Identify Automations
      const automations = this.identifyAutomations(description, workflows, capabilities);

      // Stage 9: Identify AI Agents
      const agents = this.identifyAgents(description, capabilities, objects);

      // Stage 10: Identify Applications
      const applications = this.identifyApplications(domains, objects, workflows);

      // Stage 11: Identify Solutions
      const solutions = this.identifySolutions(applications, workflows);

      // Build Business Model
      this.businessModel = new BusinessModel({
        name: intent.name,
        description: description,
        intent: intent,
        domains: domains,
        capabilities: capabilities,
        requirements: requirements,
        constraints: [],
        identifiedObjects: objects,
        identifiedModules: this.generateModuleDefinitions(domains, objects),
        identifiedApplications: applications,
        identifiedSolutions: solutions,
        identifiedWorkflows: workflows,
        identifiedAutomations: automations,
        identifiedAgents: agents
      });

      this.businessModel.markAnalyzed();
      this.result.businessModel = this.businessModel;

      // Stage 12: Generate GEDL Definitions
      const gedlDefinitions = this.generateGEDLDefinitions(this.businessModel);
      this.result.gedlDefinitions = gedlDefinitions;

      // Generate Artifacts
      const artifacts = this.generateArtifacts(this.businessModel);
      this.result.artifacts = artifacts;

      // Update Metrics
      this.result.metrics.domainsIdentified = domains.length;
      this.result.metrics.capabilitiesIdentified = capabilities.length;
      this.result.metrics.objectsIdentified = objects.length;
      this.result.metrics.modulesIdentified = this.businessModel.identifiedModules.length;
      this.result.metrics.applicationsIdentified = applications.length;
      this.result.metrics.solutionsIdentified = solutions.length;
      this.result.metrics.workflowsIdentified = workflows.length;
      this.result.metrics.automationsIdentified = automations.length;
      this.result.metrics.agentsIdentified = agents.length;
      this.result.metrics.gedlDefinitionsGenerated = gedlDefinitions.length;
      this.result.metrics.artifactsGenerated = artifacts.length;

      this.result.markSuccess();

      return this.result;
    } catch (error) {
      this.result.markFailed();
      this.result.addValidationError(error.message);
      throw error;
    }
  }

  /**
   * Generate module definitions
   */
  generateModuleDefinitions(domains, objects) {
    const modules = [];
    for (let i = 0; i < Math.min(domains.length, 3); i++) {
      modules.push({
        name: `${domains[i].name}Module`,
        domain: domains[i].name,
        objects: objects.slice(0, Math.ceil(objects.length / domains.length)).map(o => o.name),
        status: 'identified'
      });
    }
    return modules;
  }

  /**
   * Generate compilation artifacts
   */
  generateArtifacts(businessModel) {
    const artifacts = [];

    // Object definitions artifact
    artifacts.push(new CompilationArtifact({
      name: 'Object Definitions',
      type: 'definition',
      format: 'json',
      targetCompiler: 'object',
      content: JSON.stringify(businessModel.identifiedObjects, null, 2),
      metadata: { count: businessModel.identifiedObjects.length }
    }));

    // Module definitions artifact
    artifacts.push(new CompilationArtifact({
      name: 'Module Definitions',
      type: 'definition',
      format: 'json',
      targetCompiler: 'module',
      content: JSON.stringify(businessModel.identifiedModules, null, 2),
      metadata: { count: businessModel.identifiedModules.length }
    }));

    // Application definitions artifact
    artifacts.push(new CompilationArtifact({
      name: 'Application Definitions',
      type: 'definition',
      format: 'json',
      targetCompiler: 'application',
      content: JSON.stringify(businessModel.identifiedApplications, null, 2),
      metadata: { count: businessModel.identifiedApplications.length }
    }));

    // Solution definitions artifact
    artifacts.push(new CompilationArtifact({
      name: 'Solution Definitions',
      type: 'definition',
      format: 'json',
      targetCompiler: 'solution',
      content: JSON.stringify(businessModel.identifiedSolutions, null, 2),
      metadata: { count: businessModel.identifiedSolutions.length }
    }));

    for (const artifact of artifacts) {
      artifact.markValid();
    }

    return artifacts;
  }

  /**
   * Persist compilation results
   */
  async persistResults() {
    const outputDir = path.join(
      __dirname,
      '../../..',
      'out/generated/business-compilation',
      `compilation-${new Date().toISOString().slice(0, 10)}`
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write business model
    fs.writeFileSync(
      path.join(outputDir, 'business-model.json'),
      JSON.stringify(this.businessModel?.toJSON?.() || this.businessModel, null, 2)
    );

    // Write compilation result
    fs.writeFileSync(
      path.join(outputDir, 'compilation-result.json'),
      JSON.stringify(this.result.toJSON(), null, 2)
    );

    // Write GEDL definitions
    fs.writeFileSync(
      path.join(outputDir, 'gedl-definitions.json'),
      JSON.stringify(this.result.gedlDefinitions.map(d => d.toJSON()), null, 2)
    );

    // Write artifacts
    for (const artifact of this.result.artifacts) {
      const artifactFile = `${artifact.targetCompiler}-definitions.json`;
      fs.writeFileSync(
        path.join(outputDir, artifactFile),
        artifact.content
      );
    }

    return outputDir;
  }

  /**
   * Get compilation summary
   */
  getSummary() {
    return {
      compilationId: this.result?.id,
      status: this.result?.status,
      businessIntent: this.businessIntent?.name,
      domainsIdentified: this.result?.metrics.domainsIdentified || 0,
      objectsIdentified: this.result?.metrics.objectsIdentified || 0,
      modulesIdentified: this.result?.metrics.modulesIdentified || 0,
      applicationsIdentified: this.result?.metrics.applicationsIdentified || 0,
      solutionsIdentified: this.result?.metrics.solutionsIdentified || 0,
      gedlDefinitionsGenerated: this.result?.metrics.gedlDefinitionsGenerated || 0,
      errors: this.result?.validationErrors.length || 0,
      warnings: this.result?.validationWarnings.length || 0
    };
  }
}
