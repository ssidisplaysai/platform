/**
 * PermissionsRenderer
 *
 * Generates role-based access control (RBAC) permissions from EnterpriseObjectBlueprint.
 * Defines which roles can perform which actions on the entity.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: JSON permissions configuration
 *
 * @module tools/genesis/compiler/renderers/PermissionsRenderer
 */

/**
 * Generate permissions configuration
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated JSON permissions (can be parsed as object)
 */
export function generatePermissions(blueprint) {
  const entityName = blueprint.metadata.entity;
  const roles = blueprint.permissions.roles || ['admin'];
  const actions = blueprint.permissions.actions || ['create', 'read', 'update', 'delete', 'archive', 'restore', 'search', 'export', 'approve', 'transition'];
  const roleActions = blueprint.permissions.roleActions || {};
  const roleDefaults = blueprint.permissions.roleDefaults || {};
  const camelCase = blueprint.api.camelCase;

  // Build permission structure
  const permissions = {
    entity: entityName,
    resource: camelCase,
    description: `Permissions for ${entityName} entity`,
    generatedAt: new Date().toISOString(),
    permissions: {
      actions,
      roles,
      roleActions,
      roleDefaults,
    },
    roles: {},
  };

  // Generate role permissions from blueprint roleActions
  for (const role of roles) {
    const roleLower = role.toLowerCase();
    const roleDefaultInfo = roleDefaults[roleLower] || {};
    const roleActionList = roleActions[roleLower] || [];

    permissions.roles[roleLower] = {
      description: roleDefaultInfo.description || `${role} role`,
      actions: roleActionList,
      fields: '*', // All fields accessible by default
      fieldPermissions: getFieldPermissionsForRole(roleLower, blueprint.fields.all),
    };
  }

  // Return as formatted JSON string
  return JSON.stringify(permissions, null, 2);
}

/**
 * Get field-level permissions for a role
 * @param {string} role - Role name
 * @param {Array} fields - All fields in entity
 * @returns {Array} Field permissions
 */
function getFieldPermissionsForRole(role, fields) {
  const sensitiveFields = ['taxId', 'ssn', 'password', 'apiKey', 'token'];
  const maskedFields = fields
    .filter(f => sensitiveFields.includes(f.name))
    .map(f => f.name);

  if (maskedFields.length === 0) {
    return [];
  }

  // Admins see all, others see masked versions
  if (role === 'admin' || role === 'owner') {
    return [];
  }

  return maskedFields.map(f => ({
    field: f,
    action: 'mask',
    displayAs: '***',
  }));
}
