/**
 * ModuleAIAgentGenerator - Generates AI agent contracts from module metadata
 *
 * Creates comprehensive AI agent definitions from module metadata, objects,
 * workflows, automations, permissions, and events.
 *
 * Generates:
 *   - AI agent definitions (name, scope, capabilities)
 *   - Object ownership and boundaries
 *   - Allowed and forbidden actions
 *   - Permission constraints
 *   - Workflows the agent can assist with
 *   - Automations the agent can trigger
 *   - Required human approvals
 *   - Knowledge sources
 *   - Escalation rules
 *
 * @module tools/genesis/compiler/contracts/ModuleAIAgentGenerator
 */

/**
 * Generate AI agent contracts from module metadata
 *
 * @param {string} moduleId - Module identifier
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<Object>} memberObjects - Member objects with full data
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {Object} AI agent contract definition
 */
export function generateAIAgent(moduleId, moduleMetadata, memberObjects, blueprint) {
  const agents = [];
  
  // Generate a primary agent per module
  agents.push(generatePrimaryModuleAgent(moduleId, moduleMetadata, memberObjects, blueprint));

  // Generate specialized agents per domain/function if multiple objects
  if (memberObjects.length > 1) {
    agents.push(...generateSpecializedAgents(moduleId, moduleMetadata, memberObjects, blueprint));
  }

  const aiAgentContract = {
    module: moduleId,
    version: '1.0.0',
    
    agents,
    
    agentCapabilities: generateAgentCapabilities(memberObjects, blueprint),
    
    permissionModel: generatePermissionModel(blueprint),
    
    escalationRules: generateEscalationRules(moduleMetadata, blueprint),
    
    knowledgeSources: generateKnowledgeSources(moduleId, moduleMetadata, blueprint),
    
    constraints: generateAgentConstraints(moduleMetadata, blueprint),
    
    metadata: {
      created: new Date().toISOString(),
      generator: 'ModuleAIAgentGenerator',
      phase: 'AI Agent Intelligence',
      version: '1.0.0'
    }
  };

  return aiAgentContract;
}

/**
 * Generate primary module agent
 */
function generatePrimaryModuleAgent(moduleId, moduleMetadata, memberObjects, blueprint) {
  const objectNames = memberObjects.map(o => o.name);
  
  return {
    id: `agent:${moduleId}-primary`,
    name: `${moduleMetadata.name} Agent`,
    type: 'module-primary',
    description: `Primary AI agent for ${moduleMetadata.name} module. Assists with ${objectNames.join(', ')} management.`,
    
    // Scope and boundaries
    scope: {
      moduleId,
      moduleName: moduleMetadata.name,
      namespace: moduleMetadata.namespace,
      domain: moduleMetadata.domain,
      tier: moduleMetadata.tier,
      ownedObjects: objectNames,
      objectCount: objectNames.length
    },
    
    // Owned objects and capabilities
    ownedObjects: generateOwnedObjectDefinitions(memberObjects, blueprint),
    
    // Actions the agent can perform
    allowedActions: generateAllowedActions(memberObjects, blueprint),
    forbiddenActions: generateForbiddenActions(blueprint),
    
    // Permission requirements
    permissions: {
      minRequiredRoles: ['user', 'manager'],
      executionContext: {
        requiresAuthentication: true,
        requiresAudit: true,
        requiresRateLimit: true,
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          concurrentExecutions: 5
        }
      }
    },
    
    // Workflows the agent can assist with
    assistedWorkflows: generateAssistedWorkflows(memberObjects, blueprint),
    
    // Automations the agent can trigger
    triggerableAutomations: generateTriggerableAutomations(memberObjects, blueprint),
    
    // Actions requiring human approval
    requiresApproval: generateApprovalRequirements(blueprint),
    
    // Safety and boundaries
    safetyConstraints: {
      canCreate: true,
      canUpdate: true,
      canDelete: false,  // Agents should not delete
      canBulkUpdate: true,
      canCascadeDelete: false,
      requiresExplicitApproval: ['delete', 'cascade-operations', 'bulk-updates'],
      mustLog: ['create', 'update', 'delete', 'approval-actions']
    },
    
    // Error handling
    errorHandling: {
      onValidationError: 'quarantine-and-notify',
      onPermissionDenied: 'escalate-to-manager',
      onExternalAPIError: 'retry-with-backoff',
      maxRetries: 3,
      backoffMs: 1000
    },
    
    // Knowledge base references
    knowledgeReferences: [
      `${moduleId}-overview`,
      `${moduleId}-objects`,
      `${moduleId}-workflows`,
      `${moduleId}-automations`,
      `${moduleId}-permissions`,
      `${moduleId}-errors`
    ],
    
    // Enabled by default
    enabled: true,
    version: '1.0.0'
  };
}

/**
 * Generate specialized agents per object/function
 */
function generateSpecializedAgents(moduleId, moduleMetadata, memberObjects, blueprint) {
  const agents = [];
  
  for (const obj of memberObjects) {
    agents.push({
      id: `agent:${moduleId}-${obj.name.toLowerCase()}`,
      name: `${obj.name} Specialist Agent`,
      type: 'object-specialist',
      description: `Specialized AI agent for ${obj.name} management within ${moduleMetadata.name} module`,
      
      scope: {
        moduleId,
        moduleName: moduleMetadata.name,
        namespace: moduleMetadata.namespace,
        objectName: obj.name,
        specialization: 'object-management'
      },
      
      ownedObjects: [{
        name: obj.name,
        actions: ['create', 'read', 'update', 'search'],
        lifecycleStates: getObjectLifecycleStates(obj),
        relationships: (obj.module?.relationships || []).map(r => r.targetObject)
      }],
      
      allowedActions: [
        { action: 'create', description: `Create new ${obj.name}` },
        { action: 'read', description: `Read ${obj.name}` },
        { action: 'update', description: `Update ${obj.name}` },
        { action: 'search', description: `Search ${obj.name}` },
        { action: 'bulk-read', description: `Bulk read ${obj.name}` },
        { action: 'export', description: `Export ${obj.name}` }
      ],
      
      forbiddenActions: [
        { action: 'delete', reason: 'Data preservation policy' },
        { action: 'cascade-delete', reason: 'Relationship protection' },
        { action: 'modify-other-objects', reason: 'Scope boundary' }
      ],
      
      permissions: {
        minRequiredRoles: ['user'],
        canAssignToOthers: false,
        canDelegateActions: false
      },
      
      assistedWorkflows: generateWorkflowsForObject(obj, blueprint),
      
      triggerableAutomations: generateAutomationsForObject(obj, blueprint),
      
      safetyConstraints: {
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        requiresExplicitApproval: ['create-with-relations', 'bulk-update']
      },
      
      enabled: true,
      version: '1.0.0'
    });
  }
  
  return agents;
}

/**
 * Generate owned object definitions
 */
function generateOwnedObjectDefinitions(memberObjects, blueprint) {
  return memberObjects.map(obj => ({
    name: obj.name,
    registryKey: obj.registryKey,
    path: obj.path,
    type: 'enterprise-object',
    description: obj.registration?.description || `${obj.name} entity`,
    actions: ['create', 'read', 'update', 'search', 'export'],
    lifecycleStates: getObjectLifecycleStates(obj),
    relationships: (obj.module?.relationships || []).map(r => ({
      targetObject: r.targetObject,
      type: r.type,
      cardinality: r.cardinality
    })),
    fields: obj.registration?.fields?.length || 0
  }));
}

/**
 * Generate allowed actions
 */
function generateAllowedActions(memberObjects, blueprint) {
  const actions = [];
  
  // CRUD operations
  for (const obj of memberObjects) {
    const objLower = obj.name.toLowerCase();
    actions.push({
      action: `create-${objLower}`,
      description: `Create new ${obj.name}`,
      object: obj.name,
      requiresApproval: false,
      riskLevel: 'low'
    });
    actions.push({
      action: `read-${objLower}`,
      description: `Read ${obj.name}`,
      object: obj.name,
      requiresApproval: false,
      riskLevel: 'low'
    });
    actions.push({
      action: `update-${objLower}`,
      description: `Update ${obj.name}`,
      object: obj.name,
      requiresApproval: false,
      riskLevel: 'medium'
    });
    actions.push({
      action: `search-${objLower}`,
      description: `Search ${obj.name}`,
      object: obj.name,
      requiresApproval: false,
      riskLevel: 'low'
    });
  }
  
  // Workflow execution
  if (blueprint.workflow?.workflows) {
    for (const workflow of blueprint.workflow.workflows) {
      actions.push({
        action: `execute-workflow-${workflow.id}`,
        description: `Execute ${workflow.name}`,
        workflowId: workflow.id,
        requiresApproval: workflow.type === 'approval',
        riskLevel: 'medium'
      });
    }
  }
  
  // Automation triggering
  if (blueprint.automation?.automations) {
    for (const automation of blueprint.automation.automations.slice(0, 3)) {
      actions.push({
        action: `trigger-automation-${automation.id}`,
        description: `Trigger ${automation.name}`,
        automationId: automation.id,
        requiresApproval: false,
        riskLevel: automation.priority === 'critical' ? 'high' : 'medium'
      });
    }
  }
  
  return actions;
}

/**
 * Generate forbidden actions
 */
function generateForbiddenActions(blueprint) {
  return [
    {
      action: 'delete-objects',
      reason: 'Data preservation and auditability',
      severity: 'critical'
    },
    {
      action: 'cascade-delete-relationships',
      reason: 'Relationship integrity protection',
      severity: 'critical'
    },
    {
      action: 'modify-permissions',
      reason: 'Security policy enforcement',
      severity: 'critical'
    },
    {
      action: 'disable-audit-logging',
      reason: 'Compliance and auditability',
      severity: 'critical'
    },
    {
      action: 'modify-module-registry',
      reason: 'System integrity',
      severity: 'critical'
    },
    {
      action: 'access-other-modules-data',
      reason: 'Module boundary protection',
      severity: 'high'
    }
  ];
}

/**
 * Generate assisted workflows
 */
function generateAssistedWorkflows(memberObjects, blueprint) {
  const workflows = [];
  
  if (!blueprint.workflow?.workflows) return workflows;
  
  for (const workflow of blueprint.workflow.workflows) {
    workflows.push({
      id: workflow.id,
      name: workflow.name,
      type: workflow.type,
      description: workflow.description,
      object: workflow.object,
      assistanceMode: 'auto-execute-or-suggest',
      autoExecute: workflow.type === 'primary',
      suggestWhen: ['object-created', 'workflow-available'],
      requiresApproval: workflow.type === 'approval',
      contextData: ['object-id', 'user-role', 'current-state']
    });
  }
  
  return workflows;
}

/**
 * Generate triggerable automations
 */
function generateTriggerableAutomations(memberObjects, blueprint) {
  const automations = [];
  
  if (!blueprint.automation?.automations) return automations;
  
  for (const automation of blueprint.automation.automations) {
    if (['event-triggered', 'lifecycle-triggered'].includes(automation.type)) {
      automations.push({
        id: automation.id,
        name: automation.name,
        type: automation.type,
        description: automation.description,
        canTrigger: true,
        requiresApproval: automation.priority === 'critical',
        riskLevel: automation.priority === 'critical' ? 'high' : 'medium'
      });
    }
  }
  
  return automations;
}

/**
 * Generate approval requirements
 */
function generateApprovalRequirements(blueprint) {
  const requirements = [];
  
  requirements.push({
    action: 'bulk-update',
    approvalFrom: 'manager',
    requiresExplanation: true,
    reason: 'Bulk operations require oversight'
  });
  
  requirements.push({
    action: 'high-priority-automation',
    approvalFrom: 'manager',
    requiresExplanation: true,
    reason: 'Critical automations need approval'
  });
  
  requirements.push({
    action: 'workflow-approval-step',
    approvalFrom: 'workflow-specified-role',
    requiresExplanation: false,
    reason: 'Workflow defines required approvals'
  });
  
  return requirements;
}

/**
 * Generate agent capabilities summary
 */
function generateAgentCapabilities(memberObjects, blueprint) {
  const capabilities = {
    objectManagement: memberObjects.length,
    workflowAssistance: blueprint.workflow?.workflows?.length || 0,
    automationTriggering: (blueprint.automation?.automations || []).filter(a => 
      ['event-triggered', 'lifecycle-triggered'].includes(a.type)
    ).length,
    bulkOperations: true,
    searchAndFilter: true,
    exportData: true,
    dataValidation: true,
    relationshipManagement: true,
    eventAwareness: true,
    errorRecovery: true
  };
  
  return capabilities;
}

/**
 * Generate permission model
 */
function generatePermissionModel(blueprint) {
  return {
    roles: ['user', 'manager', 'admin'],
    defaultRole: 'user',
    permissions: {
      user: {
        create: true,
        read: true,
        update: true,
        delete: false,
        search: true,
        export: false,
        viewAudit: false,
        triggerAutomation: false
      },
      manager: {
        create: true,
        read: true,
        update: true,
        delete: false,
        search: true,
        export: true,
        viewAudit: true,
        triggerAutomation: true,
        approveHighRisk: true
      },
      admin: {
        create: true,
        read: true,
        update: true,
        delete: false,
        search: true,
        export: true,
        viewAudit: true,
        triggerAutomation: true,
        approveHighRisk: true,
        manageAgents: true
      }
    }
  };
}

/**
 * Generate escalation rules
 */
function generateEscalationRules(moduleMetadata, blueprint) {
  return {
    onError: {
      condition: 'operation-fails',
      escalateTo: 'support-team',
      maxRetries: 3,
      notifyUser: true,
      includeContext: true
    },
    onPermissionDenied: {
      condition: 'permission-denied',
      escalateTo: 'manager',
      requestApproval: true,
      notifyUser: true
    },
    onValidationFailure: {
      condition: 'data-validation-fails',
      escalateTo: 'data-team',
      quarantineData: true,
      notifyUser: true
    },
    onExternalAPIError: {
      condition: 'external-api-error',
      escalateTo: 'integration-team',
      maxRetries: 3,
      backoffMs: 1000,
      notifyUser: true
    },
    onHighRiskAction: {
      condition: 'high-risk-action-attempt',
      escalateTo: 'manager',
      requiresApproval: true,
      notifyUser: true,
      logAction: true
    }
  };
}

/**
 * Generate knowledge sources
 */
function generateKnowledgeSources(moduleId, moduleMetadata, blueprint) {
  return [
    {
      id: `${moduleId}-overview`,
      name: 'Module Overview',
      type: 'documentation',
      path: `/docs/modules/${moduleId}/overview.md`,
      content: `${moduleMetadata.name} module overview and purpose`
    },
    {
      id: `${moduleId}-objects`,
      name: 'Object Specifications',
      type: 'object-catalog',
      path: `/docs/modules/${moduleId}/objects.json`,
      content: 'All objects in this module with their fields and relationships'
    },
    {
      id: `${moduleId}-workflows`,
      name: 'Workflow Guide',
      type: 'workflow-documentation',
      path: `/out/generated/modules/${moduleId}/${moduleId}.workflow.json`,
      content: 'Available workflows and their execution requirements'
    },
    {
      id: `${moduleId}-automations`,
      name: 'Automation Guide',
      type: 'automation-documentation',
      path: `/out/generated/modules/${moduleId}/${moduleId}.automation.json`,
      content: 'Available automations and their triggers'
    },
    {
      id: `${moduleId}-permissions`,
      name: 'Permission Model',
      type: 'permission-documentation',
      path: `/docs/modules/${moduleId}/permissions.md`,
      content: 'Permission model and access control'
    },
    {
      id: `${moduleId}-errors`,
      name: 'Error Handling Guide',
      type: 'error-documentation',
      path: `/docs/modules/${moduleId}/errors.md`,
      content: 'Common errors and handling strategies'
    },
    {
      id: `${moduleId}-api`,
      name: 'API Reference',
      type: 'api-documentation',
      path: `/out/generated/modules/${moduleId}/${moduleId}.api.json`,
      content: 'Module API endpoints and operations'
    }
  ];
}

/**
 * Generate agent constraints
 */
function generateAgentConstraints(moduleMetadata, blueprint) {
  return {
    timeConstraints: {
      executionTimeout: 30000,
      maxConcurrentOperations: 5,
      maxOperationsPerMinute: 60
    },
    dataConstraints: {
      maxRecordsPerOperation: 1000,
      maxBulkUpdateSize: 100,
      maxExportSize: 10000
    },
    scopeConstraints: {
      restrictToModuleObjects: true,
      cannotAccessOtherModules: true,
      cannotModifyPermissions: true,
      cannotModifyRegistry: true
    },
    auditConstraints: {
      allOperationsMustBeLogged: true,
      allErrorsMustBeLogged: true,
      requiredFields: ['timestamp', 'agent-id', 'action', 'user-id', 'result']
    }
  };
}

/**
 * Helper: Get lifecycle states for object
 */
function getObjectLifecycleStates(obj) {
  if (!obj.registration?.lifecycle) return [];
  
  const states = obj.registration.lifecycle.states;
  
  // Handle if states is an array
  if (Array.isArray(states)) {
    return states.map(s => typeof s === 'string' ? { name: s } : s);
  }
  
  // Handle if states is an object (keyed by state name)
  if (typeof states === 'object') {
    return Object.keys(states).map(key => ({
      name: key,
      ...states[key]
    }));
  }
  
  return [];
}

/**
 * Helper: Generate workflows for specific object
 */
function generateWorkflowsForObject(obj, blueprint) {
  const workflows = [];
  
  if (!blueprint.workflow?.workflows) return workflows;
  
  const objectWorkflows = blueprint.workflow.workflows.filter(w => w.object === obj.name);
  
  for (const workflow of objectWorkflows) {
    workflows.push({
      id: workflow.id,
      name: workflow.name,
      assistanceMode: 'auto-suggest',
      autoExecute: false,
      suggestWhen: ['object-created', 'object-updated']
    });
  }
  
  return workflows;
}

/**
 * Helper: Generate automations for specific object
 */
function generateAutomationsForObject(obj, blueprint) {
  const automations = [];
  
  if (!blueprint.automation?.automations) return automations;
  
  for (const automation of blueprint.automation.automations) {
    if (automation.description?.includes(obj.name)) {
      automations.push({
        id: automation.id,
        name: automation.name,
        type: automation.type,
        canTrigger: true
      });
    }
  }
  
  return automations;
}
