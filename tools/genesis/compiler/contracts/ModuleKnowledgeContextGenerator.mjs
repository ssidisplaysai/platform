/**
 * ModuleKnowledgeContextGenerator - Generates AI knowledge context files
 *
 * Creates comprehensive knowledge context files for AI agents including:
 *   - Module overview and business purpose
 *   - Object descriptions and capabilities
 *   - Available APIs and operations
 *   - Workflow guidelines and patterns
 *   - Automation capabilities and triggers
 *   - Permission model and access control
 *   - Error scenarios and recovery strategies
 *   - Best practices and guidelines
 *
 * @module tools/genesis/compiler/contracts/ModuleKnowledgeContextGenerator
 */

/**
 * Generate AI knowledge context from module metadata
 *
 * @param {string} moduleId - Module identifier
 * @param {Object} moduleMetadata - Module metadata
 * @param {Array<Object>} memberObjects - Member objects
 * @param {Object} blueprint - ModuleBlueprint IR
 * @returns {Object} Knowledge context definition
 */
export function generateKnowledgeContext(moduleId, moduleMetadata, memberObjects, blueprint) {
  const context = {
    module: moduleId,
    version: '1.0.0',
    
    overview: generateModuleOverview(moduleMetadata, memberObjects, blueprint),
    
    objects: generateObjectCatalog(memberObjects, blueprint),
    
    apis: generateAPIKnowledge(moduleMetadata, blueprint),
    
    workflows: generateWorkflowKnowledge(blueprint),
    
    automations: generateAutomationKnowledge(blueprint),
    
    permissions: generatePermissionKnowledge(blueprint),
    
    errors: generateErrorKnowledge(blueprint),
    
    bestPractices: generateBestPractices(moduleMetadata, memberObjects),
    
    metadata: {
      created: new Date().toISOString(),
      generator: 'ModuleKnowledgeContextGenerator',
      phase: 'AI Agent Intelligence',
      version: '1.0.0'
    }
  };
  
  return context;
}

/**
 * Generate module overview
 */
function generateModuleOverview(moduleMetadata, memberObjects, blueprint) {
  return {
    id: moduleMetadata.namespace,
    name: moduleMetadata.name,
    description: moduleMetadata.description,
    domain: moduleMetadata.domain,
    tier: moduleMetadata.tier,
    purpose: `${moduleMetadata.name} provides comprehensive management capabilities for ${memberObjects.map(o => o.name).join(', ')}`,
    
    businessContext: {
      domain: moduleMetadata.domain,
      primaryUseCase: `Manage ${memberObjects.map(o => o.name.toLowerCase()).join(' and ')} operations`,
      keyBenefits: [
        'Centralized management',
        'Workflow automation',
        'Data governance',
        'Access control',
        'Audit trails'
      ]
    },
    
    scope: {
      objects: memberObjects.map(o => o.name),
      objectCount: memberObjects.length,
      relationships: blueprint.relationships?.count || 0,
      capabilities: [
        'CRUD operations',
        'Advanced search',
        'Workflow execution',
        'Automation triggering',
        'Data export',
        'Bulk operations'
      ]
    },
    
    dataVolumeConsiderations: {
      typicalObjectCount: `100-10000 per object type`,
      relatedDataScope: `Internal module and cross-module relationships`,
      dataRetention: `Full historical audit trail`
    }
  };
}

/**
 * Generate object catalog
 */
function generateObjectCatalog(memberObjects, blueprint) {
  const catalog = {
    total: memberObjects.length,
    objects: []
  };
  
  for (const obj of memberObjects) {
    const lifecycleStates = obj.registration?.lifecycle?.states || [];
    const lifecycleEvents = obj.registration?.lifecycle?.events || [];
    
    // Normalize lifecycle states to array
    let statesArray = [];
    if (Array.isArray(lifecycleStates)) {
      statesArray = lifecycleStates;
    } else if (typeof lifecycleStates === 'object') {
      statesArray = Object.keys(lifecycleStates);
    }
    
    // Normalize lifecycle events to array
    let eventsArray = [];
    if (Array.isArray(lifecycleEvents)) {
      eventsArray = lifecycleEvents;
    } else if (typeof lifecycleEvents === 'object') {
      eventsArray = Object.keys(lifecycleEvents);
    }
    
    catalog.objects.push({
      name: obj.name,
      registryKey: obj.registryKey,
      description: obj.registration?.description || `${obj.name} entity`,
      
      structure: {
        fields: obj.registration?.fields?.length || 0,
        relationships: (obj.module?.relationships || []).length,
        capabilities: [
          'create',
          'read',
          'update',
          'search',
          'export'
        ]
      },
      
      lifecycle: {
        states: statesArray.map(s => typeof s === 'string' ? { name: s } : s),
        events: eventsArray.map(e => typeof e === 'string' ? { name: e } : e),
        transitions: generateStateTransitions(statesArray)
      },
      
      relationships: (obj.module?.relationships || []).map(r => ({
        targetObject: r.targetObject,
        type: r.type || 'reference',
        cardinality: r.cardinality || '1-to-many',
        required: r.required || false
      })),
      
      permissions: {
        create: ['user', 'manager', 'admin'],
        read: ['user', 'manager', 'admin'],
        update: ['user', 'manager', 'admin'],
        delete: []  // Agents cannot delete
      },
      
      commonOperations: generateCommonObjectOperations(obj),
      
      dataValidation: {
        requiresFields: (obj.registration?.fields || [])
          .filter(f => f.required)
          .map(f => f.name),
        uniqueFields: (obj.registration?.fields || [])
          .filter(f => f.unique)
          .map(f => f.name),
        enumFields: (obj.registration?.fields || [])
          .filter(f => f.enum)
          .map(f => ({ name: f.name, values: f.enum }))
      }
    });
  }
  
  return catalog;
}

/**
 * Generate API knowledge
 */
function generateAPIKnowledge(moduleMetadata, blueprint) {
  const api = {
    namespace: blueprint.api?.namespace || `/api/v1/${moduleMetadata.namespace}`,
    description: `REST API for ${moduleMetadata.name} module`,
    
    operationPatterns: [
      {
        pattern: 'List',
        method: 'GET',
        path: '/{resource}',
        description: 'Retrieve list of resources',
        parameters: ['page', 'limit', 'filter', 'sort'],
        returns: 'Array of resources'
      },
      {
        pattern: 'Get',
        method: 'GET',
        path: '/{resource}/:id',
        description: 'Retrieve single resource',
        parameters: ['id'],
        returns: 'Single resource'
      },
      {
        pattern: 'Create',
        method: 'POST',
        path: '/{resource}',
        description: 'Create new resource',
        requiresBody: true,
        requiresApproval: false,
        returns: 'Created resource'
      },
      {
        pattern: 'Update',
        method: 'PUT',
        path: '/{resource}/:id',
        description: 'Update resource',
        requiresBody: true,
        requiresApproval: false,
        returns: 'Updated resource'
      },
      {
        pattern: 'Patch',
        method: 'PATCH',
        path: '/{resource}/:id',
        description: 'Partial update',
        requiresBody: true,
        requiresApproval: false,
        returns: 'Updated resource'
      },
      {
        pattern: 'Delete',
        method: 'DELETE',
        path: '/{resource}/:id',
        description: 'Delete resource (not available for AI agents)',
        forbidden: true
      }
    ],
    
    commonQueryParameters: [
      {
        name: 'filter',
        type: 'object',
        description: 'Filter results',
        example: '{"status": "active", "type": "customer"}'
      },
      {
        name: 'sort',
        type: 'string',
        description: 'Sort field and direction',
        example: 'name:asc or createdAt:desc'
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number for pagination',
        default: 1
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Results per page',
        default: 20,
        max: 100
      }
    ],
    
    endpoints: blueprint.api?.endpoints || [],
    
    responseFormats: {
      success: {
        status: 200,
        structure: {
          success: true,
          data: 'Resource or array',
          meta: { /* pagination */ }
        }
      },
      error: {
        status: [400, 401, 403, 404, 500],
        structure: {
          success: false,
          error: 'Error message',
          code: 'Error code',
          details: 'Additional context'
        }
      }
    }
  };
  
  return api;
}

/**
 * Generate workflow knowledge
 */
function generateWorkflowKnowledge(blueprint) {
  const workflows = {
    total: blueprint.workflow?.workflows?.length || 0,
    types: {},
    guidelines: [
      'Start with workflow suggestions based on object state',
      'Verify all required steps can be executed with current permissions',
      'Obtain necessary approvals before workflow execution',
      'Log all workflow state changes for audit trail',
      'Handle workflow errors with graceful degradation'
    ]
  };
  
  if (blueprint.workflow?.workflows) {
    for (const workflow of blueprint.workflow.workflows) {
      if (!workflows.types[workflow.type]) {
        workflows.types[workflow.type] = [];
      }
      
      workflows.types[workflow.type].push({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        object: workflow.object,
        trigger: workflow.trigger,
        stepCount: (workflow.steps || []).length,
        requiresApproval: workflow.type === 'approval',
        purpose: getWorkflowPurpose(workflow)
      });
    }
  }
  
  return workflows;
}

/**
 * Generate automation knowledge
 */
function generateAutomationKnowledge(blueprint) {
  const automations = {
    total: blueprint.automation?.automations?.length || 0,
    types: {},
    guidelines: [
      'Automations execute asynchronously',
      'Some automations require explicit approval',
      'Critical automations have highest priority',
      'Automation failures are logged and escalated',
      'Monitor automation execution metrics'
    ],
    triggeringRules: {
      eventTriggered: {
        description: 'Execute on system events',
        examples: ['object-created', 'object-updated', 'object-deleted'],
        requiresApproval: false
      },
      scheduled: {
        description: 'Execute on schedule (cron)',
        examples: ['every 6 hours', 'daily at 2 AM', 'weekly on Monday'],
        requiresApproval: false
      },
      manual: {
        description: 'Execute on demand by agent',
        requiresApproval: true
      }
    }
  };
  
  if (blueprint.automation?.automations) {
    for (const automation of blueprint.automation.automations) {
      if (!automations.types[automation.type]) {
        automations.types[automation.type] = [];
      }
      
      automations.types[automation.type].push({
        id: automation.id,
        name: automation.name,
        description: automation.description,
        type: automation.type,
        priority: automation.priority,
        trigger: automation.trigger,
        actions: (automation.actions || []).length,
        requiresApproval: automation.priority === 'critical',
        purpose: getAutomationPurpose(automation)
      });
    }
  }
  
  return automations;
}

/**
 * Generate permission knowledge
 */
function generatePermissionKnowledge(blueprint) {
  return {
    roles: ['user', 'manager', 'admin'],
    
    roleDescriptions: {
      user: 'Standard user with basic CRUD operations',
      manager: 'Manager with extended permissions and approvals',
      admin: 'Administrator with full module access'
    },
    
    actionToRoleMapping: {
      'read': ['user', 'manager', 'admin'],
      'create': ['user', 'manager', 'admin'],
      'update': ['user', 'manager', 'admin'],
      'delete': [],
      'bulk-read': ['manager', 'admin'],
      'bulk-update': ['manager', 'admin'],
      'trigger-automation': ['manager', 'admin'],
      'approve-workflow': ['manager', 'admin'],
      'view-audit': ['admin'],
      'export-data': ['manager', 'admin']
    },
    
    safetyConstraints: {
      noDeleteOperations: 'AI agents cannot delete data',
      noPermissionModification: 'AI agents cannot modify permissions',
      noModuleModification: 'AI agents cannot modify module registry',
      auditRequired: 'All operations are logged and audited',
      approvalRequired: 'Critical operations require human approval'
    }
  };
}

/**
 * Generate error knowledge
 */
function generateErrorKnowledge(blueprint) {
  return {
    commonErrors: [
      {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        description: 'Data validation failed',
        recoveryStrategy: [
          'Check required fields',
          'Validate field formats',
          'Verify constraints',
          'Escalate if validation is impossible'
        ]
      },
      {
        code: 'PERMISSION_DENIED',
        statusCode: 403,
        description: 'User lacks required permissions',
        recoveryStrategy: [
          'Verify user role',
          'Check object ownership',
          'Request manager approval',
          'Escalate to admin if needed'
        ]
      },
      {
        code: 'NOT_FOUND',
        statusCode: 404,
        description: 'Resource not found',
        recoveryStrategy: [
          'Verify resource ID',
          'Check if resource was deleted',
          'Search for similar resources',
          'Log error and notify user'
        ]
      },
      {
        code: 'CONFLICT',
        statusCode: 409,
        description: 'Resource state conflict',
        recoveryStrategy: [
          'Refresh resource state',
          'Retry operation',
          'Apply conflict resolution',
          'Escalate if unresolvable'
        ]
      },
      {
        code: 'EXTERNAL_API_ERROR',
        statusCode: 502,
        description: 'External system error',
        recoveryStrategy: [
          'Retry with exponential backoff',
          'Check external system status',
          'Fallback to cached data if available',
          'Queue for later retry'
        ]
      },
      {
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        description: 'Too many requests',
        recoveryStrategy: [
          'Wait for rate limit window',
          'Reduce request frequency',
          'Batch operations',
          'Escalate for priority handling'
        ]
      }
    ],
    
    recoveryPatterns: {
      retry: {
        description: 'Retry with backoff',
        strategy: 'Exponential backoff with max retries',
        defaultMaxRetries: 3,
        defaultBackoffMs: 1000
      },
      fallback: {
        description: 'Use alternative approach',
        strategy: 'Try alternative operation or data source',
        examples: ['Use cache', 'Try different object', 'Use simplified operation']
      },
      escalate: {
        description: 'Escalate to human',
        strategy: 'Notify user and request manual intervention',
        recipients: ['user', 'manager', 'support-team']
      },
      queue: {
        description: 'Queue for later retry',
        strategy: 'Store operation for batch processing',
        examples: ['Nightly sync', 'Scheduled task']
      }
    }
  };
}

/**
 * Generate best practices
 */
function generateBestPractices(moduleMetadata, memberObjects) {
  return {
    dataAccuracy: [
      'Validate all input data before operations',
      'Check for duplicates before creating objects',
      'Verify relationships are valid before saving',
      'Use transactions for multi-step operations',
      'Audit trail all changes'
    ],
    
    performanceOptimization: [
      'Use pagination for large result sets (limit: 20-100)',
      'Filter results server-side to reduce data transfer',
      'Batch related operations when possible',
      'Implement caching for frequently accessed objects',
      'Monitor rate limits and adjust request timing'
    ],
    
    reliabilityPatterns: [
      'Implement retry logic with exponential backoff',
      'Handle partial failures in bulk operations',
      'Maintain idempotency for safety',
      'Validate responses before processing',
      'Log all operations for audit trail'
    ],
    
    securityBestPractices: [
      'Always authenticate before operations',
      'Verify permissions before each action',
      'Never expose sensitive data in logs',
      'Use encrypted connections (HTTPS)',
      'Validate all inputs to prevent injection'
    ],
    
    userExperience: [
      'Provide clear feedback on operations',
      'Explain required approvals upfront',
      'Suggest next logical steps',
      'Handle errors gracefully with helpful messages',
      'Respect user preferences and context'
    ],
    
    auditingAndCompliance: [
      'Log all operations with timestamp and user',
      'Maintain audit trail for 7+ years',
      'Implement data retention policies',
      'Support compliance audits',
      'Enable data export for compliance'
    ]
  };
}

/**
 * Helper: Get workflow purpose
 */
function getWorkflowPurpose(workflow) {
  const purposeMap = {
    'primary': 'Standard CRUD operations',
    'lifecycle': 'State machine transitions',
    'approval': 'Multi-step approval process',
    'cross-object': 'Inter-object operations',
    'event-triggered': 'Event-based automation'
  };
  return purposeMap[workflow.type] || 'Workflow execution';
}

/**
 * Helper: Get automation purpose
 */
function getAutomationPurpose(automation) {
  const purposeMap = {
    'event-triggered': 'Execute on system events',
    'lifecycle-triggered': 'Execute on state changes',
    'approval-triggered': 'Execute on approval events',
    'scheduled': 'Execute on schedule',
    'exception': 'Handle errors and exceptions'
  };
  return purposeMap[automation.type] || 'Automation execution';
}

/**
 * Helper: Generate state transitions
 */
function generateStateTransitions(states) {
  if (!states) return [];
  if (!Array.isArray(states)) {
    // If states is an object, convert to array
    if (typeof states === 'object') {
      states = Object.keys(states);
    } else {
      return [];
    }
  }
  
  const transitions = [];
  for (let i = 0; i < states.length - 1; i++) {
    const from = typeof states[i] === 'string' ? states[i] : states[i]?.name || String(states[i]);
    const to = typeof states[i + 1] === 'string' ? states[i + 1] : states[i + 1]?.name || String(states[i + 1]);
    
    transitions.push({
      from: from,
      to: to,
      automatic: true
    });
  }
  return transitions;
}

/**
 * Helper: Generate common object operations
 */
function generateCommonObjectOperations(obj) {
  return [
    {
      operation: 'Create new',
      method: 'POST',
      endpoint: `/{namespace}/${obj.name.toLowerCase()}s`,
      when: 'New record needed',
      requires: 'Valid input data'
    },
    {
      operation: 'View list',
      method: 'GET',
      endpoint: `/{namespace}/${obj.name.toLowerCase()}s`,
      when: 'Need overview',
      requires: 'Read permission'
    },
    {
      operation: 'View details',
      method: 'GET',
      endpoint: `/{namespace}/${obj.name.toLowerCase()}s/:id`,
      when: 'Need details',
      requires: 'Object ID, Read permission'
    },
    {
      operation: 'Update',
      method: 'PUT',
      endpoint: `/{namespace}/${obj.name.toLowerCase()}s/:id`,
      when: 'Modify record',
      requires: 'Object ID, Update permission'
    },
    {
      operation: 'Search',
      method: 'GET',
      endpoint: `/{namespace}/${obj.name.toLowerCase()}s?filter=...`,
      when: 'Find specific records',
      requires: 'Filter criteria'
    }
  ];
}
