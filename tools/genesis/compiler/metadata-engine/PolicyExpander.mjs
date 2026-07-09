/**
 * PolicyExpander
 *
 * Expands policy metadata into access control policies.
 * Supports conditions based on lifecycle, ownership, scope, and approval status.
 *
 * @module tools/genesis/compiler/metadata-engine/PolicyExpander.mjs
 */

// Supported policy condition types
const CONDITION_TYPES = {
  OWNERSHIP: 'ownership',
  LIFECYCLE_STATE: 'lifecycle-state',
  COMPANY_SCOPE: 'company-scope',
  DEPARTMENT_SCOPE: 'department-scope',
  APPROVAL_STATUS: 'approval-status',
  SOFT_DELETE_STATUS: 'soft-delete-status',
  TIME_BASED: 'time-based',
  COMBINED: 'combined',
};

/**
 * Expand policy metadata from entity YAML
 * @param {Object} policyMetadata - Policy config from entity YAML
 * @param {Object} lifecycleMetadata - Lifecycle config (for state-based policies)
 * @returns {Object} Expanded policies structure
 */
export function expandPolicies(policyMetadata, lifecycleMetadata) {
  const policies = {
    all: [],
    byConditionType: {},
    byAction: {},
    byRole: {},
  };

  // Initialize condition type maps
  Object.values(CONDITION_TYPES).forEach(type => {
    policies.byConditionType[type] = [];
  });

  // Initialize action maps
  const actions = ['create', 'read', 'update', 'delete', 'archive', 'restore', 'search', 'export', 'approve', 'transition'];
  actions.forEach(action => {
    policies.byAction[action] = [];
  });

  // Parse custom policies from YAML
  if (policyMetadata && Array.isArray(policyMetadata)) {
    policyMetadata.forEach((policy, index) => {
      const expandedPolicy = expandSinglePolicy(policy, index);
      policies.all.push(expandedPolicy);
      
      // Index by condition type
      if (expandedPolicy.conditions) {
        expandedPolicy.conditions.forEach(condition => {
          if (!policies.byConditionType[condition.type]) {
            policies.byConditionType[condition.type] = [];
          }
          policies.byConditionType[condition.type].push(expandedPolicy);
        });
      }
      
      // Index by action
      if (expandedPolicy.actions) {
        expandedPolicy.actions.forEach(action => {
          if (!policies.byAction[action]) {
            policies.byAction[action] = [];
          }
          policies.byAction[action].push(expandedPolicy);
        });
      }
      
      // Index by role
      if (expandedPolicy.roles) {
        expandedPolicy.roles.forEach(role => {
          if (!policies.byRole[role]) {
            policies.byRole[role] = [];
          }
          policies.byRole[role].push(expandedPolicy);
        });
      }
    });
  }

  // Generate lifecycle state-based policies
  if (lifecycleMetadata && lifecycleMetadata.states) {
    const lifecyclePolicies = generateLifecyclePolicies(lifecycleMetadata);
    lifecyclePolicies.forEach(policy => {
      policies.all.push(policy);
      
      if (policy.conditions) {
        policy.conditions.forEach(condition => {
          if (!policies.byConditionType[condition.type]) {
            policies.byConditionType[condition.type] = [];
          }
          policies.byConditionType[condition.type].push(policy);
        });
      }
    });
  }

  // Add default policies
  const defaultPolicies = generateDefaultPolicies();
  defaultPolicies.forEach(policy => {
    policies.all.push(policy);
    
    if (policy.conditions) {
      policy.conditions.forEach(condition => {
        if (!policies.byConditionType[condition.type]) {
          policies.byConditionType[condition.type] = [];
        }
        policies.byConditionType[condition.type].push(policy);
      });
    }
    
    if (policy.actions) {
      policy.actions.forEach(action => {
        if (!policies.byAction[action]) {
          policies.byAction[action] = [];
        }
        policies.byAction[action].push(policy);
      });
    }
  });

  return policies;
}

/**
 * Expand a single policy from YAML
 * @param {Object} policy - Policy definition
 * @param {number} index - Policy index
 * @returns {Object} Expanded policy
 */
function expandSinglePolicy(policy, index) {
  return {
    name: policy.name || `policy_${index}`,
    description: policy.description || '',
    roles: policy.roles || ['*'],
    actions: policy.actions || [],
    conditions: (policy.conditions || []).map(expandCondition),
    effect: policy.effect || 'allow',
    priority: policy.priority || 100 - index, // Earlier policies have higher priority
  };
}

/**
 * Expand a condition
 * @param {Object|string} condition - Condition definition
 * @returns {Object} Expanded condition
 */
function expandCondition(condition) {
  if (typeof condition === 'string') {
    return { type: condition };
  }
  return condition;
}

/**
 * Generate policies based on lifecycle states
 * @param {Object} lifecycleMetadata - Lifecycle metadata
 * @returns {Array<Object>} Lifecycle-based policies
 */
function generateLifecyclePolicies(lifecycleMetadata) {
  const policies = [];
  const states = Object.keys(lifecycleMetadata.states || {});

  // Policy: Cannot update archived records
  if (states.includes('ARCHIVED')) {
    policies.push({
      name: 'protect-archived',
      description: 'Prevent modifications to archived records',
      roles: ['*'],
      actions: ['update', 'delete', 'transition'],
      conditions: [
        { type: CONDITION_TYPES.LIFECYCLE_STATE, state: 'ARCHIVED' }
      ],
      effect: 'deny',
      priority: 50,
    });
  }

  // Policy: Cannot delete if soft-delete is enabled
  if (lifecycleMetadata.softDelete === true) {
    policies.push({
      name: 'soft-delete-policy',
      description: 'Enforce soft delete (mark as deleted, not remove)',
      roles: ['admin'],
      actions: ['delete'],
      conditions: [],
      effect: 'allow', // Allow soft delete for admin
      priority: 60,
    });
  }

  // Policy: Transition restrictions
  if (states.includes('DRAFT')) {
    policies.push({
      name: 'draft-restrictions',
      description: 'Limit operations on draft records',
      roles: ['owner', 'admin', 'manager'],
      actions: ['read', 'update', 'transition', 'delete'],
      conditions: [
        { type: CONDITION_TYPES.LIFECYCLE_STATE, state: 'DRAFT' }
      ],
      effect: 'allow',
      priority: 70,
    });
  }

  return policies;
}

/**
 * Generate default/universal policies
 * @returns {Array<Object>} Default policies
 */
function generateDefaultPolicies() {
  return [
    {
      name: 'admin-bypass',
      description: 'Admins can perform all actions',
      roles: ['admin'],
      actions: ['*'],
      conditions: [],
      effect: 'allow',
      priority: 100,
    },
    {
      name: 'owner-full-control',
      description: 'Owner has full control within scope',
      roles: ['owner'],
      actions: ['create', 'read', 'update', 'delete', 'archive', 'restore', 'search', 'export', 'transition'],
      conditions: [
        { type: CONDITION_TYPES.OWNERSHIP }
      ],
      effect: 'allow',
      priority: 90,
    },
    {
      name: 'viewer-read-only',
      description: 'Viewers can only read and search',
      roles: ['viewer'],
      actions: ['read', 'search'],
      conditions: [],
      effect: 'allow',
      priority: 20,
    },
    {
      name: 'deny-delete-others',
      description: 'Users cannot delete records they do not own',
      roles: ['*'],
      actions: ['delete'],
      conditions: [
        { type: CONDITION_TYPES.OWNERSHIP, negate: true }
      ],
      effect: 'deny',
      priority: 30,
    },
  ];
}

/**
 * Get all supported condition types
 * @returns {Array<string>} List of condition types
 */
export function getConditionTypes() {
  return Object.values(CONDITION_TYPES);
}

/**
 * Create an ownership condition
 * @param {string} [operator] - Comparison operator (equals, not_equals)
 * @returns {Object} Ownership condition
 */
export function createOwnershipCondition(operator = 'equals') {
  return {
    type: CONDITION_TYPES.OWNERSHIP,
    operator,
  };
}

/**
 * Create a lifecycle state condition
 * @param {string} state - State name
 * @param {string} [operator] - Comparison operator
 * @returns {Object} Lifecycle condition
 */
export function createLifecycleStateCondition(state, operator = 'equals') {
  return {
    type: CONDITION_TYPES.LIFECYCLE_STATE,
    state,
    operator,
  };
}

/**
 * Create a scope condition
 * @param {string} scopeType - Type (company, department)
 * @param {string} scopeValue - Scope value
 * @returns {Object} Scope condition
 */
export function createScopeCondition(scopeType, scopeValue) {
  const type = scopeType === 'company' ? 
    CONDITION_TYPES.COMPANY_SCOPE : 
    CONDITION_TYPES.DEPARTMENT_SCOPE;
  
  return {
    type,
    scopeValue,
  };
}

/**
 * Create an approval status condition
 * @param {string} status - Approval status (pending, approved, rejected)
 * @returns {Object} Approval condition
 */
export function createApprovalStatusCondition(status) {
  return {
    type: CONDITION_TYPES.APPROVAL_STATUS,
    status,
  };
}

/**
 * Create a soft delete status condition
 * @param {boolean} isDeleted - Whether to match deleted records
 * @returns {Object} Soft delete condition
 */
export function createSoftDeleteCondition(isDeleted = false) {
  return {
    type: CONDITION_TYPES.SOFT_DELETE_STATUS,
    isDeleted,
  };
}
