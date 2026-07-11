/**
 * PermissionExpander
 *
 * Expands permission metadata into a comprehensive permission model.
 * Supports role-based access control (RBAC) with policy conditions.
 *
 * @module tools/genesis/compiler/metadata-engine/PermissionExpander.mjs
 */

// Default generic actions supported by all entities
const GENERIC_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'archive',
  'restore',
  'search',
  'export',
  'approve',
  'transition',
];

// Default roles supported across enterprise
const SUPPORTED_ROLES = [
  'owner',      // Entity creator/owner
  'admin',      // Full system access
  'manager',    // Management privileges
  'sales',      // Sales-related access
  'operations', // Operations-related access
  'accounting', // Financial/accounting access
  'technician', // Technical/maintenance access
  'viewer',     // Read-only access
];

// Default role-to-action mappings (baseline)
const ROLE_ACTION_DEFAULTS = {
  owner: ['create', 'read', 'update', 'delete', 'archive', 'restore', 'search', 'export', 'approve', 'transition'],
  admin: ['create', 'read', 'update', 'delete', 'archive', 'restore', 'search', 'export', 'approve', 'transition'],
  manager: ['create', 'read', 'update', 'archive', 'search', 'export', 'approve', 'transition'],
  sales: ['create', 'read', 'update', 'search', 'export'],
  operations: ['read', 'update', 'search', 'export', 'transition'],
  accounting: ['read', 'search', 'export'],
  technician: ['read', 'update', 'search', 'transition'],
  viewer: ['read', 'search'],
};

/**
 * Expand permission metadata from entity YAML
 * @param {Object} permissionMetadata - Permission config from entity YAML
 * @returns {Object} Expanded permission model with roles, actions, and policies
 */
export function expandPermissions(permissionMetadata) {
  const permissions = {
    enabled: false,
    roles: [],
    actions: GENERIC_ACTIONS,
    roleActions: {},
    policies: [],
    roleDefaults: {},
  };

  // If permissions not configured, use defaults
  if (!permissionMetadata || !permissionMetadata.enabled) {
    return permissions;
  }

  permissions.enabled = true;

  // Parse roles from YAML (handle both array and string formats)
  let yamlRoles = permissionMetadata.roles || [];
  if (typeof yamlRoles === 'string') {
    yamlRoles = [yamlRoles];
  }
  if (!Array.isArray(yamlRoles)) {
    yamlRoles = [];
  }
  
  // Validate and expand roles
  const validRoles = yamlRoles.filter(role => 
    typeof role === 'string' && SUPPORTED_ROLES.includes(role.toLowerCase())
  );

  // Always include admin if not present
  if (!validRoles.includes('admin') && !validRoles.find(r => r.toLowerCase() === 'admin')) {
    validRoles.push('admin');
  }

  permissions.roles = validRoles;

  // Map roles to their actions
  validRoles.forEach(role => {
    const roleLower = role.toLowerCase();
    permissions.roleActions[roleLower] = ROLE_ACTION_DEFAULTS[roleLower] || ['read', 'search'];
    permissions.roleDefaults[roleLower] = {
      actions: permissions.roleActions[roleLower],
      description: getDefaultRoleDescription(roleLower),
    };
  });

  // Parse policies from YAML if present
  if (permissionMetadata.policies && Array.isArray(permissionMetadata.policies)) {
    permissions.policies = permissionMetadata.policies.map(policy => expandPolicy(policy));
  } else {
    // Generate default policies based on lifecycle support
    permissions.policies = generateDefaultPolicies();
  }

  return permissions;
}

/**
 * Expand a single policy definition
 * @param {Object} policy - Policy from YAML
 * @returns {Object} Expanded policy with conditions
 */
function expandPolicy(policy) {
  return {
    name: policy.name || 'default',
    description: policy.description || '',
    condition: policy.condition || null,
    roles: policy.roles || [],
    actions: policy.actions || [],
    effect: policy.effect || 'allow', // 'allow' or 'deny'
  };
}

/**
 * Generate default policies based on common patterns
 * @returns {Array<Object>} Default policies
 */
function generateDefaultPolicies() {
  return [
    {
      name: 'lifecycle-owner',
      description: 'Owner can perform all lifecycle transitions',
      condition: { type: 'ownership' },
      roles: ['owner'],
      actions: ['transition'],
      effect: 'allow',
    },
    {
      name: 'lifecycle-archived',
      description: 'Cannot modify archived records without restore',
      condition: { type: 'lifecycle-state', state: 'ARCHIVED' },
      roles: ['*'],
      actions: ['update', 'delete', 'transition'],
      effect: 'deny',
    },
    {
      name: 'admin-override',
      description: 'Admins can override most policies',
      condition: null,
      roles: ['admin'],
      actions: ['*'],
      effect: 'allow',
    },
  ];
}

/**
 * Get default description for a role
 * @param {string} role - Role name
 * @returns {string} Description
 */
function getDefaultRoleDescription(role) {
  const descriptions = {
    owner: 'Entity owner with full control',
    admin: 'Administrator with system-wide access',
    manager: 'Manager with supervisory permissions',
    sales: 'Sales representative with customer access',
    operations: 'Operations team with process access',
    accounting: 'Accounting/finance team with financial access',
    technician: 'Technician with maintenance access',
    viewer: 'Read-only viewer access',
  };
  return descriptions[role] || `User with ${role} role`;
}

/**
 * Check if a role is valid
 * @param {string} role - Role name
 * @returns {boolean} True if role is in supported list
 */
export function isValidRole(role) {
  return SUPPORTED_ROLES.includes(role.toLowerCase());
}

/**
 * Get all supported actions
 * @returns {Array<string>} List of generic actions
 */
export function getGenericActions() {
  return GENERIC_ACTIONS;
}

/**
 * Get all supported roles
 * @returns {Array<string>} List of supported roles
 */
export function getSupportedRoles() {
  return SUPPORTED_ROLES;
}

/**
 * Get default actions for a role
 * @param {string} role - Role name
 * @returns {Array<string>} Default actions for role
 */
export function getDefaultActionsForRole(role) {
  const roleLower = role.toLowerCase();
  return ROLE_ACTION_DEFAULTS[roleLower] || ['read', 'search'];
}
