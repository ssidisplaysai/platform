/**
 * ModuleAIAgentContractRenderer - Renders AI agent contracts to JSON
 *
 * Generates standalone AI agent contract JSON files from ModuleBlueprint.
 *
 * Purpose:
 *   - Render AI agent definitions to JSON contracts
 *   - Validate agent structure
 *   - Output standalone agent files
 *   - Maintain consistency with other contract renderers
 *
 * Output:
 *   - agent.json files per module
 *   - Standalone AI agent contract definitions
 *   - Metadata and versioning
 *
 * @module tools/genesis/compiler/renderers/ModuleAIAgentContractRenderer
 */

/**
 * Generate AI agent contract from ModuleBlueprint
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {string} AI agent contract JSON string
 */
export function generateAIAgentContract(blueprint) {
  if (!blueprint.aiAgent) {
    return JSON.stringify({
      $schema: 'module-ai-agent.schema.json',
      version: '1.0.0',
      generated: new Date().toISOString(),
      module: blueprint.module.id,
      aiAgent: {
        id: blueprint.module.id,
        name: `${blueprint.module.name} AI Agent`,
        namespace: blueprint.module.namespace,
        agents: [],
        capabilities: {},
        permissionModel: {}
      },
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    }, null, 2);
  }

  const agentCount = blueprint.aiAgent.agents?.length || 0;
  const primaryAgents = blueprint.aiAgent.agents?.filter(a => a.type === 'module-primary')?.length || 0;
  const specializedAgents = agentCount - primaryAgents;

  return JSON.stringify({
    $schema: 'module-ai-agent.schema.json',
    version: '1.0.0',
    generated: new Date().toISOString(),
    module: blueprint.module.id,
    
    aiAgent: {
      id: blueprint.aiAgent.module || blueprint.module.id,
      name: `${blueprint.module.name} AI Agents`,
      namespace: blueprint.module.namespace,
      description: `AI agent definitions for ${blueprint.module.name} module`,
      
      // AI agent definitions
      agents: blueprint.aiAgent.agents || [],
      
      // Summary
      summary: {
        total: agentCount,
        primary: primaryAgents,
        specialized: specializedAgents,
        objectSpecialists: specializedAgents,
        enabled: agentCount
      },
      
      // Agent capabilities
      capabilities: blueprint.aiAgent.agentCapabilities || {},
      
      // Permission model for agents
      permissionModel: blueprint.aiAgent.permissionModel || {
        roles: ['user', 'manager', 'admin'],
        defaultRole: 'user'
      },
      
      // Escalation rules
      escalationRules: blueprint.aiAgent.escalationRules || {},
      
      // Knowledge sources
      knowledgeSources: blueprint.aiAgent.knowledgeSources || [],
      
      // Agent constraints
      constraints: blueprint.aiAgent.constraints || {},
      
      // Safety and security
      security: {
        requiresAuthentication: true,
        requiresAudit: true,
        requiresRateLimit: true,
        canDeleteObjects: false,
        canModifyPermissions: false,
        canModifyRegistry: false,
        enforceModuleBoundaries: true,
        requiresApprovalFor: [
          'bulk-operations',
          'high-priority-automation',
          'sensitive-workflows'
        ]
      },
      
      // Integration with module components
      integration: {
        workflows: {
          availableWorkflows: (blueprint.workflow?.workflows || []).length,
          assistanceMode: 'auto-suggest-or-execute',
          requiresApprovalFor: ['approval-workflows']
        },
        automations: {
          triggerableAutomations: (blueprint.aiAgent.agentCapabilities?.automationTriggering || 0),
          requiresApprovalFor: ['critical-automations']
        },
        objects: {
          ownedObjects: (blueprint.aiAgent.agents?.[0]?.ownedObjects || []).length,
          canBulkUpdate: true,
          canExport: true
        }
      },
      
      // Permissions summary
      permissions: {
        agents: {
          view: {
            roles: ['user', 'manager', 'admin'],
            description: 'View AI agent definitions'
          },
          manage: {
            roles: ['manager', 'admin'],
            description: 'Manage AI agents'
          }
        },
        actions: {
          create: {
            roles: ['user', 'manager', 'admin'],
            requiresApproval: false,
            description: 'Create objects via agent'
          },
          update: {
            roles: ['user', 'manager', 'admin'],
            requiresApproval: false,
            description: 'Update objects via agent'
          },
          bulkOperation: {
            roles: ['manager', 'admin'],
            requiresApproval: true,
            description: 'Bulk operations via agent'
          },
          triggerAutomation: {
            roles: ['manager', 'admin'],
            requiresApproval: false,
            description: 'Trigger automations'
          },
          executeWorkflow: {
            roles: ['user', 'manager', 'admin'],
            requiresApproval: false,
            description: 'Execute workflows'
          }
        }
      },
      
      // Statistics
      statistics: {
        totalAgents: agentCount,
        totalAllowedActions: calculateTotalAllowedActions(blueprint.aiAgent.agents || []),
        totalForbiddenActions: calculateTotalForbiddenActions(blueprint.aiAgent.agents || []),
        totalApprovalRequirements: calculateTotalApprovalRequirements(blueprint.aiAgent.agents || []),
        averageConstraintsSeverity: 'high',
        completeness: 100
      }
    },
    
    // Knowledge context
    knowledgeContext: {
      module: blueprint.module.name,
      objects: (blueprint.members?.objects || []).map(o => o.name),
      workflows: (blueprint.workflow?.workflows || []).length,
      automations: (blueprint.automation?.automations || []).length,
      permissions: (blueprint.permissions?.roles || []).length,
      knowledgeItems: [
        `${blueprint.module.namespace}-overview`,
        `${blueprint.module.namespace}-objects`,
        `${blueprint.module.namespace}-workflows`,
        `${blueprint.module.namespace}-automations`,
        `${blueprint.module.namespace}-permissions`,
        `${blueprint.module.namespace}-errors`
      ]
    },
    
    // Operational guidelines
    operationalGuidelines: {
      initialization: [
        'Load module knowledge context on startup',
        'Initialize agent with user role and permissions',
        'Verify authentication token validity',
        'Load permission policies for current user'
      ],
      execution: [
        'Verify action is in allowed actions list',
        'Check user has required permissions',
        'Request approval if required',
        'Execute action with audit logging',
        'Handle errors with escalation'
      ],
      monitoring: [
        'Track agent action execution metrics',
        'Monitor error rates and types',
        'Alert on escalation triggers',
        'Audit all agent activities'
      ]
    },
    
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      phase: 'AI Agent Intelligence',
      compilerVersion: '0.5'
    }
  }, null, 2);
}

/**
 * Generate knowledge context JSON from ModuleBlueprint
 *
 * @param {Object} blueprint - ModuleBlueprint IR
 * @param {Object} knowledgeContext - Knowledge context from generator
 * @returns {string} Knowledge context JSON string
 */
export function generateKnowledgeContextContract(blueprint, knowledgeContext) {
  if (!knowledgeContext) {
    return JSON.stringify({
      $schema: 'module-knowledge-context.schema.json',
      version: '1.0.0',
      generated: new Date().toISOString(),
      module: blueprint.module.id,
      knowledgeContext: {
        id: blueprint.module.id,
        name: `${blueprint.module.name} Knowledge Context`,
        namespace: blueprint.module.namespace,
        overview: {},
        objects: [],
        apis: {},
        workflows: {},
        automations: {},
        permissions: {},
        errors: {},
        bestPractices: {}
      },
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    }, null, 2);
  }

  return JSON.stringify({
    $schema: 'module-knowledge-context.schema.json',
    version: '1.0.0',
    generated: new Date().toISOString(),
    module: blueprint.module.id,
    
    knowledgeContext: {
      id: blueprint.module.id,
      name: `${blueprint.module.name} Knowledge Context`,
      namespace: blueprint.module.namespace,
      description: `AI knowledge context for ${blueprint.module.name} module`,
      
      // Module overview
      overview: knowledgeContext.overview || {},
      
      // Object catalog
      objects: {
        total: (knowledgeContext.objects?.objects || []).length,
        catalog: knowledgeContext.objects?.objects || []
      },
      
      // API knowledge
      apis: knowledgeContext.apis || {},
      
      // Workflow knowledge
      workflows: knowledgeContext.workflows || {},
      
      // Automation knowledge
      automations: knowledgeContext.automations || {},
      
      // Permission knowledge
      permissions: knowledgeContext.permissions || {},
      
      // Error knowledge
      errors: knowledgeContext.errors || {},
      
      // Best practices
      bestPractices: knowledgeContext.bestPractices || {},
      
      // Learning resources
      resources: [
        {
          type: 'documentation',
          name: 'Module Overview',
          url: `/docs/modules/${blueprint.module.namespace}/overview.md`,
          audience: 'all-users'
        },
        {
          type: 'api-reference',
          name: 'REST API Reference',
          url: `/out/generated/modules/${blueprint.module.namespace}/${blueprint.module.namespace}.api.json`,
          audience: 'developers'
        },
        {
          type: 'workflow-guide',
          name: 'Workflow Patterns',
          url: `/out/generated/modules/${blueprint.module.namespace}/${blueprint.module.namespace}.workflow.json`,
          audience: 'operators'
        },
        {
          type: 'automation-guide',
          name: 'Automation Triggers',
          url: `/out/generated/modules/${blueprint.module.namespace}/${blueprint.module.namespace}.automation.json`,
          audience: 'operators'
        },
        {
          type: 'troubleshooting',
          name: 'Troubleshooting Guide',
          url: `/docs/modules/${blueprint.module.namespace}/troubleshooting.md`,
          audience: 'support-team'
        }
      ]
    },
    
    metadata: {
      created: new Date().toISOString(),
      version: '1.0.0',
      phase: 'AI Agent Intelligence',
      compilerVersion: '0.5',
      contentSize: Math.round(JSON.stringify(knowledgeContext).length / 1024) + ' KB'
    }
  }, null, 2);
}

/**
 * Helper: Calculate total allowed actions
 */
function calculateTotalAllowedActions(agents) {
  let total = 0;
  for (const agent of agents) {
    if (agent.allowedActions) {
      total += Array.isArray(agent.allowedActions) ? agent.allowedActions.length : 0;
    }
  }
  return total;
}

/**
 * Helper: Calculate total forbidden actions
 */
function calculateTotalForbiddenActions(agents) {
  let total = 0;
  for (const agent of agents) {
    if (agent.forbiddenActions) {
      total += Array.isArray(agent.forbiddenActions) ? agent.forbiddenActions.length : 0;
    }
  }
  return total;
}

/**
 * Helper: Calculate total approval requirements
 */
function calculateTotalApprovalRequirements(agents) {
  let total = 0;
  for (const agent of agents) {
    if (agent.requiresApproval) {
      total += Array.isArray(agent.requiresApproval) ? agent.requiresApproval.length : 0;
    }
  }
  return total;
}
