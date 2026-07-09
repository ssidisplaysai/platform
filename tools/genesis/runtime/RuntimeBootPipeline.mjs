/**
 * RuntimeBootPipeline - Genesis Runtime Boot v1 Orchestrator
 *
 * Implements the 12-stage metadata-driven boot pipeline:
 *
 * Stage 1:  Manifest Discovery - Discover all generated manifests
 * Stage 2:  Manifest Validation - Validate all manifests
 * Stage 3:  Module Registration - Register modules
 * Stage 4:  Object Registration - Register objects
 * Stage 5:  Repository Registration - Register repositories
 * Stage 6:  Service Registration - Register services
 * Stage 7:  API Registration - Register APIs
 * Stage 8:  Workflow Registration - Register workflows
 * Stage 9:  Automation Registration - Register automations
 * Stage 10: AI Agent Registration - Register AI agents
 * Stage 11: Dependency Resolution - Resolve dependencies
 * Stage 12: Runtime Ready - Mark runtime as ready
 *
 * All stages are generic and metadata-driven, with no hardcoding.
 *
 * @module tools/genesis/runtime/RuntimeBootPipeline
 */

import fs from 'fs';
import path from 'path';

/**
 * RuntimeBootPipeline - Main boot orchestrator
 */
export class RuntimeBootPipeline {
  constructor(config = {}) {
    this.bootId = `boot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = {
      manifestDiscoveryPath: config.manifestDiscoveryPath || 'out/generated',
      validateManifests: config.validateManifests !== false,
      validateDependencies: config.validateDependencies !== false,
      resolveCircularDependencies: config.resolveCircularDependencies !== false,
      failOnValidationError: config.failOnValidationError !== true,
      failOnRegistrationError: config.failOnRegistrationError !== true,
      timeout: config.timeout || 30000,
      ...config
    };

    this.bootManifest = {
      schema: 'https://genesis.internal/schema/runtime-boot-manifest.json',
      version: '1.0.0',
      bootId: this.bootId,
      startTime: new Date().toISOString(),
      status: 'pending',
      stages: [],
      stageResults: [],
      finalState: {},
      metadata: {
        bootVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        generatedBy: 'RuntimeBootPipeline',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    this.context = {
      bootId: this.bootId,
      phase: 'initializing',
      discoveries: new Map(),
      validations: new Map(),
      registrations: new Map(),
      dependencies: [],
      registryEntries: new Map(),
      errors: [],
      warnings: [],
      events: []
    };

    this.stageHandlers = this.initializeStageHandlers();
  }

  initializeStageHandlers() {
    return new Map([
      ['manifest-discovery', this.stageManifestDiscovery.bind(this)],
      ['manifest-validation', this.stageManifestValidation.bind(this)],
      ['module-registration', this.stageModuleRegistration.bind(this)],
      ['object-registration', this.stageObjectRegistration.bind(this)],
      ['repository-registration', this.stageRepositoryRegistration.bind(this)],
      ['service-registration', this.stageServiceRegistration.bind(this)],
      ['api-registration', this.stageAPIRegistration.bind(this)],
      ['workflow-registration', this.stageWorkflowRegistration.bind(this)],
      ['automation-registration', this.stageAutomationRegistration.bind(this)],
      ['agent-registration', this.stageAgentRegistration.bind(this)],
      ['dependency-resolution', this.stageDependencyResolution.bind(this)],
      ['runtime-ready', this.stageRuntimeReady.bind(this)]
    ]);
  }

  async boot() {
    console.log(`\n🚀 Genesis Runtime Boot v1 - Starting boot sequence (${this.bootId})...\n`);

    this.bootManifest.status = 'in-progress';
    this.context.phase = 'boot-in-progress';

    const stages = this.getBootStages();

    for (const stage of stages) {
      try {
        const handler = this.stageHandlers.get(stage.id);
        if (!handler) {
          throw new Error(`No handler for stage: ${stage.id}`);
        }

        console.log(`\n✓ Stage ${stage.order}: ${stage.name}`);
        console.log(`  ${stage.description}`);

        const stageResult = await handler(stage);
        this.bootManifest.stageResults.push(stageResult);

        if (stageResult.status === 'failed' && this.config.failOnValidationError) {
          throw new Error(`Stage failed: ${stage.name}`);
        }
      } catch (error) {
        this.context.errors.push(`Stage ${stage.id} failed: ${error.message}`);
        
        if (this.config.failOnValidationError) {
          this.bootManifest.status = 'failed';
          this.bootManifest.endTime = new Date().toISOString();
          throw error;
        }
      }
    }

    this.bootManifest.status = 'completed';
    this.bootManifest.endTime = new Date().toISOString();
    this.bootManifest.totalDuration = 
      new Date(this.bootManifest.endTime).getTime() - 
      new Date(this.bootManifest.startTime).getTime();

    this.bootManifest.finalState = this.buildFinalState();

    console.log(`\n✅ Boot Completed\n`);
    console.log(this.summarizeBootResults());

    return this.bootManifest;
  }

  getBootStages() {
    return [
      {
        id: 'manifest-discovery',
        name: 'Manifest Discovery',
        description: 'Discover all generated manifests from compilation output',
        order: 1,
        dependencies: [],
        timeout: 5000,
        retryable: false
      },
      {
        id: 'manifest-validation',
        name: 'Manifest Validation',
        description: 'Validate all discovered manifests against schemas',
        order: 2,
        dependencies: ['manifest-discovery'],
        timeout: 5000,
        retryable: false
      },
      {
        id: 'module-registration',
        name: 'Module Registration',
        description: 'Register discovered modules into runtime registry',
        order: 3,
        dependencies: ['manifest-validation'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'object-registration',
        name: 'Object Registration',
        description: 'Register discovered objects into runtime registry',
        order: 4,
        dependencies: ['module-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'repository-registration',
        name: 'Repository Registration',
        description: 'Register object repositories into runtime registry',
        order: 5,
        dependencies: ['object-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'service-registration',
        name: 'Service Registration',
        description: 'Register object services into runtime registry',
        order: 6,
        dependencies: ['object-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'api-registration',
        name: 'API Registration',
        description: 'Register module APIs into runtime registry',
        order: 7,
        dependencies: ['service-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'workflow-registration',
        name: 'Workflow Registration',
        description: 'Register module workflows into runtime registry',
        order: 8,
        dependencies: ['module-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'automation-registration',
        name: 'Automation Registration',
        description: 'Register module automations into runtime registry',
        order: 9,
        dependencies: ['workflow-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'agent-registration',
        name: 'AI Agent Registration',
        description: 'Register AI agents into runtime registry',
        order: 10,
        dependencies: ['object-registration'],
        timeout: 5000,
        retryable: true
      },
      {
        id: 'dependency-resolution',
        name: 'Dependency Resolution',
        description: 'Resolve all module and object dependencies',
        order: 11,
        dependencies: ['module-registration', 'object-registration', 'workflow-registration', 'automation-registration', 'agent-registration'],
        timeout: 5000,
        retryable: false
      },
      {
        id: 'runtime-ready',
        name: 'Runtime Ready',
        description: 'Verify runtime is ready for operation',
        order: 12,
        dependencies: ['dependency-resolution'],
        timeout: 5000,
        retryable: false
      }
    ];
  }

  async stageManifestDiscovery(stage) {
    const startTime = Date.now();
    this.context.phase = 'discovering';

    try {
      const manifests = await this.discoverManifests(this.config.manifestDiscoveryPath);
      
      let discoveredCount = 0;
      for (const manifest of manifests) {
        this.context.discoveries.set(`${manifest.type}:${manifest.id}`, manifest);
        discoveredCount++;
      }

      return {
        stageId: stage.id,
        stageName: stage.name,
        status: 'completed',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        itemsProcessed: discoveredCount,
        itemsFailed: 0,
        warnings: [],
        errors: [],
        details: {
          discoveredModules: manifests.filter(m => m.type === 'module').length,
          discoveredObjects: manifests.filter(m => m.type === 'object').length,
          discoveredAPIs: manifests.filter(m => m.type === 'api').length,
          discoveredWorkflows: manifests.filter(m => m.type === 'workflow').length,
          discoveredAutomations: manifests.filter(m => m.type === 'automation').length,
          discoveredAgents: manifests.filter(m => m.type === 'agent').length,
          discoveredKnowledge: manifests.filter(m => m.type === 'knowledge').length
        }
      };
    } catch (error) {
      return {
        stageId: stage.id,
        stageName: stage.name,
        status: 'failed',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        itemsProcessed: 0,
        itemsFailed: 0,
        warnings: [],
        errors: [error.message],
        details: {}
      };
    }
  }

  async discoverManifests(basePath) {
    const manifests = [];
    const modulesPath = path.join(basePath, 'modules');

    if (!fs.existsSync(modulesPath)) {
      return manifests;
    }

    const modules = fs.readdirSync(modulesPath);

    for (const moduleDir of modules) {
      const modulePath = path.join(modulesPath, moduleDir);
      const stats = fs.statSync(modulePath);

      if (!stats.isDirectory()) continue;

      const files = fs.readdirSync(modulePath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(modulePath, file);
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const manifestType = this.determineManifestType(file);
        
        manifests.push({
          type: manifestType,
          id: this.extractManifestId(fileContent, manifestType),
          name: this.extractManifestName(fileContent),
          namespace: this.extractManifestNamespace(fileContent),
          filePath,
          content: fileContent,
          validated: false,
          validationErrors: []
        });
      }
    }

    return manifests;
  }

  determineManifestType(filename) {
    if (filename.includes('.module.')) return 'module';
    if (filename.includes('.navigation.')) return 'navigation';
    if (filename.includes('.api.')) return 'api';
    if (filename.includes('.dashboard.')) return 'dashboard';
    if (filename.includes('.workflow.')) return 'workflow';
    if (filename.includes('.automation.')) return 'automation';
    if (filename.includes('.agent.')) return 'agent';
    if (filename.includes('.knowledge.')) return 'knowledge';
    if (filename.includes('.registration.')) return 'object-registration';
    return 'unknown';
  }

  extractManifestId(content, type) {
    if (type === 'module') return content.module?.id || content.module?.namespace || 'unknown';
    if (content[type]?.id) return content[type].id;
    if (content.module?.id) return content.module.id;
    return 'unknown';
  }

  extractManifestName(content) {
    if (content.module?.name) return content.module.name;
    if (content[Object.keys(content)[0]]?.name) return content[Object.keys(content)[0]].name;
    return 'unnamed';
  }

  extractManifestNamespace(content) {
    if (content.module?.namespace) return content.module.namespace;
    if (content[Object.keys(content)[0]]?.namespace) return content[Object.keys(content)[0]].namespace;
    return 'default';
  }

  async stageManifestValidation(stage) {
    const startTime = Date.now();
    this.context.phase = 'validating';

    let validated = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      const validationResult = await this.validateManifest(manifest);
      this.context.validations.set(key, validationResult);

      if (validationResult.valid) {
        validated++;
      } else {
        failed++;
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: validated,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} manifests failed validation`] : [],
      details: {
        validatedCount: validated,
        failedCount: failed
      }
    };
  }

  async validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest.content.$schema) {
      errors.push('Missing $schema');
    }

    if (!manifest.content.version) {
      errors.push('Missing version');
    }

    if (manifest.type === 'module') {
      if (!manifest.content.module?.id) errors.push('Missing module.id');
      if (!manifest.content.module?.namespace) errors.push('Missing module.namespace');
    }

    if (manifest.type !== 'knowledge' && manifest.type !== 'dashboard') {
      const typeKey = manifest.type;
      if (!manifest.content[typeKey]) {
        warnings.push(`Content missing ${typeKey} section`);
      }
    }

    return {
      manifestId: manifest.id,
      manifestType: manifest.type,
      valid: errors.length === 0,
      schema: manifest.content.$schema,
      version: manifest.content.version,
      errors: errors.map(e => ({ path: 'root', message: e, severity: 'error' })),
      warnings
    };
  }

  async stageModuleRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'module') continue;

      const registrationResult = await this.registerManifest(manifest, 'module');
      this.context.registrations.set(key, registrationResult);

      if (registrationResult.registered) {
        registered++;
      } else {
        failed++;
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} modules failed registration`] : [],
      details: { registeredModules: registered, failedModules: failed }
    };
  }

  async stageObjectRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (!['object-registration', 'module'].includes(manifest.type)) continue;
      if (manifest.type === 'module') continue;

      const registrationResult = await this.registerManifest(manifest, 'object');
      this.context.registrations.set(key, registrationResult);

      if (registrationResult.registered) {
        registered++;
      } else {
        failed++;
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} objects failed registration`] : [],
      details: { registeredObjects: registered, failedObjects: failed }
    };
  }

  async stageRepositoryRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'object-registration') continue;

      if (manifest.content.repository) {
        const registrationResult = await this.registerManifest(
          { ...manifest, type: 'repository', id: `repo:${manifest.id}` },
          'repository'
        );
        this.context.registrations.set(`repository:${key}`, registrationResult);

        if (registrationResult.registered) {
          registered++;
        } else {
          failed++;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} repositories failed registration`] : [],
      details: { registeredRepositories: registered, failedRepositories: failed }
    };
  }

  async stageServiceRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'object-registration') continue;

      if (manifest.content.service) {
        const registrationResult = await this.registerManifest(
          { ...manifest, type: 'service', id: `svc:${manifest.id}` },
          'service'
        );
        this.context.registrations.set(`service:${key}`, registrationResult);

        if (registrationResult.registered) {
          registered++;
        } else {
          failed++;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} services failed registration`] : [],
      details: { registeredServices: registered, failedServices: failed }
    };
  }

  async stageAPIRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'api') continue;

      const registrationResult = await this.registerManifest(manifest, 'api');
      this.context.registrations.set(key, registrationResult);

      if (registrationResult.registered) {
        registered++;
      } else {
        failed++;
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} APIs failed registration`] : [],
      details: { registeredAPIs: registered, failedAPIs: failed }
    };
  }

  async stageWorkflowRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'workflow') continue;

      const workflowCount = manifest.content.workflow?.workflows?.length || 0;
      if (workflowCount > 0) {
        const registrationResult = await this.registerManifest(manifest, 'workflow');
        this.context.registrations.set(key, registrationResult);

        if (registrationResult.registered) {
          registered += workflowCount;
        } else {
          failed += workflowCount;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} workflows failed registration`] : [],
      details: { registeredWorkflows: registered, failedWorkflows: failed }
    };
  }

  async stageAutomationRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'automation') continue;

      const automationCount = manifest.content.automation?.automations?.length || 0;
      if (automationCount > 0) {
        const registrationResult = await this.registerManifest(manifest, 'automation');
        this.context.registrations.set(key, registrationResult);

        if (registrationResult.registered) {
          registered += automationCount;
        } else {
          failed += automationCount;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} automations failed registration`] : [],
      details: { registeredAutomations: registered, failedAutomations: failed }
    };
  }

  async stageAgentRegistration(stage) {
    const startTime = Date.now();

    let registered = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'agent') continue;

      const agentCount = manifest.content.aiAgent?.agents?.length || 0;
      if (agentCount > 0) {
        const registrationResult = await this.registerManifest(manifest, 'agent');
        this.context.registrations.set(key, registrationResult);

        if (registrationResult.registered) {
          registered += agentCount;
        } else {
          failed += agentCount;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: registered,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} agents failed registration`] : [],
      details: { registeredAgents: registered, failedAgents: failed }
    };
  }

  async registerManifest(manifest, type) {
    const registryKey = `${type}:${manifest.namespace}:${manifest.id}`;

    try {
      const registryEntry = {
        id: manifest.id,
        type: type,
        name: manifest.name,
        namespace: manifest.namespace,
        tier: manifest.content.module?.tier || 'standard',
        domain: manifest.content.module?.domain || 'default',
        registeredAt: new Date().toISOString(),
        version: manifest.content.version || '1.0.0',
        status: 'registered',
        metadata: {
          filePath: manifest.filePath,
          manifestType: manifest.type
        }
      };

      this.context.registryEntries.set(registryKey, registryEntry);

      return {
        manifestId: manifest.id,
        manifestType: type,
        registered: true,
        registryKey,
        registeredAt: new Date().toISOString(),
        errors: []
      };
    } catch (error) {
      return {
        manifestId: manifest.id,
        manifestType: type,
        registered: false,
        registryKey,
        registeredAt: new Date().toISOString(),
        errors: [error.message]
      };
    }
  }

  async stageDependencyResolution(stage) {
    const startTime = Date.now();
    this.context.phase = 'resolving';

    let resolved = 0;
    let failed = 0;

    for (const [key, manifest] of this.context.discoveries) {
      if (manifest.type !== 'module') continue;

      const dependencies = manifest.content.relationships?.dependencies || [];

      for (const dep of dependencies) {
        const depKey = `module:${dep.namespace}:${dep.module}`;
        
        if (this.context.registryEntries.has(depKey)) {
          this.context.dependencies.push({
            from: { type: 'module', id: manifest.id, namespace: manifest.namespace },
            to: { type: 'module', id: dep.module, namespace: dep.namespace },
            type: dep.type || 'reference',
            required: true,
            resolved: true,
            errors: []
          });
          resolved++;
        } else {
          this.context.dependencies.push({
            from: { type: 'module', id: manifest.id, namespace: manifest.namespace },
            to: { type: 'module', id: dep.module, namespace: dep.namespace },
            type: dep.type || 'reference',
            required: true,
            resolved: false,
            errors: ['Dependency not found in registry']
          });
          failed++;
        }
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: resolved,
      itemsFailed: failed,
      warnings: [],
      errors: failed > 0 ? [`${failed} dependencies unresolved`] : [],
      details: { resolvedDependencies: resolved, failedDependencies: failed }
    };
  }

  async stageRuntimeReady(stage) {
    const startTime = Date.now();
    this.context.phase = 'ready';

    const isReady = 
      this.context.errors.length === 0 &&
      this.context.discoveries.size > 0 &&
      this.context.registrations.size > 0;

    return {
      stageId: stage.id,
      stageName: stage.name,
      status: isReady ? 'completed' : 'completed',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      itemsProcessed: 1,
      itemsFailed: 0,
      warnings: [],
      errors: [],
      details: {
        runtimeReady: isReady,
        discoveredItems: this.context.discoveries.size,
        registeredItems: this.context.registrations.size,
        totalErrors: this.context.errors.length,
        totalWarnings: this.context.warnings.length
      }
    };
  }

  buildFinalState() {
    const discoveredByType = new Map();
    const registeredByType = new Map();

    for (const [, manifest] of this.context.discoveries) {
      discoveredByType.set(manifest.type, (discoveredByType.get(manifest.type) || 0) + 1);
    }

    for (const [, registration] of this.context.registrations) {
      registeredByType.set(registration.manifestType, (registeredByType.get(registration.manifestType) || 0) + 1);
    }

    const isReady = 
      this.context.errors.length === 0 &&
      this.context.discoveries.size > 0;

    return {
      ready: isReady,
      phase: this.context.phase,
      
      discoveredModules: discoveredByType.get('module') || 0,
      discoveredObjects: discoveredByType.get('object') || 0,
      discoveredRepositories: discoveredByType.get('repository') || 0,
      discoveredServices: discoveredByType.get('service') || 0,
      discoveredAPIs: discoveredByType.get('api') || 0,
      discoveredWorkflows: discoveredByType.get('workflow') || 0,
      discoveredAutomations: discoveredByType.get('automation') || 0,
      discoveredAgents: discoveredByType.get('agent') || 0,
      
      registeredModules: registeredByType.get('module') || 0,
      registeredObjects: registeredByType.get('object') || 0,
      registeredRepositories: registeredByType.get('repository') || 0,
      registeredServices: registeredByType.get('service') || 0,
      registeredAPIs: registeredByType.get('api') || 0,
      registeredWorkflows: registeredByType.get('workflow') || 0,
      registeredAutomations: registeredByType.get('automation') || 0,
      registeredAgents: registeredByType.get('agent') || 0,
      
      dependenciesResolved: this.context.dependencies.filter(d => d.resolved).length,
      dependenciesFailed: this.context.dependencies.filter(d => !d.resolved).length,
      
      totalDiscovered: this.context.discoveries.size,
      totalRegistered: this.context.registrations.size,
      totalErrors: this.context.errors.length,
      totalWarnings: this.context.warnings.length,
      
      bootStartTime: this.bootManifest.startTime,
      bootEndTime: this.bootManifest.endTime,
      bootDuration: this.bootManifest.totalDuration
    };
  }

  summarizeBootResults() {
    const final = this.bootManifest.finalState;
    
    return `
════════════════════════════════════════════════════════════════════
                    GENESIS RUNTIME BOOT SUMMARY
════════════════════════════════════════════════════════════════════

  Runtime Status: ${final.ready ? '✅ READY' : '❌ NOT READY'}
  Boot Phase: ${final.phase}
  Duration: ${final.bootDuration}ms

  DISCOVERED:
    • Modules: ${final.discoveredModules}
    • Objects: ${final.discoveredObjects}
    • APIs: ${final.discoveredAPIs}
    • Workflows: ${final.discoveredWorkflows}
    • Automations: ${final.discoveredAutomations}
    • AI Agents: ${final.discoveredAgents}
    ───────────────
    Total: ${final.totalDiscovered}

  REGISTERED:
    • Modules: ${final.registeredModules}
    • Objects: ${final.registeredObjects}
    • APIs: ${final.registeredAPIs}
    • Workflows: ${final.registeredWorkflows}
    • Automations: ${final.registeredAutomations}
    • AI Agents: ${final.registeredAgents}
    ───────────────
    Total: ${final.totalRegistered}

  DEPENDENCIES:
    • Resolved: ${final.dependenciesResolved}
    • Failed: ${final.dependenciesFailed}

  ERRORS & WARNINGS:
    • Errors: ${final.totalErrors}
    • Warnings: ${final.totalWarnings}

════════════════════════════════════════════════════════════════════
`;
  }

  getBootManifest() {
    return this.bootManifest;
  }

  getContext() {
    return this.context;
  }
}
