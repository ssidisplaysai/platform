/**
 * RendererTarget
 *
 * Formal registry of all renderer targets for the Genesis compiler.
 * Each target represents a slice of the enterprise object that should be generated.
 *
 * @module tools/genesis/compiler/registry/RendererTarget
 */

/**
 * All renderer targets for enterprise object generation
 * Each target has a consistent interface: generateXxx(blueprint) => string
 */
export const RendererTargets = {
  REPOSITORY: {
    id: 'repository',
    name: 'Repository',
    description: 'Data access layer (TypeScript)',
    fileExtension: 'Repository.ts',
    required: true,
  },
  SERVICE: {
    id: 'service',
    name: 'Service',
    description: 'Business logic layer (TypeScript)',
    fileExtension: 'Service.ts',
    required: true,
  },
  VALIDATOR: {
    id: 'validator',
    name: 'Validator',
    description: 'Field and entity validation (TypeScript)',
    fileExtension: 'Validator.ts',
    required: true,
  },
  PERMISSIONS: {
    id: 'permissions',
    name: 'Permissions',
    description: 'Role-based access control rules (JSON)',
    fileExtension: 'Permissions.json',
    required: false,
  },
  POLICIES: {
    id: 'policies',
    name: 'Policies',
    description: 'Access control policies and conditions (Markdown)',
    fileExtension: '.policies.md',
    required: false,
  },
  EVENTS: {
    id: 'events',
    name: 'Events',
    description: 'Event definitions and handlers (TypeScript)',
    fileExtension: 'Events.ts',
    required: false,
  },
  SEARCH: {
    id: 'search',
    name: 'Search',
    description: 'Search index configuration (TypeScript)',
    fileExtension: 'Search.ts',
    required: false,
  },
  DOCUMENTATION: {
    id: 'documentation',
    name: 'Documentation',
    description: 'Entity documentation (Markdown)',
    fileExtension: '.md',
    required: true,
  },
  TESTS: {
    id: 'tests',
    name: 'Tests',
    description: 'Contract tests for the entity (TypeScript)',
    fileExtension: '.test.ts',
    required: false,
  },
  OPENAPI: {
    id: 'openapi',
    name: 'OpenAPI Specification',
    description: 'OpenAPI 3.1 contract (YAML)',
    fileExtension: '.openapi.yaml',
    required: false,
  },
  GRAPHQL: {
    id: 'graphql',
    name: 'GraphQL Schema',
    description: 'GraphQL type definitions and queries (GraphQL)',
    fileExtension: '.schema.graphql',
    required: false,
  },
  DTOs: {
    id: 'dtos',
    name: 'Data Transfer Objects',
    description: 'Request/response DTO types (TypeScript)',
    fileExtension: '.dtos.ts',
    required: false,
  },
  REST_CONTRACT: {
    id: 'rest-contract',
    name: 'REST Contract',
    description: 'REST API endpoint documentation (Markdown)',
    fileExtension: '.rest.md',
    required: false,
  },
  ERROR_CONTRACTS: {
    id: 'error-contracts',
    name: 'Error Contracts',
    description: 'Error response types and factories (TypeScript)',
    fileExtension: '.errors.ts',
    required: false,
  },
  REGISTRATION: {
    id: 'registration',
    name: 'Runtime Registration Manifest',
    description: 'Runtime registration and initialization manifest (JSON)',
    fileExtension: '.registration.json',
    required: false,
  },
  MODULE: {
    id: 'module',
    name: 'Module Manifest',
    description: 'Module boundary and ownership manifest (JSON)',
    fileExtension: '.module.json',
    required: false,
  },
  BLUEPRINT: {
    id: 'blueprint',
    name: 'Blueprint IR',
    description: 'Compiler intermediate representation (JSON)',
    fileExtension: '.blueprint.json',
    required: true,
  },
  METADATA: {
    id: 'metadata',
    name: 'Metadata Cache',
    description: 'Generation metadata and artifacts registry (JSON)',
    fileExtension: '.gen.json',
    required: true,
  },
};

/**
 * Get all renderer targets
 * @returns {Object[]} Array of all targets
 */
export function getAllTargets() {
  return Object.values(RendererTargets);
}

/**
 * Get required targets only
 * @returns {Object[]} Array of required targets
 */
export function getRequiredTargets() {
  return getAllTargets().filter(t => t.required);
}

/**
 * Get optional targets
 * @returns {Object[]} Array of optional targets
 */
export function getOptionalTargets() {
  return getAllTargets().filter(t => !t.required);
}

/**
 * Generate deterministic file name for an entity and target
 * @param {string} entityName - Entity name (e.g., 'Customer')
 * @param {string} targetId - Target ID (e.g., 'repository')
 * @returns {string} File name
 */
export function generateFileName(entityName, targetId) {
  const target = Object.values(RendererTargets).find(t => t.id === targetId);
  if (!target) {
    throw new Error(`Unknown renderer target: ${targetId}`);
  }

  if (target.fileExtension.startsWith('.')) {
    // Documentation, tests, blueprint have entity name directly
    return `${entityName}${target.fileExtension}`;
  } else {
    // Others have entity name + extension
    return `${entityName}${target.fileExtension}`;
  }
}

/**
 * Get target by ID
 * @param {string} id - Target ID
 * @returns {Object} Target definition
 */
export function getTargetById(id) {
  const target = Object.values(RendererTargets).find(t => t.id === id);
  if (!target) {
    throw new Error(`Unknown renderer target: ${id}`);
  }
  return target;
}
