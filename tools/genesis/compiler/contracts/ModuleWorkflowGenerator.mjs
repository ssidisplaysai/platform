/**
 * ModuleWorkflowGenerator - Generates workflow contracts from module metadata
 *
 * Creates comprehensive workflow definitions from object lifecycles, events,
 * permissions, relationships, and primary actions.
 *
 * @module tools/genesis/compiler/contracts/ModuleWorkflowGenerator
 */

/**
 * Generate workflow contracts from module metadata
 *
 * @param {string} moduleId - Module identifier
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<string>} memberObjectNames - Member object names (strings)
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {Object} Workflow contract definition
 */
export function generateWorkflow(moduleId, moduleMetadata, memberObjectNames, blueprint) {
  const memberObjects = blueprint.members.objects || [];
  
  const workflows = {
    module: moduleId,
    version: '1.0.0',

    workflows: [
      ...generatePrimaryWorkflows(moduleMetadata, memberObjects, blueprint),
      ...generateLifecycleWorkflows(memberObjects, blueprint),
      ...generateApprovalWorkflows(memberObjects, blueprint),
      ...generateCrossObjectWorkflows(memberObjects, blueprint),
      ...generateEventTriggeredWorkflows(memberObjects, blueprint)
    ],

    roleActions: generateRoleBasedActions(memberObjects, blueprint),
    hooks: generateEventHooks(moduleMetadata, blueprint),

    metadata: {
      created: new Date().toISOString(),
      generator: 'ModuleWorkflowGenerator',
      phase: 'Workflow Intelligence',
      version: '1.0.0'
    }
  };

  return workflows;
}

function generatePrimaryWorkflows(moduleMetadata, memberObjects, blueprint) {
  const workflows = [];

  for (const obj of memberObjects) {
    const objName = obj.name;
    workflows.push({
      id: `workflow:${objName.toLowerCase()}-crud`,
      name: `${objName} CRUD Workflow`,
      description: `Create, Read, Update, Delete operations for ${objName}`,
      type: 'primary',
      trigger: 'manual',
      object: objName,
      steps: [
        {
          id: 'step:create',
          name: 'Create',
          action: 'create',
          description: `Create a new ${objName}`,
          endpoint: `/api/v1/${moduleMetadata.namespace}/${objName.toLowerCase()}s`,
          method: 'POST',
          requiredRoles: ['user', 'admin'],
          nextSteps: ['step:read']
        },
        {
          id: 'step:read',
          name: 'Read',
          action: 'read',
          description: `View ${objName} details`,
          endpoint: `/api/v1/${moduleMetadata.namespace}/${objName.toLowerCase()}s/:id`,
          method: 'GET',
          requiredRoles: ['user', 'admin'],
          nextSteps: ['step:update', 'step:delete']
        },
        {
          id: 'step:update',
          name: 'Update',
          action: 'update',
          description: `Modify ${objName}`,
          endpoint: `/api/v1/${moduleMetadata.namespace}/${objName.toLowerCase()}s/:id`,
          method: 'PUT',
          requiredRoles: ['user', 'admin', 'manager'],
          conditions: [
            { type: 'ownership', description: 'User must be owner or admin' },
            { type: 'status', description: 'Object must not be archived or deleted' }
          ],
          nextSteps: ['step:read']
        },
        {
          id: 'step:delete',
          name: 'Delete',
          action: 'delete',
          description: `Remove ${objName}`,
          endpoint: `/api/v1/${moduleMetadata.namespace}/${objName.toLowerCase()}s/:id`,
          method: 'DELETE',
          requiredRoles: ['admin', 'manager'],
          conditions: [{ type: 'permission', description: 'User must have delete permission' }],
          nextSteps: []
        }
      ]
    });
  }

  return workflows;
}

function generateLifecycleWorkflows(memberObjects, blueprint) {
  const workflows = [];

  if (!blueprint.lifecycle || !blueprint.lifecycle.states || blueprint.lifecycle.states.length === 0) {
    return workflows;
  }

  for (const obj of memberObjects) {
    const objName = obj.name;
    
    if (!obj.registration?.lifecycle?.states) {
      continue;
    }

    const lifecycleStates = obj.registration.lifecycle.states;

    workflows.push({
      id: `workflow:${objName.toLowerCase()}-lifecycle`,
      name: `${objName} Lifecycle Workflow`,
      description: `Lifecycle state transitions for ${objName}`,
      type: 'lifecycle',
      object: objName,
      stateMachine: {
        states: lifecycleStates.map((state, idx) => ({
          id: state,
          name: state.charAt(0).toUpperCase() + state.slice(1),
          type: getStateType(state),
          isInitial: idx === 0,
          isFinal: state === 'archived' || state === 'deleted',
          description: `${objName} is in ${state} state`
        })),
        transitions: generateStateTransitions(lifecycleStates, objName)
      },
      events: (obj.registration.lifecycle.events || []).map(event => ({
        id: `event:${event}`,
        name: event,
        trigger: event,
        description: `Triggered when ${event} occurs on ${objName}`,
        handlers: []
      }))
    });
  }

  return workflows;
}

function generateApprovalWorkflows(memberObjects, blueprint) {
  const workflows = [];

  for (const obj of memberObjects) {
    const objName = obj.name;
    
    if (!obj.registration?.lifecycle?.states) {
      continue;
    }

    const states = obj.registration.lifecycle.states;
    const hasApprovalState = states.some(s => s.includes('pending') || s.includes('approval'));

    if (hasApprovalState) {
      workflows.push({
        id: `workflow:${objName.toLowerCase()}-approval`,
        name: `${objName} Approval Workflow`,
        description: `Multi-step approval process for ${objName}`,
        type: 'approval',
        object: objName,
        steps: [
          {
            id: 'step:submit',
            name: 'Submit for Approval',
            actor: 'creator',
            action: 'submit',
            description: `Submit ${objName} for review`,
            targetState: 'pending_approval'
          },
          {
            id: 'step:review',
            name: 'Review',
            actor: 'reviewer',
            action: 'review',
            description: `Review ${objName}`,
            requiredRoles: ['manager', 'admin'],
            decisions: [
              {
                id: 'decision:approve',
                name: 'Approve',
                action: 'approve',
                targetState: 'approved',
                nextSteps: ['step:complete']
              },
              {
                id: 'decision:reject',
                name: 'Reject',
                action: 'reject',
                targetState: 'draft',
                nextSteps: ['step:submit'],
                comment: 'rejection_reason'
              }
            ]
          },
          {
            id: 'step:complete',
            name: 'Complete',
            actor: 'system',
            action: 'complete',
            description: `Mark ${objName} as approved`,
            targetState: 'active'
          }
        ],
        conditions: [
          { type: 'permission', description: 'Reviewer must have approval permission' },
          { type: 'state', description: 'Object must be in pending_approval state' }
        ]
      });
    }
  }

  return workflows;
}

function generateCrossObjectWorkflows(memberObjects, blueprint) {
  const workflows = [];

  if (!blueprint.relationships || blueprint.relationships.dependencies.length === 0) {
    return workflows;
  }

  const relationshipCount = blueprint.relationships.dependencies.length;
  if (relationshipCount > 0) {
    workflows.push({
      id: `workflow:cross-object`,
      name: 'Cross-Object Relationships',
      description: `Handle relationships and dependencies between objects`,
      type: 'cross-object',
      triggers: memberObjects.map(obj => ({
        object: obj.name,
        event: 'created',
        action: 'propagate'
      })),
      steps: [
        {
          id: 'step:validate-relationships',
          name: 'Validate Relationships',
          action: 'validate',
          description: 'Validate related objects exist',
          endpoint: `/api/v1/${blueprint.module.namespace}/validate-relationships`,
          method: 'POST'
        },
        {
          id: 'step:cascade-updates',
          name: 'Cascade Updates',
          action: 'cascade',
          description: 'Propagate changes to related objects',
          endpoint: `/api/v1/${blueprint.module.namespace}/cascade-updates`,
          method: 'POST',
          conditions: [
            { type: 'cascade_policy', description: 'Apply configured cascade policy' }
          ]
        }
      ]
    });
  }

  return workflows;
}

function generateEventTriggeredWorkflows(memberObjects, blueprint) {
  const workflows = [];

  if (!blueprint.lifecycle || !blueprint.lifecycle.events || blueprint.lifecycle.events.length === 0) {
    return workflows;
  }

  const eventWorkflows = {};

  for (const event of blueprint.lifecycle.events) {
    if (!eventWorkflows[event]) {
      eventWorkflows[event] = {
        id: `workflow:event-${event}`,
        name: `On ${event}`,
        description: `Workflow triggered by ${event} event`,
        type: 'event-triggered',
        trigger: event,
        action: 'automatic',
        steps: [
          {
            id: `step:${event}-notify`,
            name: `Notify on ${event}`,
            action: 'notify',
            description: `Send notifications when ${event} occurs`,
            handlers: [
              {
                id: `handler:email-${event}`,
                type: 'email',
                recipientRoles: ['admin', 'manager'],
                template: `${event}_notification`
              },
              {
                id: `handler:log-${event}`,
                type: 'log',
                level: 'info',
                message: `Event: ${event} occurred`
              }
            ]
          },
          {
            id: `step:${event}-audit`,
            name: `Audit ${event}`,
            action: 'audit',
            description: `Log event for audit trail`,
            endpoint: `/api/v1/${blueprint.module.namespace}/audit`,
            method: 'POST'
          }
        ]
      };

      workflows.push(eventWorkflows[event]);
    }
  }

  return workflows;
}

function generateRoleBasedActions(memberObjects, blueprint) {
  const roleActions = {};
  const roles = blueprint.permissions.roles || ['user', 'manager', 'admin'];

  for (const role of roles) {
    roleActions[role] = {
      role,
      description: `Actions available for ${role} role`,
      actions: []
    };

    if (role === 'admin') {
      roleActions[role].actions = [
        'create', 'read', 'update', 'delete',
        'approve', 'reject',
        'archive', 'restore',
        'manage_permissions', 'manage_workflows'
      ];
    } else if (role === 'manager') {
      roleActions[role].actions = [
        'create', 'read', 'update',
        'approve', 'reject',
        'manage_team'
      ];
    } else {
      roleActions[role].actions = [
        'create', 'read', 'update_own',
        'submit_for_approval'
      ];
    }

    roleActions[role].workflows = memberObjects.map(obj => {
      const objName = obj.name;
      return {
        object: objName,
        allowed_workflows: roleActions[role].actions.map(action => 
          `workflow:${objName.toLowerCase()}-${action}`
        ).filter(wf => wf)
      };
    });
  }

  return roleActions;
}

function generateEventHooks(moduleMetadata, blueprint) {
  const hooks = [];

  if (!blueprint.lifecycle || !blueprint.lifecycle.events) {
    return hooks;
  }

  for (const event of blueprint.lifecycle.events) {
    hooks.push({
      id: `hook:${event}`,
      event,
      namespace: `module.${moduleMetadata.namespace}`,
      description: `Hook for ${event} event in ${moduleMetadata.name}`,
      handlers: [
        {
          id: `handler:${event}-webhook`,
          type: 'webhook',
          method: 'POST',
          endpoint: `/webhooks/${moduleMetadata.namespace}/${event}`,
          async: true,
          retry: {
            enabled: true,
            maxAttempts: 3,
            backoffMs: 1000
          }
        },
        {
          id: `handler:${event}-audit`,
          type: 'audit',
          action: 'log',
          enabled: true
        }
      ],
      conditions: [
        { type: 'permission', description: 'Handler must have permission to process event' }
      ]
    });
  }

  return hooks;
}

function getStateType(state) {
  const stateName = state.toLowerCase();
  if (stateName === 'draft') return 'initial';
  if (stateName === 'active' || stateName === 'in_progress') return 'active';
  if (stateName === 'pending' || stateName.includes('pending')) return 'pending';
  if (stateName === 'completed' || stateName === 'approved') return 'completed';
  if (stateName === 'archived' || stateName === 'deleted') return 'terminal';
  return 'intermediate';
}

function generateStateTransitions(states, objectName) {
  const transitions = [];

  const transitionRules = {
    draft: ['in_progress', 'submitted'],
    submitted: ['draft', 'pending_approval'],
    pending_approval: ['draft', 'approved', 'rejected'],
    in_progress: ['completed', 'on_hold'],
    on_hold: ['in_progress', 'cancelled'],
    approved: ['in_progress', 'active'],
    active: ['on_hold', 'completed', 'archived'],
    completed: ['archived'],
    rejected: ['draft'],
    cancelled: ['archived'],
    archived: []
  };

  for (const state of states) {
    const nextStates = transitionRules[state] || [];
    const allowedNextStates = nextStates.filter(ns => states.includes(ns));

    for (const nextState of allowedNextStates) {
      transitions.push({
        from: state,
        to: nextState,
        action: `transition_to_${nextState}`,
        description: `Transition ${objectName} from ${state} to ${nextState}`,
        requiredRoles: getTransitionRoles(state, nextState),
        conditions: getTransitionConditions(state, nextState)
      });
    }
  }

  return transitions;
}

function getTransitionRoles(fromState, toState) {
  const roles = ['admin'];

  if (toState === 'approved' || toState === 'rejected') {
    roles.push('manager');
  }

  if (toState === 'active' || toState === 'archived') {
    roles.push('manager');
  }

  if (fromState === 'draft' || toState === 'draft') {
    roles.push('user');
  }

  return [...new Set(roles)];
}

function getTransitionConditions(fromState, toState) {
  const conditions = [];

  if (toState === 'approved' || toState === 'rejected') {
    conditions.push({
      type: 'permission',
      description: 'User must have approval permission'
    });
  }

  if (toState === 'archived') {
    conditions.push({
      type: 'state',
      description: 'Object must be in terminal state'
    });
  }

  if (fromState === 'pending_approval') {
    conditions.push({
      type: 'review',
      description: 'Review must be completed'
    });
  }

  return conditions;
}

export {};
