/**
 * RegistrationExpander - Phase 10
 *
 * Formalizes runtime registration metadata into comprehensive registration model.
 *
 * Purpose:
 *   - Expand registration metadata from entity definitions
 *   - Formalize object registration as a compiler concept
 *   - Create registration manifest specifications
 *   - Enable metadata-driven runtime registration
 *
 * Consumes: Expanded fields, relationships, lifecycle, permissions, capabilities, API
 * Produces: Registration metadata section for blueprint
 *
 * @module tools/genesis/compiler/metadata-engine/RegistrationExpander
 */

/**
 * Expand registration metadata
 *
 * @param {string} entityName - Entity name (e.g., 'Customer')
 * @param {string} namespace - Entity namespace (e.g., 'crm')
 * @param {Array} expandedFields - Expanded field definitions
 * @param {Array} expandedRelationships - Expanded relationship definitions
 * @param {Object} expandedCapabilities - Expanded capabilities
 * @param {Object} expandedLifecycle - Expanded lifecycle
 * @param {Array} expandedPermissions - Expanded permissions
 * @param {Array} expandedRules - Expanded validation rules
 * @param {Object} expandedSearch - Expanded search configuration
 * @param {Object} expandedAPI - Expanded API specification
 * @returns {Object} Registration metadata model
 */
export function expandRegistration(
  entityName,
  namespace,
  expandedFields,
  expandedRelationships,
  expandedCapabilities,
  expandedLifecycle,
  expandedPermissions,
  expandedRules,
  expandedSearch,
  expandedAPI
) {
  return {
    manifest: generateManifestSpec(
      entityName,
      namespace,
      expandedFields,
      expandedRelationships,
      expandedCapabilities,
      expandedLifecycle,
      expandedPermissions,
      expandedRules,
      expandedSearch,
      expandedAPI
    ),
    artifacts: generateArtifactRegistry(entityName),
    capabilities: generateCapabilityRegistry(expandedCapabilities),
    contracts: generateContractRegistry(expandedAPI, expandedPermissions),
    validation: generateValidationRegistry(expandedRules),
    metadata: generateRegistrationMetadata(entityName, namespace),
  };
}

/**
 * Generate manifest specification
 *
 * Contains all information needed to register object in runtime.
 */
function generateManifestSpec(
  entityName,
  namespace,
  expandedFields,
  expandedRelationships,
  expandedCapabilities,
  expandedLifecycle,
  expandedPermissions,
  expandedRules,
  expandedSearch,
  expandedAPI
) {
  // Flatten rules from rules object to get total count
  const allRules = [];
  if (expandedRules?.rules) {
    Object.values(expandedRules.rules).forEach(ruleArray => {
      if (Array.isArray(ruleArray)) {
        allRules.push(...ruleArray);
      }
    });
  }

  return {
    name: {
      singular: entityName,
      plural: entityName + 's', // TODO: improve pluralization
      camelCase: entityName.charAt(0).toLowerCase() + entityName.slice(1),
      pascalCase: entityName,
      description: `Enterprise object: ${entityName}`,
    },
    namespace: {
      logical: namespace || 'default',
      module: `@genesis/${namespace || 'entities'}`,
      path: `/entities/${namespace || 'default'}/${entityName}`,
    },
    version: {
      semantic: '1.0.0',
      generatedAt: new Date().toISOString(),
      compiledAt: new Date().toISOString(),
    },
    classification: {
      domain: namespace || 'general',
      type: 'enterprise-object',
      tier: 'core',
      tags: ['auto-generated', 'compilable', 'registerable'],
    },
    structure: {
      fields: {
        total: expandedFields.length,
        required: expandedFields.filter(f => f.required).length,
        unique: expandedFields.filter(f => f.unique).length,
        searchable: expandedFields.filter(f => f.searchable).length,
      },
      relationships: {
        total: expandedRelationships.length,
        hasMany: expandedRelationships.filter(r => r.type === 'hasMany').length,
        hasOne: expandedRelationships.filter(r => r.type === 'hasOne').length,
        belongsTo: expandedRelationships.filter(r => r.type === 'belongsTo').length,
      },
    },
    capabilities: {
      audit: expandedCapabilities.audit?.enabled || false,
      search: expandedCapabilities.search?.enabled || false,
      validation: expandedCapabilities.validation?.enabled || false,
      permissions: expandedCapabilities.permissions?.enabled || false,
      events: expandedCapabilities.events?.enabled || false,
      softDelete: expandedLifecycle.softDelete || false,
      versioning: expandedLifecycle.versioning || false,
    },
    lifecycle: {
      states: Object.keys(expandedLifecycle.states || {}).length,
      transitions: (expandedLifecycle.transitions || []).length,
      initialState: expandedLifecycle.initialState || 'draft',
      terminalStates: expandedLifecycle.terminalStates || [],
    },
    permissions: {
      roles: (expandedPermissions || []).length,
      policiesCount: (expandedPermissions || []).length,
    },
    validation: {
      rulesCount: allRules.length,
      constraints: allRules.filter(r => r.type === 'constraint').length || 0,
    },
    search: {
      enabled: expandedSearch?.enabled || false,
      indexable: expandedSearch?.indexable || false,
      fields: expandedSearch?.fields || [],
    },
    api: {
      version: expandedAPI?.version || '1.0.0',
      baseUrl: expandedAPI?.baseUrl || `/api/${entityName.toLowerCase()}`,
      endpoints: {
        list: true,
        create: true,
        readById: true,
        update: true,
        delete: true,
        search: expandedSearch?.enabled || false,
      },
      formats: {
        rest: true,
        graphql: true,
        openapi: true,
      },
    },
  };
}

/**
 * Generate artifact registry
 *
 * Documents all generated artifacts for this entity.
 */
function generateArtifactRegistry(entityName) {
  const artifacts = [
    { type: 'repository', name: `${entityName}Repository.ts`, description: 'Data access layer' },
    { type: 'service', name: `${entityName}Service.ts`, description: 'Business logic layer' },
    { type: 'validator', name: `${entityName}Validator.ts`, description: 'Validation layer' },
    { type: 'permissions', name: `${entityName}Permissions.json`, description: 'Permission rules' },
    { type: 'policies', name: `${entityName}.policies.md`, description: 'Policy documentation' },
    { type: 'events', name: `${entityName}Events.ts`, description: 'Event definitions' },
    { type: 'search', name: `${entityName}Search.ts`, description: 'Search configuration' },
    { type: 'documentation', name: `${entityName}.md`, description: 'Entity documentation' },
    { type: 'tests', name: `${entityName}.test.ts`, description: 'Test suite' },
    { type: 'openapi', name: `${entityName}.openapi.yaml`, description: 'OpenAPI specification' },
    { type: 'graphql', name: `${entityName}.schema.graphql`, description: 'GraphQL schema' },
    { type: 'dtos', name: `${entityName}.dtos.ts`, description: 'Data transfer objects' },
    { type: 'rest-contract', name: `${entityName}.rest.md`, description: 'REST contract' },
    { type: 'error-contracts', name: `${entityName}.errors.ts`, description: 'Error contracts' },
    { type: 'blueprint', name: `${entityName}.blueprint.json`, description: 'Compiler IR' },
  ];

  return {
    total: artifacts.length,
    artifacts: artifacts.map(a => ({
      ...a,
      registerable: true,
      exportable: true,
      namespace: `@genesis/${a.type}`,
    })),
  };
}

/**
 * Generate capability registry
 *
 * Documents which capabilities are enabled and configured.
 */
function generateCapabilityRegistry(expandedCapabilities) {
  return {
    capabilities: [
      {
        name: 'audit',
        enabled: expandedCapabilities.audit?.enabled || false,
        description: 'Audit trail and change tracking',
        trackChanges: expandedCapabilities.audit?.trackChanges || false,
      },
      {
        name: 'search',
        enabled: expandedCapabilities.search?.enabled || false,
        description: 'Full-text search and indexing',
        indexable: expandedCapabilities.search?.indexable || false,
      },
      {
        name: 'validation',
        enabled: expandedCapabilities.validation?.enabled || false,
        description: 'Field and entity validation',
      },
      {
        name: 'permissions',
        enabled: expandedCapabilities.permissions?.enabled || false,
        description: 'Role-based access control',
        roles: expandedCapabilities.permissions?.roles || [],
      },
      {
        name: 'events',
        enabled: expandedCapabilities.events?.enabled || false,
        description: 'Event emission and handling',
      },
    ],
    extensible: true,
    customCapabilities: [],
  };
}

/**
 * Generate contract registry
 *
 * Documents all generated contracts (API, Service, Repository, Validator).
 */
function generateContractRegistry(expandedAPI, expandedPermissions) {
  let allRules = [];
  let constraintCount = 0;

  if (expandedAPI?.validation?.constraints) {
    constraintCount = expandedAPI.validation.constraints.length || 0;
  }

  return {
    repository: {
      type: 'data-access',
      methods: ['findById', 'findAll', 'count', 'create', 'update', 'delete', 'search'],
      supportsSoftDelete: true,
    },
    service: {
      type: 'business-logic',
      methods: ['get', 'list', 'create', 'update', 'delete', 'search', 'validate'],
      supportsTransactions: true,
      requiresValidation: true,
      requiresAudit: true,
    },
    api: {
      type: 'rest-api',
      baseUrl: expandedAPI?.baseUrl || '/api/entity',
      version: expandedAPI?.version || '1.0.0',
      endpoints: expandedAPI?.endpoints?.length || 5,
      formats: {
        rest: true,
        graphql: expandedAPI?.graphQL ? true : false,
        openapi: expandedAPI?.openAPI ? true : false,
      },
    },
    validator: {
      type: 'validation',
      constraintCount: constraintCount,
      rulesCount: expandedAPI?.validation?.rules?.length || 0,
    },
    permissions: {
      type: 'access-control',
      roles: (expandedPermissions || []).length,
      policyCount: (expandedPermissions || []).length,
    },
  };
}

/**
 * Generate validation registry
 *
 * Documents validation constraints and rules.
 */
function generateValidationRegistry(expandedRules) {
  let rules = [];
  if (expandedRules?.rules) {
    Object.entries(expandedRules.rules).forEach(([type, ruleArray]) => {
      if (Array.isArray(ruleArray)) {
        rules = rules.concat(ruleArray);
      }
    });
  }

  return {
    totalRules: rules.length,
    constraints: rules.filter(r => r.type === 'constraint').length,
    businessRules: rules.filter(r => r.type === 'business-rule').length,
    customValidations: rules.filter(r => r.type === 'custom').length,
    rules: rules.map(r => ({
      name: r.name,
      type: r.type,
      target: r.target,
      severity: r.severity || 'error',
      registerable: true,
    })),
  };
}

/**
 * Generate registration metadata
 *
 * Core metadata for runtime registration.
 */
function generateRegistrationMetadata(entityName, namespace) {
  return {
    registryKey: `${namespace || 'default'}:${entityName}`,
    registryPath: `/registry/entities/${namespace || 'default'}/${entityName}`,
    registrationRequired: true,
    registrationPhase: 'bootstrap',
    dependencies: [
      'FieldRegistry',
      'RelationshipRegistry',
      'LifecycleRegistry',
      'PermissionRegistry',
    ],
    exports: [
      `${entityName}Repository`,
      `${entityName}Service`,
      `${entityName}Validator`,
      `${entityName}Events`,
      `${entityName}Search`,
      `${entityName}Permissions`,
    ],
  };
}
