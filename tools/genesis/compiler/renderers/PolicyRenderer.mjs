/**
 * PolicyRenderer
 *
 * Generates access control policies and conditions from EnterpriseObjectBlueprint.
 * Documents policy conditions, role-based rules, and policy effects.
 *
 * Contract:
 * - No external imports
 * - All types explicitly defined inline
 * - Defensive normalization of role input (string, string[], undefined, empty)
 * - Deterministic role and policy ordering (alphabetical)
 * - Immutable output via Object.freeze()
 * - Self-contained generation from blueprint metadata only
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: Markdown documentation of policies
 *
 * @module tools/genesis/compiler/renderers/PolicyRenderer.mjs
 */

// ---------------------------------------------------------------------------
// Utility: Normalize roles to array
// ---------------------------------------------------------------------------

/**
 * Normalize roles into canonical array format
 * Handles: string, string[], undefined, empty, null
 * @param {unknown} input - Input to normalize
 * @returns {readonly string[]} Normalized sorted roles
 */
function normalizeRoles(input) {
  if (input === undefined || input === null) {
    return [];
  }

  // Handle string (including inline array syntax "[admin,manager]")
  if (typeof input === 'string') {
    if (input.startsWith('[') && input.endsWith(']')) {
      // Inline array: "[admin, manager, viewer]"
      const parsed = input.slice(1, -1).split(',').map(r => r.trim()).filter(r => r.length > 0);
      return Object.freeze(parsed.sort());
    }
    // Single role as string
    return Object.freeze([input.toLowerCase()]);
  }

  // Handle array
  if (Array.isArray(input)) {
    const normalized = input
      .map(r => typeof r === 'string' ? r.toLowerCase() : String(r))
      .filter(r => r.length > 0);
    // Remove duplicates and sort
    return Object.freeze([...new Set(normalized)].sort());
  }

  // Default: empty array
  return [];
}

/**
 * Normalize actions to array
 * @param {unknown} input - Input to normalize
 * @returns {readonly string[]} Normalized sorted actions
 */
function normalizeActions(input) {
  if (input === undefined || input === null) {
    return [];
  }

  // Handle string (including inline array syntax)
  if (typeof input === 'string') {
    if (input.startsWith('[') && input.endsWith(']')) {
      const parsed = input.slice(1, -1).split(',').map(a => a.trim()).filter(a => a.length > 0);
      return Object.freeze(parsed.sort());
    }
    return Object.freeze([input]);
  }

  // Handle array
  if (Array.isArray(input)) {
    const normalized = input.map(a => typeof a === 'string' ? a : String(a));
    return Object.freeze([...new Set(normalized)].sort());
  }

  return [];
}

/**
 * Normalize policies to array with safe field access
 * @param {unknown} input - Input to normalize
 * @returns {readonly Object[]} Normalized policies
 */
function normalizePolicies(input) {
  if (input === undefined || input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    return [];
  }

  return Object.freeze(input.map(p => ({
    name: String(p.name || 'unknown'),
    description: String(p.description || ''),
    roles: normalizeRoles(p.roles),
    actions: normalizeActions(p.actions),
    effect: String(p.effect || 'allow').toLowerCase(),
    conditions: p.conditions || [],
    priority: typeof p.priority === 'number' ? p.priority : 0,
  })).sort((a, b) => a.name.localeCompare(b.name)));
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

/**
 * Generate policy documentation from blueprint
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated Markdown policy documentation
 */
export function generatePolicies(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for policy documentation generation');
  }

  const entityName = blueprint.metadata.entity;

  // Normalize all inputs defensively
  const roles = normalizeRoles(blueprint.permissions?.roles);
  const actions = normalizeActions(blueprint.permissions?.actions);
  const policies = normalizePolicies(blueprint.policies?.all);
  const byConditionType = blueprint.policies?.byConditionType || {};
  const byRole = blueprint.policies?.byRole || {};
  const lifecycle = blueprint.lifecycle?.states || {};

  const lines = [];

  // ── Title and Header ────────────────────────────────────────────────────
  lines.push(`# ${entityName} Access Control Policies`);
  lines.push('');
  lines.push('> Auto-generated access control policies from EnterpriseObjectBlueprint.');
  lines.push('');

  // ── Overview ─────────────────────────────────────────────────────────────
  lines.push('## Overview');
  lines.push('');
  lines.push(`This document describes the access control policies for the **${entityName}** entity.`);
  lines.push('Policies define conditions under which specific roles can perform specific actions.');
  lines.push('');

  // ── Supported Actions ────────────────────────────────────────────────────
  lines.push('## Supported Actions');
  lines.push('');
  lines.push('The following actions are supported for this entity:');
  lines.push('');
  
  if (actions.length > 0) {
    Array.from(actions).sort().forEach(action => {
      lines.push(`- \`${action}\` - ${formatActionDescription(action)}`);
    });
  } else {
    lines.push('- (no actions defined)');
  }
  lines.push('');

  // ── Supported Roles ──────────────────────────────────────────────────────
  lines.push('## Supported Roles');
  lines.push('');
  lines.push('The following roles can interact with this entity:');
  lines.push('');
  
  if (roles.length > 0) {
    // Ensure roles are sorted for determinism
    Array.from(roles).sort().forEach(role => {
      lines.push(`- \`${role}\` - ${getRoleDescription(role)}`);
    });
  } else {
    lines.push('- (no roles defined)');
  }
  lines.push('');

  // ── All Policies ─────────────────────────────────────────────────────────
  if (policies.length > 0) {
    lines.push('## Policies');
    lines.push('');
    lines.push('### All Policies');
    lines.push('');
    lines.push('| Name | Description | Roles | Actions | Effect |');
    lines.push('|------|-------------|-------|---------|--------|');
    
    policies.forEach(policy => {
      const rolesStr = policy.roles && policy.roles.length > 0
        ? Array.from(policy.roles).sort().join(', ')
        : '*';
      const actionsStr = policy.actions && policy.actions.length > 0
        ? Array.from(policy.actions).sort().slice(0, 3).join(', ') + (policy.actions.length > 3 ? ', ...' : '')
        : '*';
      const effectBadge = policy.effect === 'allow' ? '✓ Allow' : '✗ Deny';
      lines.push(`| \`${policy.name}\` | ${policy.description} | ${rolesStr} | ${actionsStr} | ${effectBadge} |`);
    });
    lines.push('');
  }

  // ── Policies by Condition Type ───────────────────────────────────────────
  if (Object.keys(byConditionType).length > 0) {
    lines.push('### Policies by Condition Type');
    lines.push('');
    
    const sortedTypes = Object.keys(byConditionType).sort();
    sortedTypes.forEach(type => {
      const typePolicies = byConditionType[type];
      if (!Array.isArray(typePolicies) || typePolicies.length === 0) return;
      
      lines.push(`#### ${formatConditionType(type)}`);
      lines.push('');
      
      // Sort policies by name for determinism
      const sortedPolicies = Array.from(typePolicies).sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      );
      
      sortedPolicies.forEach(policy => {
        lines.push(`**${policy.name || 'Unknown'}**`);
        lines.push(`- Description: ${policy.description || 'N/A'}`);
        
        const policyRoles = normalizeRoles(policy.roles);
        lines.push(`- Roles: ${policyRoles.length > 0 ? Array.from(policyRoles).sort().join(', ') : 'All'}`);
        
        const policyActions = normalizeActions(policy.actions);
        lines.push(`- Actions: ${policyActions.length > 0 ? Array.from(policyActions).sort().join(', ') : 'All'}`);
        
        lines.push(`- Effect: ${policy.effect || 'unknown'}`);
        lines.push(`- Priority: ${policy.priority || 'N/A'}`);
        lines.push('');
      });
    });
  }

  // ── Policies by Role ─────────────────────────────────────────────────────
  if (Object.keys(byRole).length > 0) {
    lines.push('### Policies by Role');
    lines.push('');
    
    const sortedRoleKeys = Object.keys(byRole).sort();
    sortedRoleKeys.forEach(role => {
      const rolePolicies = byRole[role];
      if (!Array.isArray(rolePolicies)) return;
      
      lines.push(`#### ${formatRoleName(role)}`);
      lines.push('');
      
      if (rolePolicies.length === 0) {
        lines.push('No specific policies defined.');
      } else {
        lines.push('| Policy | Actions | Effect |');
        lines.push('|--------|---------|--------|');
        
        const sortedPolicies = Array.from(rolePolicies).sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''))
        );
        
        sortedPolicies.forEach(policy => {
          const policyActions = normalizeActions(policy.actions);
          const actionsStr = policyActions.length > 0
            ? Array.from(policyActions).sort().slice(0, 3).join(', ') + (policyActions.length > 3 ? ', ...' : '')
            : '*';
          const effectBadge = policy.effect === 'allow' ? '✓ Allow' : '✗ Deny';
          lines.push(`| ${policy.name || 'Unknown'} | ${actionsStr} | ${effectBadge} |`);
        });
      }
      lines.push('');
    });
  }

  // ── Lifecycle-based Access Control ───────────────────────────────────────
  if (Object.keys(lifecycle).length > 0) {
    lines.push('## Lifecycle-Based Access Control');
    lines.push('');
    lines.push('Access to this entity is influenced by its lifecycle state:');
    lines.push('');
    
    const lifecycleStates = Object.keys(lifecycle).sort();
    lifecycleStates.forEach(state => {
      lines.push(`### ${state}`);
      lines.push('');
      
      const applicablePolicies = policies.filter(p => {
        const conditions = p.conditions || [];
        return Array.isArray(conditions) && conditions.some(c =>
          c && c.type === 'lifecycle-state' && c.state === state
        );
      });
      
      if (applicablePolicies.length > 0) {
        lines.push('Applicable policies:');
        applicablePolicies.forEach(p => {
          const policyActions = normalizeActions(p.actions);
          const actionsStr = policyActions.length > 0
            ? Array.from(policyActions).sort().join(', ')
            : '*';
          lines.push(`- ${p.name}: ${p.effect === 'allow' ? 'Allowed' : 'Denied'} - ${actionsStr}`);
        });
      } else {
        lines.push('No specific restrictions for this state.');
      }
      lines.push('');
    });
  }

  // ── Field-Level Security ─────────────────────────────────────────────────
  lines.push('## Field-Level Security');
  lines.push('');
  lines.push('Certain fields may be restricted by role:');
  lines.push('');
  
  const sensitiveFields = ['taxId', 'ssn', 'password', 'apiKey', 'token'];
  const allFields = blueprint.fields?.all || [];
  const hasSensitiveFields = allFields.some(f => sensitiveFields.includes(f.name));
  
  if (hasSensitiveFields) {
    lines.push('| Field | Admin | Owner | Manager | Other |');
    lines.push('|-------|-------|-------|---------|-------|');
    
    allFields
      .filter(f => sensitiveFields.includes(f.name))
      .forEach(field => {
        lines.push(`| ${field.name} | Visible | Visible | Masked | Masked |`);
      });
  } else {
    lines.push('All fields are accessible according to role permissions.');
  }
  lines.push('');

  // ── Policy Evaluation Order ──────────────────────────────────────────────
  lines.push('## Policy Evaluation Order');
  lines.push('');
  lines.push('Policies are evaluated in priority order (highest priority first):');
  lines.push('');
  lines.push('1. Admin bypass policies (priority 100)');
  lines.push('2. Owner-specific policies (priority 90+)');
  lines.push('3. Custom policies (priority varies)');
  lines.push('4. Viewer-only policies (priority 20)');
  lines.push('5. Deny policies (default behavior)');
  lines.push('');

  // ── Implementation Notes ─────────────────────────────────────────────────
  lines.push('## Implementation Notes');
  lines.push('');
  lines.push('- Policies are enforced at multiple levels: service layer, API layer, and database layer');
  lines.push('- Admin users bypass most access control policies');
  lines.push('- Ownership is determined by the `owner` field on the entity');
  lines.push('- Time-based policies can restrict access to specific time windows');
  lines.push('- Scope-based policies can restrict access by company or department');
  lines.push('');

  return lines.join('\n');
}


// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Format action name for display
 * @param {string} action - Action name
 * @returns {string} Formatted description
 */
function formatActionDescription(action) {
  const descriptions = {
    create: 'Create a new entity',
    read: 'View entity details',
    update: 'Modify entity properties',
    delete: 'Delete the entity (soft delete)',
    archive: 'Archive the entity',
    restore: 'Restore an archived entity',
    search: 'Search for entities',
    export: 'Export entity data',
    approve: 'Approve entity changes',
    transition: 'Transition entity lifecycle state',
  };
  return descriptions[action] || action;
}

/**
 * Format condition type for display
 * @param {string} type - Condition type
 * @returns {string} Formatted type name
 */
function formatConditionType(type) {
  const names = {
    ownership: 'Ownership-Based Policies',
    'lifecycle-state': 'Lifecycle State Policies',
    'company-scope': 'Company Scope Policies',
    'department-scope': 'Department Scope Policies',
    'approval-status': 'Approval Status Policies',
    'soft-delete-status': 'Soft Delete Status Policies',
    'time-based': 'Time-Based Policies',
    combined: 'Combined Condition Policies',
  };
  return names[type] || type;
}

/**
 * Get role description
 * @param {string} role - Role name
 * @returns {string} Description
 */
function getRoleDescription(role) {
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
 * Format role name for display
 * @param {string} role - Role name
 * @returns {string} Formatted role name
 */
function formatRoleName(role) {
  return String(role).charAt(0).toUpperCase() + String(role).slice(1).replace(/[-_]/g, ' ');
}
