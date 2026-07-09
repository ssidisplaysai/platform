/**
 * ModuleAPIGenerator - Generates module API surface contracts
 *
 * Creates API metadata from module and member object data.
 * Includes endpoints, namespaces, and relationship APIs.
 *
 * Purpose:
 *   - Define module API namespace and base paths
 *   - Generate CRUD endpoints for member objects
 *   - Generate relationship endpoints
 *   - Generate module-level search endpoint
 *   - Provide API surface for integration and consumption
 *
 * Output:
 *   - API namespace (e.g., /api/v1/crm)
 *   - Object endpoints (list, create, read, update, delete)
 *   - Relationship endpoints (cross-object)
 *   - Module-level search endpoint
 *
 * @module tools/genesis/compiler/contracts/ModuleAPIGenerator
 */

/**
 * Generate API contracts for a module
 *
 * @param {string} moduleId - Module ID (e.g., 'crm')
 * @param {Object} moduleMetadata - Module definition
 * @param {Array<Object>} memberObjects - Objects in module with metadata
 * @param {Object} memberObjectMetadata - Additional metadata by object name
 * @returns {Object} API contract
 */
export function generateAPI(moduleId, moduleMetadata, memberObjects, memberObjectMetadata = {}) {
  const namespace = moduleMetadata.namespace;
  const apiNamespace = `/api/v1/${namespace}`;

  // Generate endpoints
  const endpoints = generateEndpoints(apiNamespace, memberObjects, memberObjectMetadata);

  // Generate relationship endpoints
  const relationships = generateRelationshipEndpoints(apiNamespace, memberObjects, memberObjectMetadata);

  return {
    namespace: apiNamespace,
    endpoints,
    relationships
  };
}

/**
 * Generate API endpoints for member objects
 *
 * @param {string} apiNamespace - API namespace base path
 * @param {Array<string>} memberObjects - Objects in module
 * @param {Object} memberObjectMetadata - Additional metadata
 * @returns {Array<Object>} Array of endpoint definitions
 */
function generateEndpoints(apiNamespace, memberObjects, memberObjectMetadata = {}) {
  const endpoints = [];

  // CRUD endpoints for each object
  for (const objectName of memberObjects) {
    const objectPath = `${objectName.toLowerCase()}`;
    const pluralPath = objectPath + 's'; // Simple pluralization

    // LIST endpoint
    endpoints.push({
      method: 'GET',
      path: `${apiNamespace}/${pluralPath}`,
      description: `List all ${objectName} objects`,
      object: objectName,
      operation: 'list'
    });

    // CREATE endpoint
    endpoints.push({
      method: 'POST',
      path: `${apiNamespace}/${pluralPath}`,
      description: `Create a new ${objectName}`,
      object: objectName,
      operation: 'create'
    });

    // READ endpoint
    endpoints.push({
      method: 'GET',
      path: `${apiNamespace}/${pluralPath}/:id`,
      description: `Get a specific ${objectName} by ID`,
      object: objectName,
      operation: 'read'
    });

    // UPDATE endpoint
    endpoints.push({
      method: 'PUT',
      path: `${apiNamespace}/${pluralPath}/:id`,
      description: `Update a ${objectName}`,
      object: objectName,
      operation: 'update'
    });

    // DELETE endpoint
    endpoints.push({
      method: 'DELETE',
      path: `${apiNamespace}/${pluralPath}/:id`,
      description: `Delete a ${objectName}`,
      object: objectName,
      operation: 'delete'
    });

    // SEARCH endpoint (object-level)
    endpoints.push({
      method: 'GET',
      path: `${apiNamespace}/${pluralPath}/search`,
      description: `Search ${objectName} objects`,
      object: objectName,
      operation: 'search'
    });
  }

  // Module-level search endpoint
  endpoints.push({
    method: 'GET',
    path: `${apiNamespace}/search`,
    description: 'Search across all objects in module',
    object: null,
    operation: 'search'
  });

  return endpoints;
}

/**
 * Generate relationship endpoints
 *
 * @param {string} apiNamespace - API namespace base path
 * @param {Array<string>} memberObjects - Objects in module
 * @param {Object} memberObjectMetadata - Additional metadata
 * @returns {Array<Object>} Array of relationship endpoint definitions
 */
function generateRelationshipEndpoints(apiNamespace, memberObjects, memberObjectMetadata = {}) {
  const relationships = [];
  const processedRelationships = new Set();

  // Extract relationships from member object metadata
  for (const objectName of memberObjects) {
    const metadata = memberObjectMetadata[objectName];

    if (metadata && metadata.relationships) {
      for (const rel of metadata.relationships) {
        if (rel.targetModule === undefined || rel.targetModule === null) {
          // Internal relationship - both objects in same module
          const fromObj = objectName.toLowerCase();
          const toObj = (rel.target || '').toLowerCase();
          const relKey = `${fromObj}-${toObj}-${rel.name}`;

          if (!processedRelationships.has(relKey) && memberObjects.includes(rel.target)) {
            relationships.push({
              fromObject: objectName,
              toObject: rel.target,
              relationshipName: rel.name,
              path: `${apiNamespace}/${fromObj}s/:id/${rel.name || toObj + 's'}`
            });
            processedRelationships.add(relKey);
          }
        }
      }
    }
  }

  return relationships;
}

export {};
