/**
 * BlueprintBuilder
 *
 * Transforms expanded metadata into EnterpriseObjectBlueprint.
 *
 * This is the critical transformation layer that converts the outputs of
 * the metadata expanders into the canonical compiler IR format.
 *
 * @module tools/genesis/compiler/ir/BlueprintBuilder
 */

import { createBlueprint, validateBlueprint } from './EnterpriseObjectBlueprint.mjs';

/**
 * Build an EnterpriseObjectBlueprint from expanded metadata
 *
 * @param {string} entityName - Entity name (e.g., 'Customer')
 * @param {Object} rawMetadata - Raw metadata from YAML
 * @param {Array<Object>} expandedFields - Expanded field definitions
 * @param {Array<Object>} expandedRelationships - Expanded relationship definitions
 * @param {Object} expandedCapabilities - Expanded capabilities
 * @param {Object} expandedLifecycle - Expanded lifecycle
 * @param {Object} expandedEvents - Expanded events (NEW)
 * @param {Object} expandedPermissions - Expanded permissions (NEW)
 * @param {Object} expandedPolicies - Expanded policies (NEW)
 * @param {Object} expandedSearch - Expanded search configuration (NEW)
 * @param {Object} expandedIndex - Expanded index configuration (NEW)
 * @param {Object} expandedValidation - Expanded validation constraints (NEW)
 * @param {Object} expandedRules - Expanded business rules (NEW)
 * @param {Object} expandedAPI - Expanded API contracts (NEW)
 * @param {Object} expandedTests - Expanded test metadata (Phase 9 NEW)
 * @param {string} definitionPath - Path to source YAML
 * @returns {Object} EnterpriseObjectBlueprint
 */
export function buildBlueprint(
  entityName,
  rawMetadata,
  expandedFields,
  expandedRelationships,
  expandedCapabilities,
  expandedLifecycle,
  expandedEvents,
  expandedPermissions,
  expandedPolicies,
  expandedSearch,
  expandedIndex,
  expandedValidation,
  expandedRules,
  expandedAPI,
  expandedTests,
  expandedRegistration,
  expandedModule,
  definitionPath
) {
  const blueprint = createBlueprint();

  // === METADATA SECTION ===
  blueprint.metadata.entity = entityName;
  blueprint.metadata.displayName = rawMetadata.displayName || entityName;
  blueprint.metadata.pluralName = rawMetadata.pluralName || `${entityName}s`;
  blueprint.metadata.description = rawMetadata.description || `${entityName} entity`;
  blueprint.metadata.namespace = rawMetadata.metadata?.namespace || 'default';
  blueprint.metadata.tags = rawMetadata.metadata?.tags || [];
  blueprint.metadata.definitionPath = definitionPath;
  blueprint.metadata.generatedAt = new Date().toISOString();

  // === FIELDS SECTION ===
  blueprint.fields.all = expandedFields || [];
  blueprint.fields.required = blueprint.fields.all.filter(f => f.required && !f.generated);
  blueprint.fields.unique = blueprint.fields.all.filter(f => f.unique);
  blueprint.fields.generated = blueprint.fields.all.filter(f => f.generated);
  blueprint.fields.searchable = blueprint.fields.all.filter(f =>
    expandedCapabilities.searchFields && expandedCapabilities.searchFields.includes(f.name)
  );

  // === RELATIONSHIPS SECTION ===
  blueprint.relationships.all = expandedRelationships || [];
  blueprint.relationships.hasMany = blueprint.relationships.all.filter(r => r.type === 'hasMany');
  blueprint.relationships.hasOne = blueprint.relationships.all.filter(r => r.type === 'hasOne');
  blueprint.relationships.belongsTo = blueprint.relationships.all.filter(r => r.type === 'belongsTo');
  blueprint.relationships.manyToMany = blueprint.relationships.all.filter(r => r.type === 'manyToMany');
  blueprint.relationships.required = blueprint.relationships.all.filter(r => r.required);

  // === LIFECYCLE SECTION ===
  blueprint.lifecycle.states = expandedLifecycle.states || {};
  blueprint.lifecycle.transitions = expandedLifecycle.transitions || [];
  blueprint.lifecycle.initial = expandedLifecycle.initial || 'DRAFT';
  blueprint.lifecycle.softDelete = expandedLifecycle.softDelete || false;
  blueprint.lifecycle.versioning = expandedLifecycle.versioning || false;
  blueprint.lifecycle.archived = expandedLifecycle.archived || false;
  blueprint.lifecycle.timestamps = expandedLifecycle.timestamps || {
    createdAt: true,
    updatedAt: true,
    deletedAt: false,
    archivedAt: false,
  };

  // === EVENTS SECTION (NEW) ===
  blueprint.events.all = expandedEvents?.all || [];
  blueprint.events.lifecycle = expandedEvents?.lifecycle || [];
  blueprint.events.capability = expandedEvents?.capability || [];
  blueprint.events.custom = expandedEvents?.custom || [];
  blueprint.events.byTrigger = expandedEvents?.byTrigger || {};

  // === PERMISSIONS SECTION (NEW) ===
  blueprint.permissions.enabled = expandedPermissions?.enabled || false;
  blueprint.permissions.roles = expandedPermissions?.roles || [];
  blueprint.permissions.actions = expandedPermissions?.actions || [];
  blueprint.permissions.roleActions = expandedPermissions?.roleActions || {};
  blueprint.permissions.roleDefaults = expandedPermissions?.roleDefaults || {};
  blueprint.permissions.policies = expandedPermissions?.policies || [];

  // === POLICIES SECTION (NEW) ===
  blueprint.policies.all = expandedPolicies?.all || [];
  blueprint.policies.byConditionType = expandedPolicies?.byConditionType || {};
  blueprint.policies.byAction = expandedPolicies?.byAction || {};
  blueprint.policies.byRole = expandedPolicies?.byRole || {};

  // === SEARCH SECTION (NEW) ===
  blueprint.search.enabled = expandedSearch?.enabled || false;
  blueprint.search.indexed = expandedSearch?.indexed || false;
  blueprint.search.fullText = expandedSearch?.fullText || false;
  blueprint.search.fields = expandedSearch?.fields || {
    searchable: [],
    filterable: [],
    sortable: [],
    keywordFields: [],
    exactMatchFields: [],
    dateRangeFields: [],
    numericRangeFields: [],
  };
  blueprint.search.lifecycleFilterable = expandedSearch?.lifecycleFilterable || false;
  blueprint.search.softDeleteFilterable = expandedSearch?.softDeleteFilterable || false;
  blueprint.search.relationshipSearch = expandedSearch?.relationshipSearch || [];
  blueprint.search.defaultSort = expandedSearch?.defaultSort || null;
  blueprint.search.defaultSortOrder = expandedSearch?.defaultSortOrder || 'asc';

  // === INDEX SECTION (NEW) ===
  blueprint.index.enabled = expandedIndex?.enabled || false;
  blueprint.index.indexName = expandedIndex?.indexName || '';
  blueprint.index.strategy = expandedIndex?.strategy || 'simple';
  blueprint.index.fields = expandedIndex?.fields || [];
  blueprint.index.compositeIndexes = expandedIndex?.compositeIndexes || [];
  blueprint.index.settings = expandedIndex?.settings || {
    analyzers: [],
    refreshInterval: '1s',
    numberOfShards: 1,
    numberOfReplicas: 0,
  };

  // === CAPABILITIES SECTION ===
  // Search capability
  blueprint.capabilities.search.enabled = expandedCapabilities.search === true;
  blueprint.capabilities.search.fields = expandedCapabilities.searchFields || [];

  // Audit capability
  blueprint.capabilities.audit.enabled = expandedCapabilities.audit === true;
  blueprint.capabilities.audit.trackChanges = expandedCapabilities.auditTrackChanges || false;

  // Validation capability
  blueprint.capabilities.validation.enabled = expandedCapabilities.validation === true;

  // Permissions capability
  blueprint.capabilities.permissions.enabled = expandedCapabilities.permissions === true;
  blueprint.capabilities.permissions.roles = expandedCapabilities.permissionRoles || [];

  // Events capability
  blueprint.capabilities.events.enabled = expandedCapabilities.events === true;

  // === VALIDATION SECTION (UPDATED) ===
  blueprint.validation.enabled = expandedValidation?.enabled || false;
  blueprint.validation.constraints = expandedValidation?.constraints || {
    required: [],
    type: [],
    format: [],
    range: [],
    length: [],
    enum: [],
    unique: [],
    email: [],
    relationships: [],
  };
  blueprint.validation.custom = expandedValidation?.custom || [];
  blueprint.validation.messages = expandedValidation?.messages || {};

  // === RULES SECTION (NEW) ===
  blueprint.rules.enabled = expandedRules?.enabled || false;
  blueprint.rules.rules = expandedRules?.rules || {
    crossField: [],
    lifecycle: [],
    conditional: [],
    relationship: [],
    invariant: [],
    trigger: [],
    custom: [],
  };
  blueprint.rules.byType = expandedRules?.byType || {};
  blueprint.rules.byField = expandedRules?.byField || {};
  blueprint.rules.byState = expandedRules?.byState || {};

  // === PERMISSIONS SECTION ===
  blueprint.permissions.roles = blueprint.capabilities.permissions.roles;
  blueprint.permissions.rules = buildPermissionRules(
    entityName,
    blueprint.capabilities.permissions.roles,
    blueprint.fields.all
  );
  blueprint.permissions.roleActions = buildRoleActions(blueprint.permissions.rules);

  // === API SECTION (UPDATED Phase 8) ===
  const camelCase = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  blueprint.api.enabled = expandedAPI?.enabled || false;
  blueprint.api.baseUrl = `/api/${camelCase}`;
  blueprint.api.camelCase = camelCase;
  blueprint.api.endpoints = expandedAPI?.endpoints || {};
  blueprint.api.openAPI = expandedAPI?.openAPI || {
    version: '3.1.0',
    title: `${entityName} API`,
    description: `API contracts for ${entityName} entity`,
    tags: [entityName],
    components: { schemas: {} },
  };
  blueprint.api.graphQL = expandedAPI?.graphQL || {
    type: entityName,
    queries: [],
    mutations: [],
    fields: [],
    relationships: [],
  };
  blueprint.api.rest = expandedAPI?.rest || {
    baseRoute: `/api/${camelCase}`,
    operations: [],
  };
  blueprint.api.dtos = expandedAPI?.dtos || {
    entity: null,
    createRequest: null,
    updateRequest: null,
    response: null,
  };
  blueprint.api.errorResponses = expandedAPI?.errorResponses || {};

  // === REPOSITORY SECTION ===
  blueprint.repository.supportsSoftDelete = blueprint.lifecycle.softDelete;
  blueprint.repository.tableName = camelCase;
  blueprint.repository.methods = buildRepositoryMethods(
    entityName,
    blueprint.fields.unique,
    blueprint.capabilities.search.enabled
  );

  // === SERVICE SECTION ===
  blueprint.service.requiresValidation = blueprint.capabilities.validation.enabled;
  blueprint.service.requiresAudit = blueprint.capabilities.audit.enabled;
  blueprint.service.methods = buildServiceMethods(entityName, blueprint.lifecycle);

  // === DOCUMENTATION SECTION ===
  blueprint.documentation.title = `${entityName} Entity Documentation`;
  blueprint.documentation.sections = buildDocumentationSections(blueprint);

  // === TESTS SECTION (Phase 9) ===
  blueprint.tests = expandedTests || {
    blueprint: { shape: { tests: [], description: 'Blueprint structure tests' } },
    fields: { expansion: { tests: [], description: 'Field expansion tests' }, validation: { tests: [], description: 'Field validation tests' } },
    relationships: { expansion: { tests: [], description: 'Relationship expansion tests' }, validation: { tests: [], description: 'Relationship validation tests' } },
    lifecycle: { transitions: { tests: [], description: 'Lifecycle transition tests' }, operations: { tests: [], description: 'Lifecycle operation tests' } },
    permissions: { policies: { tests: [], description: 'Permission policy tests' }, enforcement: { tests: [], description: 'Permission enforcement tests' } },
    validation: { constraints: { tests: [], description: 'Validation constraint tests' }, rules: { tests: [], description: 'Business rule tests' } },
    search: { indexing: { tests: [], description: 'Search index tests' }, queryability: { tests: [], description: 'Search queryability tests' } },
    contracts: {
      repository: { tests: [], description: 'Repository contract tests' },
      service: { tests: [], description: 'Service contract tests' },
      api: { tests: [], description: 'API contract tests' },
      validator: { tests: [], description: 'Validator contract tests' }
    },
    integration: { endToEnd: { tests: [], description: 'End-to-end tests' } }
  };

  // === REGISTRATION SECTION (Phase 10) ===
  blueprint.registration = expandedRegistration || {
    manifest: {},
    artifacts: {},
    capabilities: {},
    contracts: {},
    validation: {},
    metadata: {},
  };

  // === MODULE SECTION (Phase 11) ===
  blueprint.module = expandedModule || {
    ownership: {},
    module: {},
    boundaries: {},
    registry: {},
    integration: {},
    architecture: {},
  };

  // Validate before returning
  validateBlueprint(blueprint);

  return blueprint;
}

/**
 * Build validation rules from field definitions
 * @param {Array<Object>} fields - Field definitions
 * @returns {Array<Object>} Validation rules
 */
function buildValidationRules(fields) {
  const rules = [];

  for (const field of fields) {
    // Required rule
    if (field.required && !field.generated) {
      rules.push({
        type: 'required',
        field: field.name,
        value: true,
        message: `${field.name} is required`,
      });
    }

    // Format rule (email)
    if (field.type === 'email') {
      rules.push({
        type: 'format',
        field: field.name,
        value: 'email',
        message: `${field.name} must be a valid email`,
      });
    }

    // Unique rule
    if (field.unique) {
      rules.push({
        type: 'unique',
        field: field.name,
        value: true,
        message: `${field.name} must be unique`,
      });
    }

    // Range rules (length for strings, min/max for numbers)
    if (field.maxLength) {
      rules.push({
        type: 'range',
        field: field.name,
        value: { max: field.maxLength },
        message: `${field.name} must not exceed ${field.maxLength} characters`,
      });
    }

    if (field.minLength) {
      rules.push({
        type: 'range',
        field: field.name,
        value: { min: field.minLength },
        message: `${field.name} must be at least ${field.minLength} characters`,
      });
    }

    if (field.max !== undefined) {
      rules.push({
        type: 'range',
        field: field.name,
        value: { max: field.max },
        message: `${field.name} must not exceed ${field.max}`,
      });
    }

    if (field.min !== undefined) {
      rules.push({
        type: 'range',
        field: field.name,
        value: { min: field.min },
        message: `${field.name} must be at least ${field.min}`,
      });
    }
  }

  return rules;
}

/**
 * Build permission rules
 * @param {string} entityName - Entity name
 * @param {Array<string>} roles - Available roles
 * @param {Array<Object>} fields - Field definitions
 * @returns {Array<Object>} Permission rules
 */
function buildPermissionRules(entityName, roles, fields) {
  const rules = [];
  const actions = ['read', 'create', 'update', 'delete'];

  for (const role of roles) {
    for (const action of actions) {
      rules.push({
        role,
        action,
        fields: [], // Empty = applies to all fields
      });
    }
  }

  return rules;
}

/**
 * Build role-to-actions mapping
 * @param {Array<Object>} rules - Permission rules
 * @returns {Object} Role to actions mapping
 */
function buildRoleActions(rules) {
  const roleActions = {};

  for (const rule of rules) {
    if (!roleActions[rule.role]) {
      roleActions[rule.role] = [];
    }
    roleActions[rule.role].push(rule.action);
  }

  return roleActions;
}

/**
 * Build API endpoint specifications
 * @param {string} entityName - Entity name
 * @param {string} camelCase - camelCase entity name
 * @returns {Array<Object>} Endpoint specifications
 */
function buildEndpointSpecs(entityName, camelCase) {
  return [
    {
      method: 'POST',
      path: `/api/${camelCase}`,
      description: `Create a new ${entityName}`,
    },
    {
      method: 'GET',
      path: `/api/${camelCase}/{id}`,
      description: `Get a ${entityName} by ID`,
    },
    {
      method: 'PATCH',
      path: `/api/${camelCase}/{id}`,
      description: `Update a ${entityName}`,
    },
    {
      method: 'DELETE',
      path: `/api/${camelCase}/{id}`,
      description: `Delete a ${entityName}`,
    },
    {
      method: 'GET',
      path: `/api/${camelCase}`,
      description: `List all ${entityName}s`,
    },
  ];
}

/**
 * Build repository method specifications
 * @param {string} entityName - Entity name
 * @param {Array<Object>} uniqueFields - Unique fields
 * @param {boolean} searchEnabled - Search capability enabled
 * @returns {Array<Object>} Method specifications
 */
function buildRepositoryMethods(entityName, uniqueFields, searchEnabled) {
  const methods = [
    {
      name: 'findById',
      parameters: ['id'],
      returnType: `Promise<${entityName} | null>`,
      description: 'Find entity by ID',
    },
    {
      name: 'findAll',
      parameters: ['limit', 'offset'],
      returnType: `Promise<${entityName}[]>`,
      description: 'Find all entities with pagination',
    },
    {
      name: 'count',
      parameters: [],
      returnType: 'Promise<number>',
      description: 'Count total entities',
    },
    {
      name: 'create',
      parameters: ['data'],
      returnType: `Promise<${entityName}>`,
      description: 'Create new entity',
    },
    {
      name: 'update',
      parameters: ['id', 'data'],
      returnType: `Promise<${entityName}>`,
      description: 'Update entity',
    },
    {
      name: 'delete',
      parameters: ['id'],
      returnType: 'Promise<void>',
      description: 'Delete entity (soft delete)',
    },
    {
      name: 'hardDelete',
      parameters: ['id'],
      returnType: 'Promise<void>',
      description: 'Permanently delete entity',
    },
  ];

  // Add unique field finders
  for (const field of uniqueFields) {
    const methodName = `findBy${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`;
    methods.push({
      name: methodName,
      parameters: [field.name],
      returnType: `Promise<${entityName} | null>`,
      description: `Find entity by ${field.name}`,
    });
  }

  // Add search method
  if (searchEnabled) {
    methods.push({
      name: 'search',
      parameters: ['query', 'limit'],
      returnType: `Promise<${entityName}[]>`,
      description: 'Search entities',
    });
  }

  return methods;
}

/**
 * Build service method specifications
 * @param {string} entityName - Entity name
 * @param {Object} lifecycle - Lifecycle configuration
 * @returns {Array<Object>} Method specifications
 */
function buildServiceMethods(entityName, lifecycle) {
  return [
    {
      name: 'get',
      parameters: ['id'],
      returnType: `Promise<${entityName} | null>`,
      description: 'Get entity',
    },
    {
      name: 'list',
      parameters: ['limit', 'offset'],
      returnType: `Promise<${entityName}[]>`,
      description: 'List entities',
    },
    {
      name: 'create',
      parameters: ['input', 'context'],
      returnType: `Promise<${entityName}>`,
      description: 'Create entity with validation',
    },
    {
      name: 'update',
      parameters: ['id', 'input', 'context'],
      returnType: `Promise<${entityName}>`,
      description: 'Update entity with validation',
    },
    {
      name: 'delete',
      parameters: ['id', 'context'],
      returnType: 'Promise<void>',
      description: 'Delete entity',
    },
    {
      name: 'count',
      parameters: [],
      returnType: 'Promise<number>',
      description: 'Count entities',
    },
  ];
}

/**
 * Build documentation sections
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {Array<Object>} Documentation sections
 */
function buildDocumentationSections(blueprint) {
  return [
    {
      heading: 'Overview',
      content: blueprint.metadata.description,
    },
    {
      heading: 'Fields',
      content: `${blueprint.fields.all.length} fields defined`,
    },
    {
      heading: 'Relationships',
      content: `${blueprint.relationships.all.length} relationships defined`,
    },
    {
      heading: 'Lifecycle',
      content: `${Object.keys(blueprint.lifecycle.states).length} states`,
    },
    {
      heading: 'Capabilities',
      content: 'Search, Audit, Validation, Permissions, Events',
    },
    {
      heading: 'API',
      content: `${blueprint.api.endpoints.length} endpoints`,
    },
  ];
}
