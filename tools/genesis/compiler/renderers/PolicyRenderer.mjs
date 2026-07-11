/**
 * PolicyRenderer
 *
 * Generates access control policies and conditions from EnterpriseObjectBlueprint.
 * Documents policy conditions, role-based rules, and policy effects.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: Markdown documentation of policies
 *
 * @module tools/genesis/compiler/renderers/PolicyRenderer.mjs
 */

/**
 * Generate policy documentation
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated Markdown policy documentation
 */
export function generatePolicies(blueprint) {
  const entityName = blueprint.metadata.entity;
  const policies = blueprint.policies?.all || [];
  const byConditionType = blueprint.policies?.byConditionType || {};
  const byRole = blueprint.policies?.byRole || {};
  const roles = blueprint.permissions?.roles || [];
  const actions = blueprint.permissions?.actions || [];
  const lifecycle = blueprint.lifecycle?.states || {};

  const lines = [];

  // Title
  lines.push(`# ${entityName} Access Control Policies`);
  lines.push('');
  lines.push('> Auto-generated access control policies from EnterpriseObjectBlueprint.');
  lines.push(`> Generated at ${new Date().toISOString()}`);
  lines.push('');

  // Overview section
  lines.push('## Overview');
  lines.push('');
  lines.push(`This document describes the access control policies for the **${entityName}** entity.`);
  lines.push('Policies define conditions under which specific roles can perform specific actions.');
  lines.push('');

  // Supported Actions section
  lines.push('## Supported Actions');
  lines.push('');
  lines.push('The following actions are supported for this entity:');
  lines.push('');
  actions.forEach(action => {
    lines.push(`- \`${action}\` - ${formatActionDescription(action)}`);
  });
  lines.push('');

  // Supported Roles section
  lines.push('## Supported Roles');
  lines.push('');
  lines.push('The following roles can interact with this entity:');
  lines.push('');
  roles.forEach(role => {
    lines.push(`- \`${role}\` - ${getRoleDescription(role)}`);
  });
  lines.push('');

  // All Policies section
  if (policies.length > 0) {
    lines.push('## Policies');
    lines.push('');
    lines.push('### All Policies');
    lines.push('');
    lines.push('| Name | Description | Roles | Actions | Effect |');
    lines.push('|------|-------------|-------|---------|--------|');
    
    policies.forEach(policy => {
      const rolesStr = (policy.roles || []).join(', ') || '*';
      const actionsStr = (policy.actions || []).slice(0, 3).join(', ') + (policy.actions && policy.actions.length > 3 ? ', ...' : '');
      const effectBadge = policy.effect === 'allow' ? '✓ Allow' : '✗ Deny';
      lines.push(`| \`${policy.name}\` | ${policy.description || ''} | ${rolesStr} | ${actionsStr} | ${effectBadge} |`);
    });
    lines.push('');
  }

  // Policies by Condition Type
  if (Object.keys(byConditionType).length > 0) {
    lines.push('### Policies by Condition Type');
    lines.push('');
    
    Object.entries(byConditionType).forEach(([type, typePolicies]) => {
      if (typePolicies.length === 0) return;
      
      lines.push(`#### ${formatConditionType(type)}`);
      lines.push('');
      
      typePolicies.forEach(policy => {
        lines.push(`**${policy.name}**`);
        lines.push(`- Description: ${policy.description || 'N/A'}`);
        lines.push(`- Roles: ${(policy.roles || []).join(', ') || 'All'}`);
        lines.push(`- Actions: ${(policy.actions || []).join(', ') || 'All'}`);
        lines.push(`- Effect: ${policy.effect}`);
        lines.push(`- Priority: ${policy.priority || 'N/A'}`);
        lines.push('');
      });
    });
  }

  // Policies by Role
  if (Object.keys(byRole).length > 0) {
    lines.push('### Policies by Role');
    lines.push('');
    
    Object.entries(byRole).forEach(([role, rolePolicies]) => {
      lines.push(`#### ${formatRoleName(role)}`);
      lines.push('');
      
      if (rolePolicies.length === 0) {
        lines.push('No specific policies defined.');
      } else {
        lines.push('| Policy | Actions | Effect |');
        lines.push('|--------|---------|--------|');
        
        rolePolicies.forEach(policy => {
          const actionsStr = (policy.actions || []).slice(0, 3).join(', ') + (policy.actions && policy.actions.length > 3 ? ', ...' : '');
          const effectBadge = policy.effect === 'allow' ? '✓ Allow' : '✗ Deny';
          lines.push(`| ${policy.name} | ${actionsStr} | ${effectBadge} |`);
        });
      }
      lines.push('');
    });
  }

  // Lifecycle-based Access Control
  if (Object.keys(lifecycle).length > 0) {
    lines.push('## Lifecycle-Based Access Control');
    lines.push('');
    lines.push('Access to this entity is influenced by its lifecycle state:');
    lines.push('');
    
    const lifecycleStates = Object.keys(lifecycle);
    lifecycleStates.forEach(state => {
      lines.push(`### ${state}`);
      lines.push('');
      const applicablePolicies = policies.filter(p => 
        p.conditions && p.conditions.some(c => c.type === 'lifecycle-state' && c.state === state)
      );
      
      if (applicablePolicies.length > 0) {
        lines.push('Applicable policies:');
        applicablePolicies.forEach(p => {
          lines.push(`- ${p.name}: ${p.effect === 'allow' ? 'Allowed' : 'Denied'} - ${p.actions.join(', ')}`);
        });
      } else {
        lines.push('No specific restrictions for this state.');
      }
      lines.push('');
    });
  }

  // Field-Level Security
  lines.push('## Field-Level Security');
  lines.push('');
  lines.push('Certain fields may be restricted by role:');
  lines.push('');
  
  const sensitiveFields = ['taxId', 'ssn', 'password', 'apiKey', 'token'];
  const hasSensitiveFields = blueprint.fields.all && blueprint.fields.all.some(f => sensitiveFields.includes(f.name));
  
  if (hasSensitiveFields) {
    lines.push('| Field | Admin | Owner | Manager | Other |');
    lines.push('|-------|-------|-------|---------|-------|');
    
    blueprint.fields.all
      .filter(f => sensitiveFields.includes(f.name))
      .forEach(field => {
        lines.push(`| ${field.name} | Visible | Visible | Masked | Masked |`);
      });
  } else {
    lines.push('All fields are accessible according to role permissions.');
  }
  lines.push('');

  // Policy Evaluation Order
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

  // Implementation Notes
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
    'ownership': 'Ownership-Based Policies',
    'lifecycle-state': 'Lifecycle State Policies',
    'company-scope': 'Company Scope Policies',
    'department-scope': 'Department Scope Policies',
    'approval-status': 'Approval Status Policies',
    'soft-delete-status': 'Soft Delete Status Policies',
    'time-based': 'Time-Based Policies',
    'combined': 'Combined Condition Policies',
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
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/[-_]/g, ' ');
}
