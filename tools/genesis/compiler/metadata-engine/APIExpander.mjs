/**
 * APIExpander
 *
 * Expands API metadata into comprehensive API contract model.
 * Generates OpenAPI, GraphQL, REST, and DTO contracts from entity metadata.
 * Consumes: Raw entity metadata (capabilities, lifecycle, permissions, relationships, validation)
 * Produces: Comprehensive API contract configuration
 *
 * @module tools/genesis/compiler/metadata-engine/APIExpander.mjs
 */

/**
 * Expand API metadata into comprehensive API contract model
 * @param {Object} apiMetadata - Raw API metadata from YAML (if present)
 * @param {Object} entityName - Entity name
 * @param {Array} expandedFields - Expanded field definitions
 * @param {Array} expandedRelationships - Expanded relationship definitions
 * @param {Object} expandedLifecycle - Expanded lifecycle config
 * @param {Object} expandedPermissions - Expanded permissions config
 * @param {Object} expandedValidation - Expanded validation config
 * @returns {Object} Expanded API configuration
 */
export function expandAPI(
  apiMetadata,
  entityName,
  expandedFields,
  expandedRelationships,
  expandedLifecycle,
  expandedPermissions,
  expandedValidation
) {
  return {
    enabled: true,
    endpoints: generateEndpoints(entityName, expandedLifecycle),
    openAPI: generateOpenAPIContract(
      entityName,
      expandedFields,
      expandedRelationships,
      expandedValidation,
      expandedPermissions
    ),
    graphQL: generateGraphQLSchema(
      entityName,
      expandedFields,
      expandedRelationships
    ),
    rest: generateRESTContract(entityName, expandedFields, expandedRelationships),
    dtos: generateDTOSchemas(entityName, expandedFields, expandedRelationships),
    errorResponses: generateErrorContracts(),
  };
}

/**
 * Generate standard CRUD endpoints for entity
 * @param {string} entityName - Entity name
 * @param {Object} expandedLifecycle - Lifecycle configuration
 * @returns {Object} Endpoint definitions
 */
function generateEndpoints(entityName, expandedLifecycle) {
  const endpoints = {
    create: {
      method: 'POST',
      path: `/${camelCasePlural(entityName)}`,
      description: `Create a new ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['create'],
    },
    readById: {
      method: 'GET',
      path: `/${camelCasePlural(entityName)}/:id`,
      description: `Read ${entityName} by ID`,
      requiresAuth: false,
      requiredPermissions: ['read'],
    },
    update: {
      method: 'PUT',
      path: `/${camelCasePlural(entityName)}/:id`,
      description: `Update ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['update'],
    },
    delete: {
      method: 'DELETE',
      path: `/${camelCasePlural(entityName)}/:id`,
      description: `Delete ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['delete'],
    },
    list: {
      method: 'GET',
      path: `/${camelCasePlural(entityName)}`,
      description: `List ${camelCasePlural(entityName)}`,
      requiresAuth: false,
      requiredPermissions: ['read'],
      supportsFiltering: true,
      supportsPagination: true,
      supportsSorting: true,
    },
  };

  // Add lifecycle transition endpoints if lifecycle enabled
  if (expandedLifecycle?.enabled) {
    endpoints.transition = {
      method: 'POST',
      path: `/${camelCasePlural(entityName)}/:id/transition/:state`,
      description: `Transition ${entityName} to new state`,
      requiresAuth: true,
      requiredPermissions: ['update'],
    };
  }

  // Add soft-delete and restore if supported
  if (expandedLifecycle?.softDelete) {
    endpoints.softDelete = {
      method: 'DELETE',
      path: `/${camelCasePlural(entityName)}/:id/soft-delete`,
      description: `Soft-delete ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['delete'],
    };

    endpoints.restore = {
      method: 'POST',
      path: `/${camelCasePlural(entityName)}/:id/restore`,
      description: `Restore soft-deleted ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['restore'],
    };
  }

  // Add archive endpoint if supported
  if (expandedLifecycle?.archived) {
    endpoints.archive = {
      method: 'POST',
      path: `/${camelCasePlural(entityName)}/:id/archive`,
      description: `Archive ${entityName}`,
      requiresAuth: true,
      requiredPermissions: ['archive'],
    };
  }

  return endpoints;
}

/**
 * Generate OpenAPI contract for entity
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Array} expandedRelationships - Relationship definitions
 * @param {Object} expandedValidation - Validation config
 * @param {Object} expandedPermissions - Permissions config
 * @returns {Object} OpenAPI contract
 */
function generateOpenAPIContract(
  entityName,
  expandedFields,
  expandedRelationships,
  expandedValidation,
  expandedPermissions
) {
  const schema = generateOpenAPISchema(
    entityName,
    expandedFields,
    expandedRelationships,
    expandedValidation
  );

  return {
    version: '3.1.0',
    title: `${entityName} API`,
    description: `API contracts for ${entityName} entity`,
    tags: [entityName],
    components: {
      schemas: {
        [entityName]: schema,
        [`${entityName}Input`]: generateInputSchema(
          entityName,
          expandedFields,
          expandedValidation
        ),
        [`${entityName}Response`]: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ...schema.properties,
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: { type: 'string' },
            updatedBy: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
      },
    },
  };
}

/**
 * Generate OpenAPI schema properties from entity fields
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Array} expandedRelationships - Relationship definitions
 * @param {Object} expandedValidation - Validation config
 * @returns {Object} OpenAPI schema
 */
function generateOpenAPISchema(
  entityName,
  expandedFields,
  expandedRelationships,
  expandedValidation
) {
  const properties = {};
  const required = [];

  for (const field of expandedFields) {
    if (field.generated) continue; // Skip generated fields like id, createdAt

    const property = fieldToOpenAPIProperty(field, expandedValidation);
    properties[field.name] = property;

    if (field.required) {
      required.push(field.name);
    }
  }

  // Add relationships as properties
  for (const rel of expandedRelationships) {
    const cardinality = rel.type === 'OneToMany' ? 'array' : 'object';
    properties[rel.name] = {
      type: cardinality === 'array' ? 'array' : 'string',
      description: rel.description,
      items: cardinality === 'array' ? { type: 'string', format: 'uuid' } : undefined,
    };
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Convert field type to OpenAPI property schema
 * @param {Object} field - Field definition
 * @param {Object} expandedValidation - Validation config
 * @returns {Object} OpenAPI property schema
 */
function fieldToOpenAPIProperty(field, expandedValidation) {
  const property = {
    description: field.description || '',
  };

  switch (field.type) {
    case 'string':
      property.type = 'string';
      if (field.maxLength) property.maxLength = field.maxLength;
      if (field.minLength) property.minLength = field.minLength;
      break;
    case 'email':
      property.type = 'string';
      property.format = 'email';
      property.maxLength = 255;
      break;
    case 'number':
    case 'integer':
      property.type = field.type === 'integer' ? 'integer' : 'number';
      if (field.min !== undefined) property.minimum = field.min;
      if (field.max !== undefined) property.maximum = field.max;
      break;
    case 'boolean':
      property.type = 'boolean';
      break;
    case 'date':
      property.type = 'string';
      property.format = 'date';
      break;
    case 'timestamp':
      property.type = 'string';
      property.format = 'date-time';
      break;
    case 'enum':
      property.type = 'string';
      property.enum = field.values || [];
      break;
    case 'identifier':
      property.type = 'string';
      property.format = 'uuid';
      break;
    default:
      property.type = 'string';
  }

  return property;
}

/**
 * Generate OpenAPI input schema (for request bodies)
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Object} expandedValidation - Validation config
 * @returns {Object} Input schema
 */
function generateInputSchema(entityName, expandedFields, expandedValidation) {
  const properties = {};
  const required = [];

  for (const field of expandedFields) {
    if (field.generated) continue; // Skip generated fields

    const property = fieldToOpenAPIProperty(field, expandedValidation);
    properties[field.name] = property;

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Generate GraphQL schema for entity
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Array} expandedRelationships - Relationship definitions
 * @returns {Object} GraphQL schema
 */
function generateGraphQLSchema(entityName, expandedFields, expandedRelationships) {
  const pluralName = camelCasePlural(entityName);

  return {
    type: entityName,
    queries: [
      {
        name: camelCase(entityName),
        args: [{ name: 'id', type: 'ID!' }],
        returnType: entityName,
        description: `Get ${entityName} by ID`,
      },
      {
        name: pluralName,
        args: [
          { name: 'filter', type: `${entityName}Filter` },
          { name: 'limit', type: 'Int' },
          { name: 'offset', type: 'Int' },
        ],
        returnType: `[${entityName}!]!`,
        description: `List ${camelCasePlural(entityName)}`,
      },
    ],
    mutations: [
      {
        name: `create${entityName}`,
        args: [{ name: 'input', type: `${entityName}Input!` }],
        returnType: entityName,
        description: `Create ${entityName}`,
      },
      {
        name: `update${entityName}`,
        args: [
          { name: 'id', type: 'ID!' },
          { name: 'input', type: `${entityName}Input!` },
        ],
        returnType: entityName,
        description: `Update ${entityName}`,
      },
      {
        name: `delete${entityName}`,
        args: [{ name: 'id', type: 'ID!' }],
        returnType: 'Boolean!',
        description: `Delete ${entityName}`,
      },
    ],
    fields: expandedFields.map(f => ({
      name: f.name,
      type: fieldToGraphQLType(f),
      description: f.description,
    })),
    relationships: expandedRelationships.map(r => ({
      name: r.name,
      type: r.target,
      cardinality: r.type,
      description: r.description,
    })),
  };
}

/**
 * Convert field type to GraphQL type
 * @param {Object} field - Field definition
 * @returns {string} GraphQL type
 */
function fieldToGraphQLType(field) {
  let baseType;

  switch (field.type) {
    case 'string':
    case 'email':
      baseType = 'String';
      break;
    case 'number':
      baseType = 'Float';
      break;
    case 'integer':
      baseType = 'Int';
      break;
    case 'boolean':
      baseType = 'Boolean';
      break;
    case 'date':
    case 'timestamp':
      baseType = 'DateTime';
      break;
    case 'enum':
      baseType = 'String';
      break;
    case 'identifier':
      baseType = 'ID';
      break;
    default:
      baseType = 'String';
  }

  return field.required ? `${baseType}!` : baseType;
}

/**
 * Generate REST contract for entity
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Array} expandedRelationships - Relationship definitions
 * @returns {Object} REST contract
 */
function generateRESTContract(entityName, expandedFields, expandedRelationships) {
  return {
    baseRoute: `/${camelCasePlural(entityName)}`,
    operations: [
      {
        operationId: `create${entityName}`,
        method: 'POST',
        path: '/',
        description: `Create new ${entityName}`,
        requestBody: `${entityName}Input`,
        responseSchema: `${entityName}Response`,
        statusCodes: [201, 400, 401, 403, 500],
      },
      {
        operationId: `get${entityName}`,
        method: 'GET',
        path: '/:id',
        description: `Get ${entityName} by ID`,
        responseSchema: `${entityName}Response`,
        statusCodes: [200, 404, 401, 500],
      },
      {
        operationId: `list${camelCasePlural(entityName)}`,
        method: 'GET',
        path: '/',
        description: `List ${camelCasePlural(entityName)}`,
        queryParams: [
          { name: 'filter', type: 'object', description: 'Filter criteria' },
          { name: 'sort', type: 'string', description: 'Sort order' },
          { name: 'limit', type: 'integer', default: 20 },
          { name: 'offset', type: 'integer', default: 0 },
        ],
        responseSchema: `${entityName}Response[]`,
        statusCodes: [200, 400, 401, 500],
      },
      {
        operationId: `update${entityName}`,
        method: 'PUT',
        path: '/:id',
        description: `Update ${entityName}`,
        requestBody: `${entityName}Input`,
        responseSchema: `${entityName}Response`,
        statusCodes: [200, 400, 401, 404, 500],
      },
      {
        operationId: `delete${entityName}`,
        method: 'DELETE',
        path: '/:id',
        description: `Delete ${entityName}`,
        statusCodes: [204, 401, 404, 500],
      },
    ],
  };
}

/**
 * Generate DTO schemas for entity
 * @param {string} entityName - Entity name
 * @param {Array} expandedFields - Field definitions
 * @param {Array} expandedRelationships - Relationship definitions
 * @returns {Object} DTO definitions
 */
function generateDTOSchemas(entityName, expandedFields, expandedRelationships) {
  return {
    entity: {
      name: `${entityName}DTO`,
      description: `Data Transfer Object for ${entityName}`,
      fields: expandedFields
        .filter(f => !f.generated)
        .map(f => ({
          name: f.name,
          type: f.type,
          required: f.required,
          description: f.description,
        })),
    },
    createRequest: {
      name: `Create${entityName}Request`,
      description: `Request DTO for creating ${entityName}`,
      fields: expandedFields
        .filter(f => !f.generated && !f.readOnly)
        .map(f => ({
          name: f.name,
          type: f.type,
          required: f.required,
        })),
    },
    updateRequest: {
      name: `Update${entityName}Request`,
      description: `Request DTO for updating ${entityName}`,
      fields: expandedFields
        .filter(f => !f.generated && !f.readOnly)
        .map(f => ({
          name: f.name,
          type: f.type,
          required: false, // Updates typically make all fields optional
        })),
    },
    response: {
      name: `${entityName}Response`,
      description: `Response DTO for ${entityName}`,
      fields: expandedFields.map(f => ({
        name: f.name,
        type: f.type,
        description: f.description,
      })),
    },
  };
}

/**
 * Generate error response contracts
 * @returns {Object} Error response definitions
 */
function generateErrorContracts() {
  return {
    badRequest: {
      status: 400,
      description: 'Bad Request',
      schema: {
        code: 'BAD_REQUEST',
        message: 'string',
        errors: [{ field: 'string', message: 'string' }],
      },
    },
    unauthorized: {
      status: 401,
      description: 'Unauthorized',
      schema: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    },
    forbidden: {
      status: 403,
      description: 'Forbidden',
      schema: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      },
    },
    notFound: {
      status: 404,
      description: 'Not Found',
      schema: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    },
    conflict: {
      status: 409,
      description: 'Conflict',
      schema: {
        code: 'CONFLICT',
        message: 'Resource conflict',
      },
    },
    internalServerError: {
      status: 500,
      description: 'Internal Server Error',
      schema: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}

/**
 * Helper: Convert to camelCase
 * @param {string} str - String to convert
 * @returns {string} camelCase string
 */
function camelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Helper: Convert to camelCase plural
 * @param {string} str - String to convert
 * @returns {string} camelCase plural string
 */
function camelCasePlural(str) {
  return camelCase(str) + 's';
}

// Export helper functions for testing and external use
export {
  generateEndpoints,
  generateOpenAPIContract,
  generateGraphQLSchema,
  generateRESTContract,
  generateDTOSchemas,
  generateErrorContracts,
};
