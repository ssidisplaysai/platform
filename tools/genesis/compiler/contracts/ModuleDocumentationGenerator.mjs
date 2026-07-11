/**
 * ModuleDocumentationGenerator - Generates module documentation contracts
 *
 * Creates documentation metadata from module and member object data.
 * Includes object summaries, routes, APIs, permissions, and capabilities.
 *
 * Purpose:
 *   - Generate module overview documentation
 *   - Document owned objects and their roles
 *   - Summarize available routes and APIs
 *   - Document permissions and capabilities
 *   - Provide quick reference for module consumers
 *
 * Output:
 *   - Module overview
 *   - Object documentation (names, descriptions, routes, APIs)
 *   - Permissions summary
 *   - Capabilities summary
 *
 * @module tools/genesis/compiler/contracts/ModuleDocumentationGenerator
 */

/**
 * Generate documentation contracts for a module
 *
 * @param {Object} moduleMetadata - Module definition
 * @param {Array<Object>} memberObjects - Objects in module with metadata
 * @param {Object} memberObjectData - Object registration and module data
 * @param {Object} navigationContract - Navigation contract
 * @param {Object} apiContract - API contract
 * @returns {Object} Documentation contract
 */
export function generateDocumentation(
  moduleMetadata,
  memberObjects,
  memberObjectData,
  navigationContract,
  apiContract
) {
  const overview = generateOverview(moduleMetadata, memberObjects);
  const objects = generateObjectDocumentation(
    memberObjects,
    memberObjectData,
    navigationContract,
    apiContract
  );
  const permissions = generatePermissionsDocumentation(memberObjectData);
  const capabilities = generateCapabilitiesDocumentation(memberObjectData);

  return {
    overview,
    objects,
    permissions,
    capabilities
  };
}

/**
 * Generate module overview
 *
 * @param {Object} moduleMetadata - Module definition
 * @param {Array<string>} memberObjects - Objects in module
 * @returns {string} Overview text
 */
function generateOverview(moduleMetadata, memberObjects) {
  const objectsText = memberObjects.join(', ');
  return (
    `${moduleMetadata.description}\n\n` +
    `Domain: ${moduleMetadata.domain}\n` +
    `Tier: ${moduleMetadata.tier}\n` +
    `Objects: ${objectsText}`
  );
}

/**
 * Generate object documentation
 *
 * @param {Array<string>} memberObjects - Objects in module
 * @param {Object} memberObjectData - Object metadata
 * @param {Object} navigationContract - Navigation contract
 * @param {Object} apiContract - API contract
 * @returns {Array<Object>} Object documentation items
 */
function generateObjectDocumentation(
  memberObjects,
  memberObjectData,
  navigationContract,
  apiContract
) {
  const docs = [];

  for (const objectName of memberObjects) {
    const objectData = memberObjectData[objectName];
    const objectPath = objectName.toLowerCase();

    // Find related routes
    const routes = (navigationContract.routes || [])
      .filter(r => r.object === objectName)
      .map(r => r.path);

    // Find related APIs
    const apis = (apiContract.endpoints || [])
      .filter(e => e.object === objectName)
      .map(e => `${e.method} ${e.path}`);

    // Get object description from registration if available
    const description = objectData?.registration?.entity?.description || `${objectName} object`;

    docs.push({
      name: objectName,
      description,
      routes,
      apis,
      fields: objectData?.registration?.structure?.fields?.total || 0,
      relationships: objectData?.registration?.structure?.relationships?.total || 0,
      lifecycleStates: objectData?.registration?.lifecycle?.states || 0
    });
  }

  return docs;
}

/**
 * Generate permissions documentation
 *
 * @param {Object} memberObjectData - Object metadata
 * @returns {string} Permissions documentation
 */
function generatePermissionsDocumentation(memberObjectData) {
  const roleSet = new Set();
  const policySet = new Set();

  for (const objectName of Object.keys(memberObjectData)) {
    const objectData = memberObjectData[objectName];

    if (objectData?.registration?.permissions?.summary?.roles) {
      for (const role of objectData.registration.permissions.summary.roles) {
        roleSet.add(role);
      }
    }

    if (objectData?.registration?.permissions?.policies) {
      for (const policy of objectData.registration.permissions.policies) {
        policySet.add(policy.name);
      }
    }
  }

  const roles = Array.from(roleSet);
  const policies = Array.from(policySet);

  return (
    `Roles: ${roles.length > 0 ? roles.join(', ') : 'None configured'}\n` +
    `Policies: ${policies.length > 0 ? policies.join(', ') : 'None configured'}`
  );
}

/**
 * Generate capabilities documentation
 *
 * @param {Object} memberObjectData - Object metadata
 * @returns {string} Capabilities documentation
 */
function generateCapabilitiesDocumentation(memberObjectData) {
  const capabilityStatus = {
    audit: 0,
    search: 0,
    validation: 0,
    permissions: 0,
    events: 0
  };

  for (const objectName of Object.keys(memberObjectData)) {
    const objectData = memberObjectData[objectName];

    if (objectData?.registration?.capabilities?.capabilities) {
      for (const cap of objectData.registration.capabilities.capabilities) {
        if (capabilityStatus.hasOwnProperty(cap.name)) {
          if (cap.enabled) {
            capabilityStatus[cap.name] += 1;
          }
        }
      }
    }
  }

  const lines = Object.entries(capabilityStatus)
    .map(([name, count]) => `${name}: ${count > 0 ? 'enabled' : 'disabled'}`)
    .join('\n');

  return lines;
}

export {};
