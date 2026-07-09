/**
 * EnterpriseObjectBlueprint
 *
 * Canonical Intermediate Representation (IR) for compiler pipeline.
 *
 * The EnterpriseObjectBlueprint is the stable contract between the metadata
 * expansion phase and all downstream consumers (renderers, validators, etc.).
 *
 * This design ensures:
 * - Single source of truth for entity metadata throughout compilation
 * - No renderer reads raw YAML directly
 * - Type-safe, explicit contract for all entity information
 * - Easy to extend for new entity types (Vendor, Project, Machine, etc.)
 * - Clear separation between raw metadata and compiled representation
 *
 * @module tools/genesis/compiler/ir/EnterpriseObjectBlueprint
 */

/**
 * EnterpriseObjectBlueprint
 *
 * Comprehensive typed representation of an enterprise object entity.
 * Created during metadata expansion phase, consumed by all renderers.
 *
 * @typedef {Object} EnterpriseObjectBlueprint
 *
 * @property {Object} metadata - Core entity metadata
 * @property {string} metadata.entity - Entity name (e.g., 'Customer')
 * @property {string} metadata.displayName - Human-readable display name
 * @property {string} metadata.pluralName - Plural form
 * @property {string} metadata.description - Entity description
 * @property {string} metadata.namespace - Logical namespace (e.g., 'crm')
 * @property {Array<string>} metadata.tags - Classification tags
 * @property {string} metadata.generatedAt - ISO timestamp of blueprint creation
 * @property {string} metadata.definitionPath - Path to source YAML file
 *
 * @property {Object} fields - Field definitions section
 * @property {Array<FieldDefinition>} fields.all - All expanded field definitions
 * @property {Array<FieldDefinition>} fields.required - Fields marked as required
 * @property {Array<FieldDefinition>} fields.unique - Fields marked as unique
 * @property {Array<FieldDefinition>} fields.generated - Auto-generated fields (id, timestamps)
 * @property {Array<FieldDefinition>} fields.searchable - Fields included in search index
 *
 * @property {Object} relationships - Relationship definitions section
 * @property {Array<RelationshipDefinition>} relationships.all - All expanded relationships
 * @property {Array<RelationshipDefinition>} relationships.hasMany - One-to-many relationships
 * @property {Array<RelationshipDefinition>} relationships.hasOne - One-to-one relationships
 * @property {Array<RelationshipDefinition>} relationships.belongsTo - Many-to-one relationships
 * @property {Array<RelationshipDefinition>} relationships.manyToMany - Many-to-many relationships
 * @property {Array<RelationshipDefinition>} relationships.required - Required relationships
 *
 * @property {Object} lifecycle - Lifecycle state machine section
 * @property {Object.<string, StateDefinition>} lifecycle.states - State definitions
 * @property {Array<TransitionDefinition>} lifecycle.transitions - Valid state transitions
 * @property {boolean} lifecycle.softDelete - Supports soft delete flag
 * @property {boolean} lifecycle.versioning - Supports versioning flag
 * @property {boolean} lifecycle.archived - Supports archival flag
 * @property {Object} lifecycle.timestamps - Timestamp field configuration
 *
 * @property {Object} capabilities - Feature capabilities section
 * @property {Object} capabilities.search - Search capability
 * @property {boolean} capabilities.search.enabled - Search enabled
 * @property {Array<string>} capabilities.search.fields - Searchable field names
 *
 * @property {Object} capabilities.audit - Audit capability
 * @property {boolean} capabilities.audit.enabled - Audit enabled
 * @property {boolean} capabilities.audit.trackChanges - Track field changes
 *
 * @property {Object} capabilities.validation - Validation capability
 * @property {boolean} capabilities.validation.enabled - Validation enabled
 *
 * @property {Object} capabilities.permissions - Permission capability
 * @property {boolean} capabilities.permissions.enabled - Permissions enabled
 * @property {Array<string>} capabilities.permissions.roles - Available roles
 *
 * @property {Object} capabilities.events - Event capability
 * @property {boolean} capabilities.events.enabled - Events enabled
 *
 * @property {Object} validation - Validation rules section
 * @property {Array<ValidationRule>} validation.rules - All validation rules
 * @property {Array<ValidationRule>} validation.required - Required field rules
 * @property {Array<ValidationRule>} validation.format - Format validation rules
 * @property {Array<ValidationRule>} validation.unique - Unique constraint rules
 * @property {Array<ValidationRule>} validation.range - Range constraint rules
 *
 * @property {Object} permissions - Permissions section
 * @property {Array<PermissionRule>} permissions.rules - All permission rules
 * @property {Array<string>} permissions.roles - Available roles
 * @property {Object.<string, Array<string>>} permissions.roleActions - Actions per role
 *
 * @property {Object} api - API specification section
 * @property {string} api.baseUrl - Base API URL path (e.g., '/api/customer')
 * @property {string} api.camelCase - camelCase entity name
 * @property {Array<EndpointSpec>} api.endpoints - CRUD endpoint specifications
 *
 * @property {Object} repository - Repository layer specification
 * @property {Array<MethodSpec>} repository.methods - Data access methods
 * @property {boolean} repository.supportsSoftDelete - Soft delete support
 * @property {string} repository.tableName - Database table name
 *
 * @property {Object} service - Service layer specification
 * @property {Array<MethodSpec>} service.methods - Business logic methods
 * @property {boolean} service.requiresValidation - Validation required
 * @property {boolean} service.requiresAudit - Audit logging required
 *
 * @property {Object} documentation - Documentation specification
 * @property {string} documentation.title - Document title
 * @property {Array<DocumentationSection>} documentation.sections - Doc sections
 *
 * @property {Object} tests - Generated test metadata section (Phase 9)
 * @property {Object} tests.blueprint - Blueprint structure tests
 * @property {Object} tests.fields - Field expansion and validation tests
 * @property {Object} tests.relationships - Relationship expansion tests
 * @property {Object} tests.lifecycle - Lifecycle and state transition tests
 * @property {Object} tests.permissions - Permission policy tests
 * @property {Object} tests.validation - Validation constraint tests
 * @property {Object} tests.search - Search indexing tests
 * @property {Object} tests.contracts - Contract verification tests (repository, service, API)
 * @property {Object} tests.integration - Integration test specifications
 *
 * @property {Object} registration - Runtime registration metadata section (Phase 10)
 * @property {Object} registration.manifest - Runtime registration manifest
 * @property {Object} registration.artifacts - Generated artifact registry
 * @property {Object} registration.capabilities - Capability registry
 * @property {Object} registration.contracts - Contract registry
 * @property {Object} registration.validation - Validation registry
 * @property {Object} registration.metadata - Registration metadata
 *
 * @property {Object} module - Module boundary metadata section (Phase 11)
 * @property {Object} module.ownership - Module ownership information
 * @property {Object} module.module - Module definition
 * @property {Object} module.boundaries - Module boundaries (public/internal)
 * @property {Object} module.registry - Module registry information
 * @property {Object} module.integration - Integration points with other modules
 * @property {Object} module.architecture - Module architecture information
 */

/**
 * FieldDefinition
 * @typedef {Object} FieldDefinition
 * @property {string} name - Field name
 * @property {string} type - Field type (string, email, number, date, enum, etc.)
 * @property {string} description - Field description
 * @property {boolean} required - Is required
 * @property {boolean} unique - Is unique
 * @property {boolean} generated - Is auto-generated
 * @property {boolean} readonly - Is read-only
 * @property {*} default - Default value
 * @property {number} [maxLength] - Max length for strings
 * @property {number} [minLength] - Min length for strings
 * @property {number} [max] - Max value for numbers
 * @property {number} [min] - Min value for numbers
 * @property {Array<*>} [values] - Allowed values for enums
 * @property {string} [pattern] - Regex pattern for validation
 */

/**
 * RelationshipDefinition
 * @typedef {Object} RelationshipDefinition
 * @property {string} name - Relationship name
 * @property {string} type - Relationship type (hasMany, hasOne, belongsTo)
 * @property {string} target - Target entity name
 * @property {string} description - Relationship description
 * @property {boolean} required - Is required
 * @property {string} cascade - Cascade delete behavior
 * @property {boolean} lazy - Lazy load behavior
 * @property {string} pluralName - Plural name for hasMany
 * @property {string} singularName - Singular name for hasMany
 * @property {string} getterMethod - Generated getter method name
 * @property {string} setterMethod - Generated setter method name
 * @property {string} adderMethod - Generated adder method name
 * @property {string} removerMethod - Generated remover method name
 */

/**
 * StateDefinition
 * @typedef {Object} StateDefinition
 * @property {number} order - State order in lifecycle
 * @property {string} label - Human-readable state label
 * @property {boolean} active - Is active state
 */

/**
 * TransitionDefinition
 * @typedef {Object} TransitionDefinition
 * @property {string} from - Source state
 * @property {string} to - Target state
 * @property {string} trigger - Transition trigger name
 * @property {string} [guard] - Optional guard condition
 */

/**
 * ValidationRule
 * @typedef {Object} ValidationRule
 * @property {string} type - Rule type (required, format, unique, range, etc.)
 * @property {string} field - Field name
 * @property {*} value - Rule configuration value
 * @property {string} message - Validation error message
 */

/**
 * PermissionRule
 * @typedef {Object} PermissionRule
 * @property {string} role - Role name
 * @property {string} action - Action name (read, create, update, delete)
 * @property {Array<string>} fields - Applicable fields (empty = all)
 */

/**
 * MethodSpec
 * @typedef {Object} MethodSpec
 * @property {string} name - Method name
 * @property {Array<string>} parameters - Parameter names
 * @property {string} returnType - Return type
 * @property {string} description - Method description
 */

/**
 * EndpointSpec
 * @typedef {Object} EndpointSpec
 * @property {string} method - HTTP method
 * @property {string} path - URL path
 * @property {string} description - Endpoint description
 */

/**
 * DocumentationSection
 * @typedef {Object} DocumentationSection
 * @property {string} heading - Section heading
 * @property {string} content - Section content
 */

/**
 * Create a blank EnterpriseObjectBlueprint template
 * @returns {EnterpriseObjectBlueprint} Initialized blueprint
 */
export function createBlueprint() {
  return {
    metadata: {
      entity: '',
      displayName: '',
      pluralName: '',
      description: '',
      namespace: 'default',
      tags: [],
      generatedAt: new Date().toISOString(),
      definitionPath: '',
    },
    fields: {
      all: [],
      required: [],
      unique: [],
      generated: [],
      searchable: [],
    },
    relationships: {
      all: [],
      hasMany: [],
      hasOne: [],
      belongsTo: [],
      manyToMany: [],
      required: [],
    },
    lifecycle: {
      states: {},
      transitions: [],
      softDelete: false,
      versioning: false,
      archived: false,
      timestamps: {
        createdAt: true,
        updatedAt: true,
        deletedAt: false,
        archivedAt: false,
      },
    },
    events: {
      all: [],
      lifecycle: [],
      capability: [],
      custom: [],
      byTrigger: {},
    },
    capabilities: {
      search: {
        enabled: false,
        fields: [],
      },
      audit: {
        enabled: false,
        trackChanges: false,
      },
      validation: {
        enabled: false,
      },
      permissions: {
        enabled: false,
        roles: [],
      },
      events: {
        enabled: false,
      },
    },
    validation: {
      enabled: false,
      constraints: {
        required: [],        // Required field constraints
        type: [],            // Type validation constraints
        format: [],          // Format/pattern constraints
        range: [],           // Numeric/date range constraints
        length: [],          // String length constraints
        enum: [],            // Enum value constraints
        unique: [],          // Uniqueness constraints
        email: [],           // Email format constraints
        relationships: [],   // Relationship constraints
      },
      custom: [],            // Custom validation rules
      messages: {},          // Custom error messages
    },
    rules: {
      enabled: false,
      rules: {
        crossField: [],      // Cross-field comparison rules
        lifecycle: [],       // Lifecycle state constraint rules
        conditional: [],     // If/then conditional rules
        relationship: [],    // Relationship constraint rules
        invariant: [],       // Invariant constraint rules
        trigger: [],         // Event-triggered rules
        custom: [],          // Custom rules from YAML
      },
      byType: {},            // Index of rules by type
      byField: {},           // Index of rules by field involved
      byState: {},           // Index of rules by lifecycle state
    },
    permissions: {
      enabled: false,
      roles: [],
      actions: [],
      roleActions: {},
      roleDefaults: {},
      policies: [],
    },
    policies: {
      all: [],
      byConditionType: {},
      byAction: {},
      byRole: {},
    },
    search: {
      enabled: false,
      indexed: false,
      fullText: false,
      fields: {
        searchable: [],
        filterable: [],
        sortable: [],
        keywordFields: [],
        exactMatchFields: [],
        dateRangeFields: [],
        numericRangeFields: [],
      },
      lifecycleFilterable: false,
      softDeleteFilterable: false,
      relationshipSearch: [],
      defaultSort: null,
      defaultSortOrder: 'asc',
      metadata: [],
    },
    index: {
      enabled: false,
      indexName: '',
      strategy: 'simple',
      fields: [],
      compositeIndexes: [],
      settings: {
        analyzers: [],
        refreshInterval: '1s',
        numberOfShards: 1,
        numberOfReplicas: 0,
      },
    },
    api: {
      enabled: false,
      baseUrl: '',
      camelCase: '',
      endpoints: {
        create: null,
        readById: null,
        update: null,
        delete: null,
        list: null,
        transition: null,
        softDelete: null,
        restore: null,
        archive: null,
      },
      openAPI: {
        version: '3.1.0',
        title: '',
        description: '',
        tags: [],
        components: {
          schemas: {},
        },
      },
      graphQL: {
        type: '',
        queries: [],
        mutations: [],
        fields: [],
        relationships: [],
      },
      rest: {
        baseRoute: '',
        operations: [],
      },
      dtos: {
        entity: null,
        createRequest: null,
        updateRequest: null,
        response: null,
      },
      errorResponses: {},
    },
    repository: {
      methods: [],
      supportsSoftDelete: false,
      tableName: '',
    },
    service: {
      methods: [],
      requiresValidation: false,
      requiresAudit: false,
    },
    documentation: {
      title: '',
      sections: [],
    },
  };
}

/**
 * Validate that a blueprint has all required sections
 * @param {EnterpriseObjectBlueprint} blueprint - Blueprint to validate
 * @returns {boolean} True if valid
 * @throws {Error} If blueprint is invalid
 */
export function validateBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') {
    throw new Error('Blueprint must be an object');
  }

  const requiredSections = [
    'metadata',
    'fields',
    'relationships',
    'lifecycle',
    'events',
    'capabilities',
    'validation',
    'permissions',
    'api',
    'repository',
    'service',
    'documentation',
  ];

  for (const section of requiredSections) {
    if (!(section in blueprint)) {
      throw new Error(`Blueprint missing required section: ${section}`);
    }
  }

  if (!blueprint.metadata.entity) {
    throw new Error('Blueprint metadata must have entity name');
  }

  return true;
}
