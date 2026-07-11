/**
 * SolutionBlueprintContract - Genesis Solution Blueprint v1
 *
 * Canonical Intermediate Representation (IR) for complete enterprise solutions.
 * Solutions are composed of multiple compiled applications that share:
 * - Navigation structure
 * - API surface
 * - AI agents
 * - Permissions
 * - Branding
 * - Integrations
 *
 * @module tools/genesis/compiler/SolutionBlueprintContract.mjs
 */

import { randomBytes } from "crypto";

/**
 * SolutionApplication
 * Reference to a compiled application in a solution
 */
export class SolutionApplication {
  constructor(data = {}) {
    this.id = `app-${data.name?.toLowerCase() || 'app'}`;
    this.name = data.name || "";
    this.namespace = data.namespace || data.name?.toLowerCase() || "";
    this.version = data.version || "1.0.0";
    this.description = data.description || "";
    this.enabled = data.enabled !== false;
    this.priority = data.priority || 0;
    this.modules = data.modules || [];
    this.apis = data.apis || [];
    this.workflows = data.workflows || [];
    this.automations = data.automations || [];
    this.dashboards = data.dashboards || [];
    this.agents = data.agents || [];
    this.navigation = data.navigation || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push("Application name is required");
    if (!this.namespace) errors.push("Application namespace is required");
    if (!this.version) errors.push("Application version is required");

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * SharedModule
 * Module shared across multiple applications in a solution
 */
export class SharedModule {
  constructor(data = {}) {
    this.name = data.name || "";
    this.namespace = data.namespace || data.name?.toLowerCase() || "";
    this.version = data.version || "1.0.0";
    this.description = data.description || "";
    this.applications = data.applications || [];
    this.entities = data.entities || [];
    this.apis = data.apis || [];
    this.shared = data.shared !== false;
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Module name is required");
    if (!this.namespace) errors.push("Module namespace is required");
    if (this.applications.length === 0) {
      errors.push("Shared module must be used by at least one application");
    }
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * SharedNavigation
 * Merged navigation structure from all applications
 */
export class SharedNavigation {
  constructor(data = {}) {
    this.id = `nav-${randomBytes(8).toString("hex")}`;
    this.main = data.main || [];
    this.admin = data.admin || [];
    this.dashboards = data.dashboards || [];
    this.reports = data.reports || [];
    this.settings = data.settings || [];
    this.custom = data.custom || {};
  }

  merge(navData) {
    if (navData.main) this.main.push(...navData.main);
    if (navData.admin) this.admin.push(...navData.admin);
    if (navData.dashboards) this.dashboards.push(...navData.dashboards);
    if (navData.reports) this.reports.push(...navData.reports);
    if (navData.settings) this.settings.push(...navData.settings);
    if (navData.custom) Object.assign(this.custom, navData.custom);
  }

  validate() {
    return {
      isValid: true,
      errors: []
    };
  }
}

/**
 * SharedAPI
 * API endpoints shared across the solution
 */
export class SharedAPI {
  constructor(data = {}) {
    this.id = `api-${randomBytes(8).toString("hex")}`;
    this.method = data.method || "GET";
    this.path = data.path || "";
    this.operation = data.operation || "";
    this.module = data.module || "";
    this.applications = data.applications || [];
    this.description = data.description || "";
    this.shared = data.applications?.length > 1;
  }

  validate() {
    const errors = [];
    if (!this.method) errors.push("API method is required");
    if (!this.path) errors.push("API path is required");
    if (!this.operation) errors.push("API operation is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * SharedAgent
 * AI agent available across the solution
 */
export class SharedAgent {
  constructor(data = {}) {
    this.id = `agent-${randomBytes(8).toString("hex")}`;
    this.name = data.name || "";
    this.type = data.type || "assistant";
    this.module = data.module || "";
    this.applications = data.applications || [];
    this.description = data.description || "";
    this.model = data.model || "gpt-4";
    this.shared = data.applications?.length > 1;
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Agent name is required");
    if (!this.type) errors.push("Agent type is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * GlobalPermission
 * Solution-wide permission
 */
export class GlobalPermission {
  constructor(data = {}) {
    this.id = `perm-${randomBytes(8).toString("hex")}`;
    this.name = data.name || "";
    this.resource = data.resource || "";
    this.actions = data.actions || [];
    this.roles = data.roles || [];
    this.scope = data.scope || "solution"; // solution, application, module
    this.conditions = data.conditions || [];
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Permission name is required");
    if (!this.resource) errors.push("Permission resource is required");
    if (!Array.isArray(this.actions) || this.actions.length === 0) {
      errors.push("Permission must have at least one action");
    }
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * SolutionBranding
 * Solution branding and theming
 */
export class SolutionBranding {
  constructor(data = {}) {
    this.id = `brand-${randomBytes(8).toString("hex")}`;
    this.name = data.name || "Default";
    this.logo = data.logo || "";
    this.favicon = data.favicon || "";
    this.companyName = data.companyName || "";
    this.companyUrl = data.companyUrl || "";
    this.supportEmail = data.supportEmail || "";
    this.theme = data.theme || {};
    this.colors = {
      primary: data.colors?.primary || "#007AFF",
      secondary: data.colors?.secondary || "#5AC8FA",
      success: data.colors?.success || "#34C759",
      danger: data.colors?.danger || "#FF3B30",
      warning: data.colors?.warning || "#FF9500",
      info: data.colors?.info || "#00C7FD"
    };
  }

  validate() {
    const errors = [];
    const colorPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const [colorKey, colorValue] of Object.entries(this.colors)) {
      if (!colorPattern.test(colorValue)) {
        errors.push(`Invalid color format for ${colorKey}: ${colorValue}`);
      }
    }
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * SolutionIntegration
 * External system integration
 */
export class SolutionIntegration {
  constructor(data = {}) {
    this.id = `int-${randomBytes(8).toString("hex")}`;
    this.name = data.name || "";
    this.type = data.type || ""; // crm, erp, billing, analytics, etc.
    this.enabled = data.enabled !== false;
    this.endpoint = data.endpoint || "";
    this.apiKey = data.apiKey || ""; // typically encrypted in practice
    this.applications = data.applications || [];
    this.config = data.config || {};
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push("Integration name is required");
    if (!this.type) errors.push("Integration type is required");
    if (!this.endpoint) errors.push("Integration endpoint is required");
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * SolutionBlueprint
 * Canonical Intermediate Representation for enterprise solutions
 */
export class SolutionBlueprint {
  constructor(data = {}) {
    this.blueprintId = `blueprint-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.id = data.id || `solution-${data.name?.toLowerCase() || 'solution'}`;
    this.name = data.name || "";
    this.namespace = data.namespace || data.name?.toLowerCase() || "";
    this.version = data.version || "1.0.0";
    this.description = data.description || "";
    this.status = "draft"; // draft, validated, compiled, deployed

    // Composition
    this.applications = [];
    this.sharedModules = [];
    this.entities = [];
    this.apis = [];
    this.workflows = [];
    this.automations = [];
    this.aiAgents = [];
    this.dashboards = [];

    // Aggregation
    this.sharedNavigation = new SharedNavigation();
    this.globalPermissions = [];
    this.branding = new SolutionBranding(data.branding);
    this.integrations = [];

    // Metadata
    this.owner = data.owner || "Genesis";
    this.createdAt = new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Validate the blueprint
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.id) errors.push("Solution ID is required");
    if (!this.name) errors.push("Solution name is required");
    if (!this.namespace) errors.push("Solution namespace is required");
    if (this.applications.length === 0) {
      errors.push("Solution must contain at least one application");
    }

    for (const app of this.applications) {
      const appValidation = app.validate();
      if (!appValidation.isValid) {
        errors.push(...appValidation.errors);
      }
    }

    for (const perm of this.globalPermissions) {
      const permValidation = perm.validate();
      if (!permValidation.isValid) {
        errors.push(...permValidation.errors);
      }
    }

    const brandValidation = this.branding.validate();
    if (!brandValidation.isValid) {
      errors.push(...brandValidation.errors);
    }

    for (const integration of this.integrations) {
      const intValidation = integration.validate();
      if (!intValidation.isValid) {
        errors.push(...intValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Mark as validated
   */
  markValidated() {
    if (this.status === "draft") {
      this.status = "validated";
    }
  }

  /**
   * Mark as compiled
   */
  markCompiled() {
    if (this.status === "validated") {
      this.status = "compiled";
    }
  }

  /**
   * Mark as deployed
   */
  markDeployed() {
    if (this.status === "compiled") {
      this.status = "deployed";
    }
  }

  /**
   * Get blueprint summary
   */
  getSummary() {
    return {
      blueprintId: this.blueprintId,
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      version: this.version,
      status: this.status,
      applicationsCount: this.applications.length,
      entitiesCount: this.entities.length,
      apisCount: this.apis.length,
      workflowsCount: this.workflows.length,
      automationsCount: this.automations.length,
      agentsCount: this.aiAgents.length,
      permissionsCount: this.globalPermissions.length,
      integrationsCount: this.integrations.length
    };
  }
}

/**
 * SolutionManifest
 * Runtime manifest for deployed solution
 */
export class SolutionManifest {
  constructor(data = {}) {
    this.manifestId = `manifest-${Date.now()}-${randomBytes(4).toString("hex")}`;
    this.version = "1.0.0";
    this.generatedAt = new Date().toISOString();
    this.status = "generated";

    // Solution identification
    this.solution = data.solution || {
      id: "",
      name: "",
      namespace: "",
      version: ""
    };

    // Blueprint reference
    this.blueprint = data.blueprint || null;

    // All aggregated content
    this.applications = data.applications || [];
    this.modules = data.modules || [];
    this.entities = data.entities || [];
    this.apis = data.apis || [];
    this.workflows = data.workflows || [];
    this.automations = data.automations || [];
    this.aiAgents = data.aiAgents || [];
    this.dashboards = data.dashboards || [];
    this.navigation = data.navigation || {};
    this.permissions = data.permissions || [];
    this.branding = data.branding || {};
    this.integrations = data.integrations || [];

    // Statistics
    this.statistics = data.statistics || {
      totalApplications: 0,
      totalModules: 0,
      totalEntities: 0,
      totalApis: 0,
      totalWorkflows: 0,
      totalAutomations: 0,
      totalAgents: 0,
      totalPermissions: 0,
      totalIntegrations: 0
    };

    // Metadata
    this.metadata = data.metadata || {};
  }

  /**
   * Validate the manifest
   */
  validate() {
    const errors = [];

    if (!this.solution?.id) errors.push("Solution ID is required");
    if (!this.solution?.name) errors.push("Solution name is required");
    if (this.applications.length === 0) errors.push("At least one application is required");

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Mark as validated
   */
  markValidated() {
    this.status = "validated";
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      manifestId: this.manifestId,
      version: this.version,
      generatedAt: this.generatedAt,
      status: this.status,
      solution: this.solution,
      applications: this.applications.length,
      modules: this.modules.length,
      entities: this.entities.length,
      apis: this.apis.length,
      workflows: this.workflows.length,
      automations: this.automations.length,
      aiAgents: this.aiAgents.length,
      dashboards: this.dashboards.length,
      permissions: this.permissions.length,
      integrations: this.integrations.length,
      statistics: this.statistics
    };
  }
}
