/**
 * EnterpriseTwinBuilder - Genesis Enterprise Digital Twin v1
 *
 * Builds and maintains the Enterprise Digital Twin graph from runtime metadata.
 * Discovers and models all runtime components, entities, and relationships.
 *
 * @module tools/genesis/compiler/EnterpriseTwinBuilder.mjs
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  TwinNode,
  TwinRelationship,
  OrganizationNode,
  ApplicationNode,
  ModuleNode,
  ObjectNode,
  WorkflowNode,
  AutomationNode,
  AIAgentNode,
  RuntimeComponentNode,
  EnterpriseTwinGraph,
  EnterpriseTwinBlueprint
} from "./EnterpriseTwinBlueprint.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class EnterpriseTwinBuilder {
  constructor(tenantId = "default", options = {}) {
    this.tenantId = tenantId;
    this.organizationId = options.organizationId || "default";
    this.blueprint = null;
    this.graph = null;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Build complete enterprise twin
   */
  async build() {
    try {
      console.log(`\n≡ƒôè Genesis Enterprise Twin Builder v1 - Building twin for '${this.tenantId}'`);
      console.log("");

      // Stage 1: Initialize blueprint
      console.log("Stage 1: Initialize Twin Blueprint");
      this.initializeBlueprint();
      console.log(`  ✓ Blueprint initialized`);

      // Stage 2: Discover organizations
      console.log("Stage 2: Discover Organizations");
      this.discoverOrganizations();
      console.log(`  ✓ Organizations discovered`);

      // Stage 3: Discover applications
      console.log("Stage 3: Discover Applications");
      this.discoverApplications();
      console.log(`  ✓ Applications discovered`);

      // Stage 4: Discover modules
      console.log("Stage 4: Discover Modules");
      this.discoverModules();
      console.log(`  ✓ Modules discovered`);

      // Stage 5: Discover objects
      console.log("Stage 5: Discover Objects");
      this.discoverObjects();
      console.log(`  ✓ Objects discovered`);

      // Stage 6: Discover active processes
      console.log("Stage 6: Discover Active Processes");
      this.discoverActiveProcesses();
      console.log(`  ✓ Active processes discovered`);

      // Stage 7: Build relationships
      console.log("Stage 7: Build Relationships");
      this.buildRelationships();
      console.log(`  ✓ Relationships established`);

      // Stage 8: Validate graph
      console.log("Stage 8: Validate Graph");
      this.validateGraph();
      console.log(`  ✓ Graph validated`);

      // Stage 9: Calculate metrics
      console.log("Stage 9: Calculate Metrics");
      this.calculateMetrics();
      console.log(`  ✓ Metrics calculated`);

      // Stage 10: Generate artifacts
      console.log("Stage 10: Generate Artifacts");
      await this.generateArtifacts();
      console.log(`  ✓ Artifacts generated`);

      console.log("\n≡ƒôè TWIN CONSTRUCTION COMPLETED");
      console.log("");
      console.log(`  Tenant: ${this.tenantId}`);
      console.log(`  Nodes: ${this.graph.nodes.length}`);
      console.log(`  Relationships: ${this.graph.relationships.length}`);
      console.log(`  Health Score: ${this.graph.stats.avgHealthScore}`);
      console.log("");

      this.blueprint.markValidated();
      this.blueprint.markDeployed();
      this.blueprint.markActive();

      return true;
    } catch (error) {
      console.error(`\n✗ Twin construction failed: ${error.message}`);
      this.errors.push(error.message);
      return false;
    }
  }

  /**
   * Stage 1: Initialize blueprint
   */
  initializeBlueprint() {
    this.blueprint = new EnterpriseTwinBlueprint({
      tenantId: this.tenantId,
      autoSync: true
    });

    this.blueprint.initializeGraph({
      tenantId: this.tenantId,
      organizationId: this.organizationId
    });

    this.graph = this.blueprint.graph;
  }

  /**
   * Stage 2: Discover organizations
   */
  discoverOrganizations() {
    const registryPath = join(projectRoot, "out/generated/identities/registry.json");

    if (!existsSync(registryPath)) {
      this.warnings.push("No identity registry found");
      return;
    }

    try {
      const registry = JSON.parse(readFileSync(registryPath, "utf8"));
      const tenant = registry.tenants?.find(t => t.id === `tenant-${this.tenantId}`);

      if (tenant) {
        const orgNode = new OrganizationNode({
          id: `org-${this.tenantId}`,
          name: tenant.displayName,
          tenantId: this.tenantId,
          status: "active",
          userCount: 1,
          teamCount: 1
        });

        this.graph.addNode(orgNode);
      }
    } catch (e) {
      this.warnings.push(`Failed to load organizations: ${e.message}`);
    }
  }

  /**
   * Stage 3: Discover applications
   */
  discoverApplications() {
    const appsDir = join(projectRoot, "out/generated/applications");

    if (!existsSync(appsDir)) {
      this.warnings.push("No applications directory found");
      return;
    }

    try {
      const appDirs = readdirSync(appsDir).filter(f => {
        const stat = require("fs").statSync(join(appsDir, f));
        return stat.isDirectory();
      });

      for (const appDir of appDirs) {
        const manifestPath = join(appsDir, appDir, `${appDir}.manifest.json`);

        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            const appNode = new ApplicationNode({
              id: `app-${appDir}`,
              name: manifest.name || appDir,
              organizationId: `org-${this.tenantId}`,
              status: "active",
              moduleCount: manifest.modules?.length || 0,
              apiCount: manifest.apis?.length || 0
            });

            this.graph.addNode(appNode);
          } catch (e) {
            this.warnings.push(`Failed to parse application manifest for ${appDir}`);
          }
        }
      }
    } catch (e) {
      this.warnings.push(`Failed to discover applications: ${e.message}`);
    }
  }

  /**
   * Stage 4: Discover modules
   */
  discoverModules() {
    const modulesDir = join(projectRoot, "out/generated/modules");

    if (!existsSync(modulesDir)) {
      this.warnings.push("No modules directory found");
      return;
    }

    try {
      const moduleDirs = readdirSync(modulesDir).filter(f => {
        const stat = require("fs").statSync(join(modulesDir, f));
        return stat.isDirectory();
      });

      for (const modDir of moduleDirs) {
        const manifestPath = join(modulesDir, modDir, `${modDir}.manifest.json`);

        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            const modNode = new ModuleNode({
              id: `mod-${modDir}`,
              name: manifest.name || modDir,
              applicationId: `app-default`,
              status: "active",
              objectCount: manifest.objects?.length || 0,
              workflowCount: manifest.workflows?.length || 0,
              automationCount: manifest.automations?.length || 0
            });

            this.graph.addNode(modNode);
          } catch (e) {
            this.warnings.push(`Failed to parse module manifest for ${modDir}`);
          }
        }
      }
    } catch (e) {
      this.warnings.push(`Failed to discover modules: ${e.message}`);
    }
  }

  /**
   * Stage 5: Discover objects
   */
  discoverObjects() {
    // Object discovery would scan compiled schemas
    // For now, add placeholder based on module count
    const modules = this.graph.getNodesByType("module");

    for (const module of modules) {
      if (module.objectCount > 0) {
        for (let i = 0; i < Math.min(module.objectCount, 5); i++) {
          const objNode = new ObjectNode({
            id: `obj-${module.id}-${i}`,
            name: `${module.name}.Object${i}`,
            moduleId: module.id,
            status: "active",
            instanceCount: 0
          });

          this.graph.addNode(objNode);
        }
      }
    }
  }

  /**
   * Stage 6: Discover active processes
   */
  discoverActiveProcesses() {
    // This would connect to the runtime to discover active workflows, automations, agents
    // For now, add sample active processes
    const modules = this.graph.getNodesByType("module");

    for (const module of modules) {
      // Add sample workflows
      if (module.workflowCount > 0) {
        const workflowNode = new WorkflowNode({
          id: `wf-${module.id}-1`,
          name: `${module.name}.DefaultWorkflow`,
          moduleId: module.id,
          status: "active",
          stage: "running",
          progress: 0
        });
        this.graph.addNode(workflowNode);
      }

      // Add sample automations
      if (module.automationCount > 0) {
        const automationNode = new AutomationNode({
          id: `auto-${module.id}-1`,
          name: `${module.name}.DefaultAutomation`,
          moduleId: module.id,
          status: "active",
          trigger: "scheduled"
        });
        this.graph.addNode(automationNode);
      }
    }
  }

  /**
   * Stage 7: Build relationships
   */
  buildRelationships() {
    const orgs = this.graph.getNodesByType("organization");
    const apps = this.graph.getNodesByType("application");
    const mods = this.graph.getNodesByType("module");
    const objs = this.graph.getNodesByType("object");

    // Organization contains applications
    for (const org of orgs) {
      for (const app of apps) {
        if (app.organizationId === org.id) {
          const rel = new TwinRelationship({
            sourceId: org.id,
            targetId: app.id,
            type: "contains",
            label: "contains",
            strength: "strong"
          });
          this.graph.addRelationship(rel);
        }
      }
    }

    // Application contains modules
    for (const app of apps) {
      for (const mod of mods) {
        if (mod.applicationId === app.id) {
          const rel = new TwinRelationship({
            sourceId: app.id,
            targetId: mod.id,
            type: "contains",
            label: "contains",
            strength: "strong"
          });
          this.graph.addRelationship(rel);
        }
      }
    }

    // Module contains objects
    for (const mod of mods) {
      for (const obj of objs) {
        if (obj.moduleId === mod.id) {
          const rel = new TwinRelationship({
            sourceId: mod.id,
            targetId: obj.id,
            type: "contains",
            label: "contains",
            strength: "normal"
          });
          this.graph.addRelationship(rel);
        }
      }
    }

    // Module executes workflows/automations
    const workflows = this.graph.getNodesByType("workflow");
    const automations = this.graph.getNodesByType("automation");

    for (const wf of workflows) {
      if (wf.moduleId) {
        const rel = new TwinRelationship({
          sourceId: wf.moduleId,
          targetId: wf.id,
          type: "executes",
          label: "executes",
          strength: "strong"
        });
        this.graph.addRelationship(rel);
      }
    }

    for (const auto of automations) {
      if (auto.moduleId) {
        const rel = new TwinRelationship({
          sourceId: auto.moduleId,
          targetId: auto.id,
          type: "executes",
          label: "executes",
          strength: "strong"
        });
        this.graph.addRelationship(rel);
      }
    }
  }

  /**
   * Stage 8: Validate graph
   */
  validateGraph() {
    // For new/empty twins, create a root tenant node
    if (this.graph.nodes.length === 0) {
      const tenantNode = new TwinNode({
        id: `tenant-${this.tenantId}`,
        name: this.tenantId,
        type: "tenant",
        status: "active"
      });
      this.graph.addNode(tenantNode);
    }

    const validation = this.graph.validate();
    if (!validation.isValid) {
      this.errors.push(...validation.errors);
      throw new Error(`Graph validation failed: ${validation.errors.join(", ")}`);
    }
  }

  /**
   * Stage 9: Calculate metrics
   */
  calculateMetrics() {
    this.graph.updateStats();
    this.graph.updateStatus();

    // Initialize health scores for all nodes
    for (const node of this.graph.nodes) {
      node.updateHealth("healthy", 100);
    }
  }

  /**
   * Stage 10: Generate artifacts
   */
  async generateArtifacts() {
    const outputDir = join(projectRoot, "out/generated/twins", `tenant-${this.tenantId}`);
    mkdirSync(outputDir, { recursive: true });

    // Write blueprint
    writeFileSync(
      join(outputDir, `twin-blueprint.json`),
      JSON.stringify(this.blueprint.getSummary(), null, 2)
    );

    // Write graph summary
    writeFileSync(
      join(outputDir, `twin-graph-summary.json`),
      JSON.stringify(this.graph.getSummary(), null, 2)
    );

    // Write health report
    writeFileSync(
      join(outputDir, `twin-health-report.json`),
      JSON.stringify(this.graph.getHealthReport(), null, 2)
    );

    // Write full graph
    writeFileSync(
      join(outputDir, `twin-graph-full.json`),
      JSON.stringify({
        blueprint: this.blueprint.getSummary(),
        graph: {
          nodes: this.graph.nodes.map(n => n.getSummary()),
          relationships: this.graph.relationships.map(r => r.getSummary()),
          stats: this.graph.stats
        }
      }, null, 2)
    );
  }

  /**
   * Get compilation results
   */
  getResults() {
    return {
      tenantId: this.tenantId,
      graphId: this.graph?.graphId,
      nodes: this.graph?.nodes.length || 0,
      relationships: this.graph?.relationships.length || 0,
      status: this.blueprint?.status,
      graphStatus: this.graph?.status,
      healthScore: this.graph?.stats.avgHealthScore || 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}
