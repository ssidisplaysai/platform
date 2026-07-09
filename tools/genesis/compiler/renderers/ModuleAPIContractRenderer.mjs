/**
 * ModuleAPIContractRenderer - Renders module API surface contract files
 *
 * Generates standalone API contract JSON files from ModuleBlueprint.
 * Provides API endpoints and relationships for integration and documentation.
 *
 * Purpose:
 *   - Generate standalone API surface manifests
 *   - Provide endpoint definitions for backend/API documentation
 *   - Define relationship endpoints
 *   - Enable API schema validation
 *   - Support API gateway configuration
 *
 * Output:
 *   - JSON file with API namespace, endpoints, and relationships
 *   - Schema reference for validation
 *   - Generation metadata
 *
 * @module tools/genesis/compiler/renderers/ModuleAPIContractRenderer
 */

/**
 * Generate an API contract JSON from ModuleBlueprint
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {string} JSON string of API contract
 */
export function generateAPIContract(blueprint) {
  const contract = {
    $schema: 'https://genesis.internal/schema/module-api-contract.json',
    version: '1.0.0',
    generated: blueprint.metadata.generated,

    module: {
      id: blueprint.module.id,
      name: blueprint.module.name,
      namespace: blueprint.module.namespace,
      description: blueprint.module.description
    },

    api: {
      namespace: blueprint.api.namespace,
      version: 'v1',
      description: `API surface for ${blueprint.module.name} module`,

      endpoints: groupEndpointsByObject(blueprint.api.endpoints),

      operations: {
        CRUD: blueprint.api.endpoints.filter(e =>
          ['list', 'create', 'read', 'update', 'delete'].includes(e.operation)
        ).length,
        search: blueprint.api.endpoints.filter(e => e.operation === 'search').length,
        total: blueprint.api.endpoints.length
      },

      relationships: blueprint.api.relationships || [],

      security: {
        schemes: [
          {
            type: 'bearerAuth',
            description: 'JWT Bearer token authentication'
          },
          {
            type: 'apiKey',
            description: 'API key authentication'
          }
        ],
        roles: blueprint.permissions.roles || [],
        defaultRole: 'user'
      },

      rateLimit: {
        requests: 1000,
        window: '1h',
        burst: 100
      }
    },

    endpoints: blueprint.api.endpoints.map(endpoint => ({
      method: endpoint.method,
      path: endpoint.path,
      description: endpoint.description,
      object: endpoint.object,
      operation: endpoint.operation,
      parameters: generateParameters(endpoint),
      responses: generateResponses(endpoint),
      tags: [blueprint.module.namespace, endpoint.object || 'module']
    })),

    schemas: generateSchemas(blueprint),

    examples: generateExamples(blueprint),

    metadata: {
      endpointCount: blueprint.api.endpoints.length,
      relationshipCount: blueprint.api.relationships.length,
      objectCount: blueprint.members.count,
      capabilityCount: blueprint.capabilities.summary.length
    }
  };

  return JSON.stringify(contract, null, 2);
}

/**
 * Group endpoints by object
 *
 * @param {Array<Object>} endpoints - API endpoints
 * @returns {Object} Endpoints grouped by object
 */
function groupEndpointsByObject(endpoints) {
  const grouped = {};

  for (const endpoint of endpoints) {
    const obj = endpoint.object || 'module';
    if (!grouped[obj]) {
      grouped[obj] = [];
    }
    grouped[obj].push({
      method: endpoint.method,
      path: endpoint.path,
      operation: endpoint.operation
    });
  }

  return grouped;
}

/**
 * Generate parameter definitions for endpoint
 *
 * @param {Object} endpoint - API endpoint
 * @returns {Array<Object>} Parameter definitions
 */
function generateParameters(endpoint) {
  const parameters = [];

  // Add ID parameter for detail endpoints
  if (endpoint.path.includes(':id')) {
    parameters.push({
      name: 'id',
      in: 'path',
      description: 'Resource ID',
      required: true,
      schema: { type: 'string' }
    });
  }

  // Add query parameters for list and search
  if (endpoint.operation === 'list' || endpoint.operation === 'search') {
    parameters.push(
      {
        name: 'skip',
        in: 'query',
        description: 'Number of items to skip',
        required: false,
        schema: { type: 'integer', default: 0 }
      },
      {
        name: 'limit',
        in: 'query',
        description: 'Maximum number of items to return',
        required: false,
        schema: { type: 'integer', default: 20, maximum: 100 }
      }
    );
  }

  // Add search parameter for search endpoints
  if (endpoint.operation === 'search') {
    parameters.push({
      name: 'q',
      in: 'query',
      description: 'Search query',
      required: false,
      schema: { type: 'string' }
    });
  }

  return parameters;
}

/**
 * Generate response definitions for endpoint
 *
 * @param {Object} endpoint - API endpoint
 * @returns {Object} Response definitions
 */
function generateResponses(endpoint) {
  return {
    '200': {
      description: 'Success',
      content: { 'application/json': { schema: { type: 'object' } } }
    },
    '201': {
      description: 'Created',
      content: { 'application/json': { schema: { type: 'object' } } }
    },
    '400': {
      description: 'Bad Request'
    },
    '401': {
      description: 'Unauthorized'
    },
    '403': {
      description: 'Forbidden'
    },
    '404': {
      description: 'Not Found'
    },
    '500': {
      description: 'Internal Server Error'
    }
  };
}

/**
 * Generate schema definitions for objects in module
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {Object} Schema definitions
 */
function generateSchemas(blueprint) {
  const schemas = {};

  for (const member of blueprint.members.objects) {
    schemas[member.name] = {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      },
      required: ['id', 'createdAt', 'updatedAt'],
      metadata: {
        fields: member.registration?.structure?.fields?.total || 0,
        relationships: member.registration?.structure?.relationships?.total || 0
      }
    };
  }

  return schemas;
}

/**
 * Generate API usage examples
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {Object} Example API calls
 */
function generateExamples(blueprint) {
  const examples = {
    listObjects: {
      description: 'List all objects in module',
      method: 'GET',
      path: `${blueprint.api.namespace}/search?skip=0&limit=20`
    },
    search: {
      description: 'Search module contents',
      method: 'GET',
      path: `${blueprint.api.namespace}/search?q=example`
    },
    getObject: {
      description: 'Get specific object by ID',
      method: 'GET',
      path: `${blueprint.api.namespace}/${blueprint.members.objects[0]?.name.toLowerCase()}s/123`
    }
  };

  return examples;
}

export {};
