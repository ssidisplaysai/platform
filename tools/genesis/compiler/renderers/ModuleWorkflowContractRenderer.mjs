/**
 * ModuleWorkflowContractRenderer - Renders workflow contracts to JSON
 *
 * Generates standalone workflow contract JSON files from ModuleBlueprint.
 *
 * Purpose:
 *   - Render workflow definitions to JSON contracts
 *   - Validate workflow structure
 *   - Output standalone workflow files
 *   - Maintain consistency with other contract renderers
 *
 * Output:
 *   - workflow.json files per module
 *   - Standalone workflow contract definitions
 *   - Metadata and versioning
 *
 * @module tools/genesis/compiler/renderers/ModuleWorkflowContractRenderer
 */

/**
 * Generate workflow contract from ModuleBlueprint
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {string} Workflow contract JSON string
 */
export function generateWorkflowContract(blueprint) {
  if (!blueprint.workflow) {
    return JSON.stringify({
      $schema: 'module-workflow.schema.json',
      version: '1.0.0',
      generated: new Date().toISOString(),
      module: blueprint.module.id,
      workflow: {
        id: blueprint.module.id,
        name: `${blueprint.module.name} Workflows`,
        namespace: blueprint.module.namespace,
        workflows: [],
        roleActions: {},
        hooks: []
      },
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    }, null, 2);
  }

  return JSON.stringify({
    $schema: 'module-workflow.schema.json',
    version: '1.0.0',
    generated: new Date().toISOString(),
    module: blueprint.module.id,
    workflow: {
      id: blueprint.workflow.module,
      name: `${blueprint.module.name} Workflows`,
      namespace: blueprint.module.namespace,
      description: `Workflow definitions for ${blueprint.module.name} module`,
      
      // Workflow definitions
      workflows: blueprint.workflow.workflows || [],
      
      // Number of workflows by type
      summary: {
        total: (blueprint.workflow.workflows || []).length,
        primary: (blueprint.workflow.workflows || []).filter(w => w.type === 'primary').length,
        lifecycle: (blueprint.workflow.workflows || []).filter(w => w.type === 'lifecycle').length,
        approval: (blueprint.workflow.workflows || []).filter(w => w.type === 'approval').length,
        crossObject: (blueprint.workflow.workflows || []).filter(w => w.type === 'cross-object').length,
        eventTriggered: (blueprint.workflow.workflows || []).filter(w => w.type === 'event-triggered').length
      },
      
      // Role-based actions
      roleActions: blueprint.workflow.roleActions || {},
      
      // Event hooks
      hooks: blueprint.workflow.hooks || [],
      
      // Permissions model for workflows
      permissions: {
        workflows: {
          view: {
            roles: ['user', 'manager', 'admin'],
            description: 'View workflow definitions'
          },
          execute: {
            roles: ['user', 'manager', 'admin'],
            description: 'Execute workflows'
          },
          manage: {
            roles: ['manager', 'admin'],
            description: 'Manage and modify workflows'
          }
        },
        actions: {
          create: {
            roles: ['user', 'manager', 'admin'],
            description: 'Create new objects'
          },
          read: {
            roles: ['user', 'manager', 'admin'],
            description: 'Read objects'
          },
          update: {
            roles: ['user', 'manager', 'admin'],
            description: 'Update objects'
          },
          delete: {
            roles: ['manager', 'admin'],
            description: 'Delete objects'
          },
          approve: {
            roles: ['manager', 'admin'],
            description: 'Approve pending items'
          },
          reject: {
            roles: ['manager', 'admin'],
            description: 'Reject pending items'
          }
        }
      },
      
      // Workflow statistics
      statistics: {
        totalWorkflows: (blueprint.workflow.workflows || []).length,
        totalSteps: calculateTotalSteps(blueprint.workflow.workflows || []),
        totalRoles: Object.keys(blueprint.workflow.roleActions || {}).length,
        totalHooks: (blueprint.workflow.hooks || []).length,
        objectsWithLifecycle: getObjectsWithLifecycle(blueprint),
        objectsWithApprovals: getObjectsWithApprovals(blueprint),
        externalDependencies: (blueprint.relationships?.dependencies || []).length
      }
    },
    
    // Metadata
    metadata: {
      created: new Date().toISOString(),
      generator: 'ModuleWorkflowContractRenderer',
      phase: 'Workflow Intelligence',
      version: '1.0.0',
      module: {
        id: blueprint.module.id,
        name: blueprint.module.name,
        namespace: blueprint.module.namespace,
        tier: blueprint.module.tier,
        domain: blueprint.module.domain
      },
      statistics: {
        objects: (blueprint.members?.objects || []).length,
        relationships: (blueprint.relationships?.dependencies || []).length,
        capabilities: (blueprint.capabilities?.capabilities || []).length,
        permissions: (blueprint.permissions?.roles || []).length
      }
    }
  }, null, 2);
}

/**
 * Calculate total steps across all workflows
 *
 * @param {Array<Object>} workflows - Workflow definitions
 * @returns {number} Total step count
 */
function calculateTotalSteps(workflows) {
  return workflows.reduce((total, workflow) => {
    const steps = workflow.steps ? workflow.steps.length : 0;
    const stateMachineSteps = workflow.stateMachine?.states ? workflow.stateMachine.states.length : 0;
    return total + Math.max(steps, stateMachineSteps);
  }, 0);
}

/**
 * Get objects with lifecycle definitions
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {number} Count of objects with lifecycle
 */
function getObjectsWithLifecycle(blueprint) {
  if (!blueprint.members?.objects) return 0;
  return blueprint.members.objects.filter(obj => 
    obj.registration?.lifecycle?.states && obj.registration.lifecycle.states.length > 0
  ).length;
}

/**
 * Get objects with approval workflows
 *
 * @param {Object} blueprint - ModuleBlueprint
 * @returns {number} Count of objects with approvals
 */
function getObjectsWithApprovals(blueprint) {
  if (!blueprint.members?.objects) return 0;
  return blueprint.members.objects.filter(obj => {
    const states = obj.registration?.lifecycle?.states || [];
    return states.some(s => s.includes('pending') || s.includes('approval'));
  }).length;
}

export {};
