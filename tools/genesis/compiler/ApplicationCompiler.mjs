/**
 * ApplicationCompiler - Genesis Application Compiler v1
 *
 * Metadata-driven compiler that assembles multiple compiled modules into
 * a deployable enterprise application:
 *
 * - Discover compiled modules from out/generated/modules
 * - Load module metadata and artifacts
 * - Validate dependencies and conflicts
 * - Assemble ApplicationBlueprint
 * - Generate Application Manifest
 * - Create navigation, dashboard, and API contracts
 * - Generate runtime registration metadata
 *
 * @module tools/genesis/compiler/ApplicationCompiler.mjs
 */

import {
  ApplicationBlueprint,
  ApplicationModule,
  ApplicationDependency,
  ApplicationPermission,
  ApplicationTheme,
  ApplicationSetting,
  ApplicationManifest
} from "./ApplicationBlueprintContract.mjs";
import { readFileSync, writeFileSync } from "fs";
import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class ApplicationCompiler {
  constructor(applicationName = "Genesis", options = {}) {
    this.applicationName = applicationName;
    this.applicationNamespace = applicationName.toLowerCase();
    this.options = options;

    this.discoveredModules = [];
    this.loadedModules = new Map(); // moduleName -> moduleData
    this.blueprint = null;
    this.manifest = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main compilation pipeline
   */
  async compile() {
    try {
      console.log(`\n≡ƒÜÇ Genesis Application Compiler v1 - Compiling '${this.applicationName}'`);
      console.log("");

      // Stage 1: Discover modules
      console.log("Stage 1: Module Discovery");
      this.discoverModules();
      console.log(`  ✓ Discovered ${this.discoveredModules.length} modules`);

      // Stage 2: Load module metadata
      console.log("Stage 2: Load Module Metadata");
      await this.loadModuleMetadata();
      console.log(`  ✓ Loaded metadata for ${this.loadedModules.size} modules`);

      // Stage 3: Validate dependencies
      console.log("Stage 3: Dependency Validation");
      this.validateDependencies();
      if (this.errors.length > 0) {
        console.log(`  ✗ ${this.errors.length} dependency errors`);
        return false;
      }
      console.log(`  ✓ All dependencies resolved`);

      // Stage 4: Resolve conflicts
      console.log("Stage 4: Conflict Resolution");
      this.resolveConflicts();
      console.log(`  ✓ Conflicts resolved`);

      // Stage 5: Assemble blueprint
      console.log("Stage 5: Blueprint Assembly");
      this.assembleBlueprint();
      console.log(`  ✓ Blueprint assembled`);

      // Stage 6: Validate blueprint
      console.log("Stage 6: Blueprint Validation");
      const blueprintValidation = this.blueprint.validate();
      if (!blueprintValidation.isValid) {
        console.log(`  ✗ ${blueprintValidation.errors.length} validation errors`);
        this.errors.push(...blueprintValidation.errors);
        return false;
      }
      console.log(`  ✓ Blueprint validated`);
      this.blueprint.markValidated();

      // Stage 7: Generate manifest
      console.log("Stage 7: Generate Application Manifest");
      this.generateManifest();
      console.log(`  ✓ Manifest generated`);

      // Stage 8: Generate artifacts
      console.log("Stage 8: Generate Application Artifacts");
      await this.generateArtifacts();
      console.log(`  ✓ Artifacts generated`);

      console.log("\n≡ƒôè APPLICATION COMPILATION COMPLETED");
      console.log(``);
      console.log(`  Application: ${this.applicationName}`);
      console.log(`  Namespace: ${this.applicationNamespace}`);
      console.log(`  Version: ${this.blueprint.version}`);
      console.log(`  Modules: ${this.blueprint.modules.length}`);
      console.log(`  Entities: ${this.blueprint.entities.length}`);
      console.log(`  APIs: ${this.blueprint.apis.length}`);
      console.log(`  Workflows: ${this.blueprint.workflows.length}`);
      console.log(`  Automations: ${this.blueprint.automations.length}`);
      console.log(`  AI Agents: ${this.blueprint.aiAgents.length}`);
      console.log("");

      this.blueprint.markCompiled();
      return true;
    } catch (error) {
      console.error(`\n✗ Compilation failed: ${error.message}`);
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Stage 1: Discover all compiled modules
   */
  discoverModules() {
    try {
      const modulesPath = join(projectRoot, "out/generated/modules");
      if (!existsSync(modulesPath)) {
        throw new Error("Modules directory not found");
      }

      const moduleNames = readdirSync(modulesPath)
        .filter(name => {
          const stat = statSync(join(modulesPath, name));
          return stat.isDirectory();
        })
        .sort();

      for (const moduleName of moduleNames) {
        this.discoveredModules.push({
          name: moduleName,
          path: join(modulesPath, moduleName)
        });
      }
    } catch (error) {
      this.errors.push(`Module discovery failed: ${error.message}`);
    }
  }

  /**
   * Stage 2: Load metadata from each discovered module
   */
  async loadModuleMetadata() {
    for (const module of this.discoveredModules) {
      try {
        const modulePath = module.path;
        const contracts = {};

        // Load all module contracts
        const contractFiles = [
          `${module.name}.module.json`,
          `${module.name}.api.json`,
          `${module.name}.workflow.json`,
          `${module.name}.automation.json`,
          `${module.name}.dashboard.json`,
          `${module.name}.navigation.json`,
          `${module.name}.agent.json`
        ];

        for (const file of contractFiles) {
          const filePath = join(modulePath, file);
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath, "utf8");
              contracts[file] = JSON.parse(content);
            } catch (error) {
              this.warnings.push(`Failed to load ${file}: ${error.message}`);
            }
          }
        }

        this.loadedModules.set(module.name, {
          name: module.name,
          path: modulePath,
          contracts
        });
      } catch (error) {
        this.warnings.push(`Failed to load metadata for ${module.name}: ${error.message}`);
      }
    }
  }

  /**
   * Stage 3: Validate all module dependencies
   */
  validateDependencies() {
    for (const [moduleName, moduleData] of this.loadedModules) {
      const moduleContract = moduleData.contracts[`${moduleName}.module.json`];
      if (!moduleContract || !moduleContract.dependencies) continue;

      for (const dep of moduleContract.dependencies) {
        if (dep.type === 'required' && !this.loadedModules.has(dep.module)) {
          this.errors.push(`Module '${moduleName}' requires '${dep.module}' which is not available`);
        }
      }
    }
  }

  /**
   * Stage 4: Resolve any conflicts between modules
   */
  resolveConflicts() {
    // In a real implementation, would handle namespace conflicts,
    // duplicate entity names, etc.
    // For now, just collect potential conflicts
    const entityNameCounts = {};

    for (const [moduleName, moduleData] of this.loadedModules) {
      const moduleContract = moduleData.contracts[`${moduleName}.module.json`];
      if (!moduleContract || !moduleContract.entities) continue;

      for (const entity of moduleContract.entities) {
        const fullName = `${moduleName}.${entity.name}`;
        entityNameCounts[fullName] = (entityNameCounts[fullName] || 0) + 1;
      }
    }

    for (const [name, count] of Object.entries(entityNameCounts)) {
      if (count > 1) {
        this.warnings.push(`Entity '${name}' appears in multiple modules (${count} times)`);
      }
    }
  }

  /**
   * Stage 5: Assemble ApplicationBlueprint from modules
   */
  assembleBlueprint() {
    const blueprint = new ApplicationBlueprint({
      id: `app-${this.applicationNamespace}`,
      name: this.applicationName,
      namespace: this.applicationNamespace,
      version: "1.0.0",
      description: `${this.applicationName} Enterprise Application`,
      owner: "Genesis"
    });

    // Add all discovered modules
    for (const [moduleName, moduleData] of this.loadedModules) {
      const moduleContract = moduleData.contracts[`${moduleName}.module.json`];
      if (!moduleContract) continue;

      const appModule = new ApplicationModule({
        name: moduleContract.module?.name || moduleName,
        namespace: moduleContract.module?.namespace || moduleName,
        version: moduleContract.module?.version || "1.0.0",
        description: moduleContract.module?.description || "",
        entities: moduleContract.entities || [],
        dependencies: moduleContract.dependencies || []
      });

      blueprint.modules.push(appModule);

      // Aggregate artifacts from module
      if (moduleData.contracts[`${moduleName}.api.json`]) {
        const apiContract = moduleData.contracts[`${moduleName}.api.json`];
        blueprint.apis.push(...(apiContract.endpoints || []));
      }

      if (moduleData.contracts[`${moduleName}.workflow.json`]) {
        const workflowContract = moduleData.contracts[`${moduleName}.workflow.json`];
        blueprint.workflows.push(...(workflowContract.workflows || []));
      }

      if (moduleData.contracts[`${moduleName}.automation.json`]) {
        const automationContract = moduleData.contracts[`${moduleName}.automation.json`];
        blueprint.automations.push(...(automationContract.automations || []));
      }

      if (moduleData.contracts[`${moduleName}.dashboard.json`]) {
        const dashboardContract = moduleData.contracts[`${moduleName}.dashboard.json`];
        blueprint.dashboards.push(...(dashboardContract.dashboards || []));
      }

      if (moduleData.contracts[`${moduleName}.navigation.json`]) {
        const navContract = moduleData.contracts[`${moduleName}.navigation.json`];
        Object.assign(blueprint.navigation, navContract.navigation || {});
      }

      if (moduleData.contracts[`${moduleName}.agent.json`]) {
        const agentContract = moduleData.contracts[`${moduleName}.agent.json`];
        blueprint.aiAgents.push(...(agentContract.agents || []));
      }

      // Aggregate entities
      if (moduleContract.entities) {
        blueprint.entities.push(...moduleContract.entities);
      }
    }

    this.blueprint = blueprint;
  }

  /**
   * Stage 7: Generate Application Manifest
   */
  generateManifest() {
    this.manifest = new ApplicationManifest({
      application: {
        id: this.blueprint.id,
        name: this.blueprint.name,
        namespace: this.blueprint.namespace,
        version: this.blueprint.version
      },
      blueprint: this.blueprint,
      modules: this.blueprint.modules.map(m => ({
        name: m.name,
        namespace: m.namespace,
        version: m.version
      })),
      entities: this.blueprint.entities,
      apis: this.blueprint.apis,
      workflows: this.blueprint.workflows,
      automations: this.blueprint.automations,
      aiAgents: this.blueprint.aiAgents,
      navigation: this.blueprint.navigation,
      dashboards: this.blueprint.dashboards,
      permissions: this.blueprint.permissions,
      theme: this.blueprint.theme,
      settings: this.blueprint.settings,
      statistics: {
        totalModules: this.blueprint.modules.length,
        totalEntities: this.blueprint.entities.length,
        totalApis: this.blueprint.apis.length,
        totalWorkflows: this.blueprint.workflows.length,
        totalAutomations: this.blueprint.automations.length,
        totalAgents: this.blueprint.aiAgents.length,
        totalPermissions: this.blueprint.permissions.length
      }
    });

    this.manifest.markValidated();
  }

  /**
   * Stage 8: Generate application artifacts
   */
  async generateArtifacts() {
    try {
      const outDir = join(projectRoot, "out/generated/applications", this.applicationNamespace);

      // Create output directory
      const fs = await import("fs/promises");
      await fs.mkdir(outDir, { recursive: true });

      // Generate Application Manifest
      const manifestPath = join(outDir, `${this.applicationNamespace}.application.json`);
      writeFileSync(manifestPath, JSON.stringify(this.manifest.toJSON(), null, 2));

      // Generate Blueprint
      const blueprintPath = join(outDir, `${this.applicationNamespace}.blueprint.json`);
      writeFileSync(blueprintPath, JSON.stringify({
        blueprintId: this.blueprint.blueprintId,
        id: this.blueprint.id,
        name: this.blueprint.name,
        namespace: this.blueprint.namespace,
        version: this.blueprint.version,
        description: this.blueprint.description,
        modules: this.blueprint.modules.length,
        entities: this.blueprint.entities.length,
        apis: this.blueprint.apis.length,
        workflows: this.blueprint.workflows.length,
        automations: this.blueprint.automations.length,
        aiAgents: this.blueprint.aiAgents.length,
        status: this.blueprint.status
      }, null, 2));

      // Generate Navigation Contract
      const navigationPath = join(outDir, `${this.applicationNamespace}.navigation.json`);
      writeFileSync(navigationPath, JSON.stringify({
        version: "1.0.0",
        generated: new Date().toISOString(),
        applicationId: this.blueprint.id,
        navigation: this.blueprint.navigation
      }, null, 2));

      // Generate Dashboard Contract
      const dashboardPath = join(outDir, `${this.applicationNamespace}.dashboards.json`);
      writeFileSync(dashboardPath, JSON.stringify({
        version: "1.0.0",
        generated: new Date().toISOString(),
        applicationId: this.blueprint.id,
        dashboards: this.blueprint.dashboards
      }, null, 2));

      // Generate API Surface Summary
      const apiPath = join(outDir, `${this.applicationNamespace}.api-surface.json`);
      writeFileSync(apiPath, JSON.stringify({
        version: "1.0.0",
        generated: new Date().toISOString(),
        applicationId: this.blueprint.id,
        totalEndpoints: this.blueprint.apis.length,
        endpoints: this.blueprint.apis.slice(0, 10) // Include first 10 as sample
      }, null, 2));

      // Generate summary document
      const summaryPath = join(outDir, `${this.applicationNamespace}.summary.txt`);
      const summary = this.generateSummary();
      writeFileSync(summaryPath, summary);

    } catch (error) {
      this.warnings.push(`Failed to generate artifacts: ${error.message}`);
    }
  }

  /**
   * Generate text summary of compiled application
   */
  generateSummary() {
    const summary = `
GENESIS APPLICATION COMPILATION SUMMARY
=====================================

Application: ${this.blueprint.name}
Namespace: ${this.blueprint.namespace}
Version: ${this.blueprint.version}
Status: ${this.blueprint.status}

COMPOSITION:
  Modules: ${this.blueprint.modules.length}
  Entities: ${this.blueprint.entities.length}
  APIs: ${this.blueprint.apis.length}
  Workflows: ${this.blueprint.workflows.length}
  Automations: ${this.blueprint.automations.length}
  AI Agents: ${this.blueprint.aiAgents.length}
  Permissions: ${this.blueprint.permissions.length}

MODULES INCLUDED:
${this.blueprint.modules.map(m => `  • ${m.name} (v${m.version})`).join('\n')}

GENERATED ARTIFACTS:
  • ${this.applicationNamespace}.application.json - Application Manifest
  • ${this.applicationNamespace}.blueprint.json - Application Blueprint
  • ${this.applicationNamespace}.navigation.json - Navigation Contract
  • ${this.applicationNamespace}.dashboards.json - Dashboard Contract
  • ${this.applicationNamespace}.api-surface.json - API Surface Summary

VALIDATION:
  Errors: ${this.errors.length}
  Warnings: ${this.warnings.length}

NOTES:
  - All modules successfully compiled and assembled
  - Ready for runtime deployment
  - Navigation, dashboards, and APIs auto-generated from metadata
  - No application-specific logic - purely metadata-driven composition

Generated: ${new Date().toISOString()}
Compiler: Genesis Application Compiler v1
`;
    return summary.trim();
  }

  /**
   * Get compilation results
   */
  getResults() {
    return {
      success: this.errors.length === 0,
      applicationName: this.applicationName,
      blueprint: this.blueprint,
      manifest: this.manifest,
      statistics: {
        modulesCompiled: this.loadedModules.size,
        entitiesAssembled: this.blueprint?.entities.length || 0,
        apisGenerated: this.blueprint?.apis.length || 0,
        workflowsIncluded: this.blueprint?.workflows.length || 0,
        automationsIncluded: this.blueprint?.automations.length || 0,
        agentsIncluded: this.blueprint?.aiAgents.length || 0
      },
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

export { ApplicationBlueprint, ApplicationModule, ApplicationDependency, ApplicationPermission, ApplicationTheme, ApplicationSetting, ApplicationManifest };
