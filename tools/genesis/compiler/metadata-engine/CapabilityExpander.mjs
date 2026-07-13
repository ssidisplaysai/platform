/**
 * CapabilityExpander
 *
 * Expands capability metadata to determine which features are enabled
 * and what code generation is needed.
 *
 * @module tools/genesis/compiler/metadata-engine/CapabilityExpander
 */

/**
 * Expand all capabilities from entity metadata
 * @param {Object} capabilitiesMetadata - Capabilities object from entity YAML
 * @returns {Object} Expanded capabilities with normalized structure
 */
export function expandCapabilities(capabilitiesMetadata) {
  const capabilities = {
    search: false,
    audit: false,
    validation: false,
    permissions: false,
    lifecycle: false,
    events: false,
    versioning: false,
    softDelete: false,
    automation: false,
  };

  if (!capabilitiesMetadata) {
    return capabilities;
  }

  // Parse enabled capabilities
  Object.entries(capabilitiesMetadata).forEach(([name, config]) => {
    if (config && config.enabled === true) {
      if (name === 'search') {
        capabilities.search = true;
        capabilities.searchFields = config.fields || [];
      }

      if (name === 'audit') {
        capabilities.audit = true;
        capabilities.auditTrackChanges = config.trackChanges !== false;
      }

      if (name === 'validation') {
        capabilities.validation = true;
      }

      if (name === 'permissions') {
        capabilities.permissions = true;
        // Normalize roles: handle string, array, undefined, empty
        let roles = config.roles || [];
        if (typeof roles === 'string') {
          // Handle inline array syntax like "[admin, manager]" or single role like "admin"
          if (roles.startsWith('[') && roles.endsWith(']')) {
            roles = roles.slice(1, -1).split(',').map(r => r.trim()).filter(r => r.length > 0);
          } else {
            roles = [roles];
          }
        }
        if (!Array.isArray(roles)) {
          roles = [];
        }
        // Ensure all roles are strings and deduplicate
        capabilities.permissionRoles = [...new Set(roles.map(r => String(r).toLowerCase()).filter(r => r))];
      }

      if (name === 'events') {
        capabilities.events = true;
        capabilities.eventTypes = config.types || [];
      }

      if (name === 'versioning') {
        capabilities.versioning = true;
      }

      if (name === 'automation') {
        capabilities.automation = true;
      }
    }
  });

  return capabilities;
}

/**
 * Get enabled capabilities for code generation
 * @param {Object} capabilities - Expanded capabilities
 * @returns {Array<string>} List of enabled capability names
 */
export function getEnabledCapabilities(capabilities) {
  return Object.entries(capabilities)
    .filter(([key, val]) => val === true && !key.startsWith('_'))
    .map(([key]) => key);
}

/**
 * Check if a specific capability is enabled
 * @param {Object} capabilities - Expanded capabilities
 * @param {string} capabilityName - Name of capability to check
 * @returns {boolean}
 */
export function hasCapability(capabilities, capabilityName) {
  return capabilities[capabilityName] === true;
}

/**
 * Get roles for permission-based generation
 * @param {Object} capabilities - Expanded capabilities
 * @returns {Array<string>} Roles if permissions enabled, empty array otherwise
 */
export function getPermissionRoles(capabilities) {
  if (!capabilities.permissions) {
    return [];
  }
  return capabilities.permissionRoles || ['admin', 'editor', 'viewer'];
}

/**
 * Get searchable field names
 * @param {Object} capabilities - Expanded capabilities
 * @returns {Array<string>} Searchable field names
 */
export function getSearchableFieldNames(capabilities) {
  if (!capabilities.search) {
    return [];
  }
  return capabilities.searchFields || [];
}
