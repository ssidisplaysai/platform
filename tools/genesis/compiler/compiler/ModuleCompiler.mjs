/**
 * ModuleCompiler - Genesis Module Compiler v0
 *
 * Compiles module manifests from module metadata, object registration manifests,
 * and object module data.
 *
 * Purpose:
 *   - Aggregate object metadata into module-level manifests
 *   - Document module boundaries and ownership
 *   - Calculate module relationships and dependencies
 *   - Generate consolidated module registries
 *   - Generate module API and navigation contracts
 *   - Validate module completeness and readiness
 *
 * Process:
 *   1. Load module definitions and entity mappings
 *   2. For each module:
 *      - Identify member objects
 *      - Load registration and module data
 *      - Build ModuleBlueprint
 *      - Render module manifest
 *      - Render API and navigation contracts
 *      - Write manifests and contracts to output
 *   3. Generate module registry summary
 *   4. Report compilation results
 *
 * Usage:
 *   const compiler = new ModuleCompiler();
 *   const result = await compiler.compileModules();
 *
 * @module tools/genesis/compiler/compiler/ModuleCompiler
 */

import fs from 'fs';
import path from 'path';
import { buildModuleBlueprint } from '../ir/ModuleBlueprintBuilder.mjs';
import { generateModuleManifest } from '../renderers/ModuleManifestRenderer.mjs';
import { generateNavigationContract } from '../renderers/ModuleNavigationContractRenderer.mjs';
import { generateAPIContract } from '../renderers/ModuleAPIContractRenderer.mjs';
import { generateDashboardContract } from '../renderers/ModuleDashboardContractRenderer.mjs';
import { generateWorkflowContract } from '../renderers/ModuleWorkflowContractRenderer.mjs';
import { generateAutomationContract } from '../renderers/ModuleAutomationContractRenderer.mjs';
import { generateAIAgentContract, generateKnowledgeContextContract } from '../renderers/ModuleAIAgentContractRenderer.mjs';

/**
 * Module registry with 7 core modules
 */
const MODULE_REGISTRY = {
  crm: {
    name: 'CRM',
    description: 'Customer Relationship Management',
    namespace: 'crm',
    tier: 'core',
    domain: 'sales',
    objects: [],
  },
  vendorManagement: {
    name: 'Vendor Management',
    description: 'Vendor and Supplier Management',
    namespace: 'vendorManagement',
    tier: 'core',
    domain: 'procurement',
    objects: [],
  },
  projects: {
    name: 'Projects',
    description: 'Project Management and Delivery',
    namespace: 'projects',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  assetManagement: {
    name: 'Asset Management',
    description: 'Asset Tracking and Maintenance',
    namespace: 'assetManagement',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  inventory: {
    name: 'Inventory',
    description: 'Inventory Management and Tracking',
    namespace: 'inventory',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  manufacturing: {
    name: 'Manufacturing',
    description: 'Manufacturing and Production',
    namespace: 'manufacturing',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
  workManagement: {
    name: 'Work Management',
    description: 'Work Order and Task Management',
    namespace: 'workManagement',
    tier: 'core',
    domain: 'operations',
    objects: [],
  },
};

/**
 * Entity-to-module mapping
 */
const ENTITY_MODULE_MAP = {
  Customer: 'crm',
  Vendor: 'vendorManagement',
  Project: 'projects',
  Asset: 'assetManagement',
  InventoryItem: 'inventory',
  Machine: 'manufacturing',
  WorkOrder: 'workManagement',
};

export class ModuleCompiler {
  constructor() {
    this.moduleRegistry = MODULE_REGISTRY;
    this.entityModuleMap = ENTITY_MODULE_MAP;
    this.outputDir = path.join(process.cwd(), 'out', 'generated', 'modules');
    this.results = {
      successful: 0,
      failed: 0,
      modules: [],
      errors: []
    };
  }

  /**
   * Compile all modules
   *
   * @returns {Promise<Object>} Compilation results
   */
  async compileModules() {
    console.log('🔧 Genesis Module Compiler v0 - Starting module compilation...\n');

    // Ensure output directory exists
    this.ensureOutputDirectory();

    // Get unique modules
    const moduleKeys = Object.keys(this.moduleRegistry);

    for (const moduleKey of moduleKeys) {
      try {
        await this.compileModule(moduleKey);
        this.results.successful += 1;
      } catch (error) {
        this.results.failed += 1;
        this.results.errors.push({
          module: moduleKey,
          error: error.message
        });
        console.error(`  ✗ ${moduleKey}: ${error.message}`);
      }
    }

    // Generate module registry summary
    await this.generateModuleRegistry();

    // Print results
    this.printResults();

    return this.results;
  }

  /**
   * Compile a single module
   *
   * @param {string} moduleKey - Module key (e.g., 'crm')
   * @returns {Promise<void>}
   */
  async compileModule(moduleKey) {
    const moduleMetadata = this.moduleRegistry[moduleKey];

    // Find member objects
    const memberObjects = this.findModuleMembers(moduleKey);

    if (memberObjects.length === 0) {
      throw new Error(`No member objects found for module ${moduleKey}`);
    }

    // Build ModuleBlueprint
    const blueprint = buildModuleBlueprint(
      moduleKey,
      moduleMetadata,
      memberObjects,
      this.moduleRegistry,
      this.entityModuleMap
    );

    // Render module manifest
    const manifest = generateModuleManifest(blueprint);

    // Render navigation and API contracts
    const navigationContract = generateNavigationContract(blueprint);
    const apiContract = generateAPIContract(blueprint);

    // Render dashboard contract
    const dashboardContract = generateDashboardContract(blueprint);

    // Render workflow contract
    const workflowContract = generateWorkflowContract(blueprint);

    // Render automation contract
    const automationContract = generateAutomationContract(blueprint);

    // Render AI agent contract (Phase 14)
    const aiAgentContract = generateAIAgentContract(blueprint);
    
    // Render knowledge context contract
    const knowledgeContextContract = generateKnowledgeContextContract(blueprint, blueprint.knowledgeContext);

    // Write manifest to file
    const moduleDir = path.join(this.outputDir, moduleMetadata.namespace);
    this.ensureDirectoryExists(moduleDir);

    const manifestPath = path.join(moduleDir, `${moduleMetadata.namespace}.module.json`);
    fs.writeFileSync(manifestPath, manifest, 'utf-8');

    // Write navigation contract
    const navigationPath = path.join(moduleDir, `${moduleMetadata.namespace}.navigation.json`);
    fs.writeFileSync(navigationPath, navigationContract, 'utf-8');

    // Write API contract
    const apiPath = path.join(moduleDir, `${moduleMetadata.namespace}.api.json`);
    fs.writeFileSync(apiPath, apiContract, 'utf-8');

    // Write dashboard contract
    const dashboardPath = path.join(moduleDir, `${moduleMetadata.namespace}.dashboard.json`);
    fs.writeFileSync(dashboardPath, dashboardContract, 'utf-8');

    // Write workflow contract
    const workflowPath = path.join(moduleDir, `${moduleMetadata.namespace}.workflow.json`);
    fs.writeFileSync(workflowPath, workflowContract, 'utf-8');

    // Write automation contract
    const automationPath = path.join(moduleDir, `${moduleMetadata.namespace}.automation.json`);
    fs.writeFileSync(automationPath, automationContract, 'utf-8');

    // Write AI agent contract (Phase 14)
    const aiAgentPath = path.join(moduleDir, `${moduleMetadata.namespace}.agent.json`);
    fs.writeFileSync(aiAgentPath, aiAgentContract, 'utf-8');

    // Write knowledge context contract
    const knowledgeContextPath = path.join(moduleDir, `${moduleMetadata.namespace}.knowledge.json`);
    fs.writeFileSync(knowledgeContextPath, knowledgeContextContract, 'utf-8');

    console.log(`  ✓ ${moduleMetadata.name}: ${manifestPath}`);

    this.results.modules.push({
      key: moduleKey,
      name: moduleMetadata.name,
      namespace: moduleMetadata.namespace,
      members: memberObjects,
      manifestPath,
      blueprint
    });
  }

  /**
   * Find objects belonging to a module
   *
   * @param {string} moduleKey - Module key
   * @returns {Array<string>} Entity names belonging to module
   */
  findModuleMembers(moduleKey) {
    const members = [];
    for (const [entity, module] of Object.entries(this.entityModuleMap)) {
      if (module === moduleKey) {
        members.push(entity);
      }
    }
    return members;
  }

  /**
   * Generate consolidated module registry
   *
   * @returns {Promise<void>}
   */
  async generateModuleRegistry() {
    const registry = {
      $schema: 'https://genesis.internal/schema/module-registry.json',
      version: '1.0.0',
      generated: {
        at: new Date().toISOString(),
        by: 'Genesis Module Compiler v0',
        phase: 'Module-Aware Architecture'
      },
      modules: this.results.modules.map(m => ({
        key: m.key,
        name: m.name,
        namespace: m.namespace,
        description: this.moduleRegistry[m.key].description,
        tier: this.moduleRegistry[m.key].tier,
        domain: this.moduleRegistry[m.key].domain,
        memberCount: m.members.length,
        members: m.members,
        registryPath: `/registry/modules/${m.namespace}`,
        manifestPath: m.manifestPath,
        relationships: m.blueprint.relationships
      })),
      summary: {
        totalModules: this.results.modules.length,
        totalObjects: Object.keys(this.entityModuleMap).length,
        byTier: this.summarizeByTier(),
        byDomain: this.summarizeByDomain()
      }
    };

    const registryPath = path.join(this.outputDir, 'module-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

    console.log(`\n  📋 Module Registry: ${registryPath}`);
  }

  /**
   * Summarize modules by tier
   *
   * @returns {Object} Tier summary
   */
  summarizeByTier() {
    const summary = {};
    for (const module of this.results.modules) {
      const tier = this.moduleRegistry[module.key].tier;
      if (!summary[tier]) {
        summary[tier] = 0;
      }
      summary[tier] += 1;
    }
    return summary;
  }

  /**
   * Summarize modules by domain
   *
   * @returns {Object} Domain summary
   */
  summarizeByDomain() {
    const summary = {};
    for (const module of this.results.modules) {
      const domain = this.moduleRegistry[module.key].domain;
      if (!summary[domain]) {
        summary[domain] = [];
      }
      summary[domain].push(module.name);
    }
    return summary;
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDirectory() {
    this.ensureDirectoryExists(this.outputDir);
  }

  /**
   * Ensure directory exists, create if not
   *
   * @param {string} dir - Directory path
   */
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Print compilation results
   */
  printResults() {
    console.log('\n' + '═'.repeat(70));
    console.log('MODULE COMPILATION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`\n  Successful: ${this.results.successful}`);
    console.log(`  Failed: ${this.results.failed}`);
    console.log(`  Total Modules: ${this.results.successful + this.results.failed}`);

    if (this.results.errors.length > 0) {
      console.log('\n  Errors:');
      for (const error of this.results.errors) {
        console.log(`    - ${error.module}: ${error.error}`);
      }
    }

    console.log('\n' + '═'.repeat(70));
  }
}

export default ModuleCompiler;
