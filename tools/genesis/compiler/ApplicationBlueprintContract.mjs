/**
 * ApplicationBlueprintContract - Genesis Application Blueprint v1
 *
 * Canonical Intermediate Representation (IR) for enterprise applications:
 * - ApplicationBlueprint: Complete application definition and metadata
 * - ApplicationModule: Reference to compiled module with configuration
 * - ApplicationDependency: Module dependency definition
 * - ApplicationPermission: Permission definition for application
 * - ApplicationTheme: Theme configuration
 * - ApplicationSetting: Application setting
 * - ApplicationManifest: Generated runtime manifest
 *
 * @module tools/genesis/compiler/ApplicationBlueprintContract.mjs
 */

/**
 * ApplicationModule - Reference to a compiled module in the application
 */
export class ApplicationModule {
  constructor(data = {}) {
    this.moduleId = data.moduleId || `mod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name || '';
    this.namespace = data.namespace || '';
    this.version = data.version || '1.0.0';
    this.description = data.description || '';
    this.enabled = data.enabled !== false; // default true
    this.priority = data.priority || 0;
    this.config = data.config || {};
    this.dependencies = data.dependencies || [];
    this.entities = data.entities || [];
    this.apis = data.apis || [];
    this.workflows = data.workflows || [];
    this.automations = data.automations || [];
    this.dashboards = data.dashboards || [];
    this.agents = data.agents || [];
    this.navigation = data.navigation || {};
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push('Module name is required');
    if (!this.namespace) errors.push('Module namespace is required');
    if (!this.version) warnings.push('Module version not specified');

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * ApplicationDependency - Module dependency definition
 */
export class ApplicationDependency {
  constructor(data = {}) {
    this.dependencyId = data.dependencyId || `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.moduleName = data.moduleName || '';
    this.requiredVersion = data.requiredVersion || '1.0.0';
    this.type = data.type || 'required'; // required, optional
    this.metadata = data.metadata || {};
  }

  isSatisfied(availableVersion) {
    // Simple version check - in production would use semver
    return availableVersion >= this.requiredVersion;
  }
}

/**
 * ApplicationPermission - Permission definition for application
 */
export class ApplicationPermission {
  constructor(data = {}) {
    this.permissionId = data.permissionId || `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name || '';
    this.description = data.description || '';
    this.resource = data.resource || '';
    this.actions = data.actions || []; // read, create, update, delete
    this.roles = data.roles || [];
    this.conditions = data.conditions || {};
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push('Permission name is required');
    if (!this.resource) errors.push('Resource is required');
    if (!this.actions || this.actions.length === 0) warnings.push('No actions specified');

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * ApplicationTheme - Theme configuration for application UI
 */
export class ApplicationTheme {
  constructor(data = {}) {
    this.themeId = data.themeId || `theme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name || 'default';
    this.primaryColor = data.primaryColor || '#007AFF';
    this.secondaryColor = data.secondaryColor || '#5AC8FA';
    this.backgroundColor = data.backgroundColor || '#FFFFFF';
    this.textColor = data.textColor || '#000000';
    this.accentColor = data.accentColor || '#FF2D55';
    this.fontFamily = data.fontFamily || 'system-ui, sans-serif';
    this.borderRadius = data.borderRadius || '4px';
    this.shadowDepth = data.shadowDepth || 2;
    this.customVariables = data.customVariables || {};
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) warnings.push('Theme name not specified');
    
    // Validate colors are valid hex
    const colorFields = ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor', 'accentColor'];
    for (const field of colorFields) {
      if (this[field] && !/^#[0-9A-Fa-f]{6}$/.test(this[field])) {
        errors.push(`Invalid color format for ${field}: ${this[field]}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * ApplicationSetting - Application setting
 */
export class ApplicationSetting {
  constructor(data = {}) {
    this.settingId = data.settingId || `setting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.key = data.key || '';
    this.value = data.value || null;
    this.type = data.type || 'string'; // string, number, boolean, object
    this.description = data.description || '';
    this.required = data.required || false;
    this.defaultValue = data.defaultValue || null;
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.key) errors.push('Setting key is required');

    // Validate type matches value
    if (this.value) {
      const actualType = typeof this.value;
      if (this.type === 'string' && actualType !== 'string') {
        errors.push(`Setting ${this.key} should be string, got ${actualType}`);
      } else if (this.type === 'number' && actualType !== 'number') {
        errors.push(`Setting ${this.key} should be number, got ${actualType}`);
      } else if (this.type === 'boolean' && actualType !== 'boolean') {
        errors.push(`Setting ${this.key} should be boolean, got ${actualType}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

/**
 * ApplicationBlueprint - Canonical IR for enterprise applications
 */
export class ApplicationBlueprint {
  constructor(data = {}) {
    this.blueprintId = data.blueprintId || `blueprint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.id = data.id || '';
    this.name = data.name || '';
    this.namespace = data.namespace || '';
    this.version = data.version || '1.0.0';
    this.description = data.description || '';
    this.owner = data.owner || 'Genesis';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();

    // Component assembly
    this.modules = data.modules || []; // ApplicationModule[]
    this.dependencies = data.dependencies || []; // ApplicationDependency[]
    this.permissions = data.permissions || []; // ApplicationPermission[]
    this.theme = data.theme || new ApplicationTheme();
    this.settings = data.settings || []; // ApplicationSetting[]

    // Aggregated artifacts
    this.navigation = data.navigation || {};
    this.dashboards = data.dashboards || [];
    this.apis = data.apis || [];
    this.workflows = data.workflows || [];
    this.automations = data.automations || [];
    this.aiAgents = data.aiAgents || [];
    this.entities = data.entities || [];

    // Metadata
    this.metadata = data.metadata || {};
    this.status = data.status || 'draft'; // draft, validated, compiled, deployed
    this.validationResults = data.validationResults || null;
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.id) errors.push('Application ID is required');
    if (!this.name) errors.push('Application name is required');
    if (!this.namespace) errors.push('Application namespace is required');
    if (!this.version) warnings.push('Application version not specified');

    if (this.modules.length === 0) {
      warnings.push('No modules specified');
    }

    // Validate all modules
    for (const module of this.modules) {
      const moduleValidation = module.validate();
      if (!moduleValidation.isValid) {
        errors.push(...moduleValidation.errors);
      }
      warnings.push(...moduleValidation.warnings);
    }

    // Validate all permissions
    for (const perm of this.permissions) {
      const permValidation = perm.validate();
      if (!permValidation.isValid) {
        errors.push(...permValidation.errors);
      }
      warnings.push(...permValidation.warnings);
    }

    // Validate theme
    if (this.theme) {
      const themeValidation = this.theme.validate();
      if (!themeValidation.isValid) {
        errors.push(...themeValidation.errors);
      }
      warnings.push(...themeValidation.warnings);
    }

    // Validate all settings
    for (const setting of this.settings) {
      const settingValidation = setting.validate();
      if (!settingValidation.isValid) {
        errors.push(...settingValidation.errors);
      }
      warnings.push(...settingValidation.warnings);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  markValidated() {
    this.status = 'validated';
    this.validationResults = this.validate();
  }

  markCompiled() {
    this.status = 'compiled';
  }

  markDeployed() {
    this.status = 'deployed';
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      version: this.version,
      status: this.status,
      modulesCount: this.modules.length,
      entitiesCount: this.entities.length,
      apisCount: this.apis.length,
      workflowsCount: this.workflows.length,
      automationsCount: this.automations.length,
      aiAgentsCount: this.aiAgents.length,
      permissionsCount: this.permissions.length
    };
  }
}

/**
 * ApplicationManifest - Runtime manifest for deployed application
 */
export class ApplicationManifest {
  constructor(data = {}) {
    this.manifestId = data.manifestId || `manifest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.version = data.version || '1.0.0';
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.generatedBy = data.generatedBy || 'ApplicationCompiler';

    // Application info
    this.application = data.application || {};
    this.blueprint = data.blueprint || null;

    // Compiled artifacts
    this.modules = data.modules || [];
    this.entities = data.entities || [];
    this.apis = data.apis || [];
    this.workflows = data.workflows || [];
    this.automations = data.automations || [];
    this.aiAgents = data.aiAgents || [];
    this.navigation = data.navigation || {};
    this.dashboards = data.dashboards || [];

    // Runtime info
    this.permissions = data.permissions || [];
    this.theme = data.theme || {};
    this.settings = data.settings || {};

    // Statistics
    this.statistics = data.statistics || {
      totalModules: 0,
      totalEntities: 0,
      totalApis: 0,
      totalWorkflows: 0,
      totalAutomations: 0,
      totalAgents: 0,
      totalPermissions: 0
    };

    // Status
    this.status = data.status || 'generated';
    this.validationResults = data.validationResults || null;
  }

  validate() {
    const errors = [];
    const warnings = [];

    if (!this.application || !this.application.id) {
      errors.push('Application information is required');
    }

    if (!this.blueprint) {
      warnings.push('Blueprint reference not provided');
    }

    if (this.modules.length === 0) {
      warnings.push('No modules in manifest');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  markValidated() {
    this.status = 'validated';
    this.validationResults = this.validate();
  }

  toJSON() {
    return {
      manifestId: this.manifestId,
      version: this.version,
      generatedAt: this.generatedAt,
      generatedBy: this.generatedBy,
      application: this.application,
      modules: this.modules,
      entities: this.entities,
      apis: this.apis,
      workflows: this.workflows,
      automations: this.automations,
      aiAgents: this.aiAgents,
      navigation: this.navigation,
      dashboards: this.dashboards,
      permissions: this.permissions,
      theme: this.theme,
      settings: this.settings,
      statistics: this.statistics,
      status: this.status
    };
  }
}
