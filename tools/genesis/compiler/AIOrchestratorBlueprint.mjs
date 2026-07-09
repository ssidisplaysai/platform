/**
 * AIOrchestratorBlueprint.mjs
 *
 * Defines all contracts for the Genesis AI Orchestrator Kernel v1
 * Provides orchestration layer for multi-agent AI collaboration
 *
 * @module tools/genesis/compiler/AIOrchestratorBlueprint.mjs
 */

import crypto from 'crypto';

/**
 * AgentCapability
 * Represents a single capability that an agent can perform
 */
export class AgentCapability {
  constructor(data = {}) {
    this.id = data.id || `cap-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Capability';
    this.description = data.description || '';
    this.domain = data.domain || ''; // operations, finance, hr, it, sales, customer, project, etc.
    this.type = data.type || 'action'; // action, analysis, decision, planning, simulation
    this.requiresApproval = data.requiresApproval || false;
    this.riskLevel = data.riskLevel || 'low'; // low, medium, high, critical
    this.dependencies = data.dependencies || []; // Other capabilities this depends on
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Capability name must be a non-empty string');
    }
    const validDomains = ['operations', 'finance', 'hr', 'it', 'sales', 'customer', 'project', 'marketing', 'supply', 'strategy', 'analysis'];
    if (this.domain && !validDomains.includes(this.domain)) {
      throw new Error(`Invalid domain: ${this.domain}`);
    }
    const validTypes = ['action', 'analysis', 'decision', 'planning', 'simulation'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid capability type: ${this.type}`);
    }
    const validRisks = ['low', 'medium', 'high', 'critical'];
    if (!validRisks.includes(this.riskLevel)) {
      throw new Error(`Invalid risk level: ${this.riskLevel}`);
    }
    return true;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      type: this.type,
      riskLevel: this.riskLevel
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      domain: this.domain,
      type: this.type,
      requiresApproval: this.requiresApproval,
      riskLevel: this.riskLevel,
      dependencies: this.dependencies,
      createdAt: this.createdAt
    };
  }
}

/**
 * AgentTool
 * Represents a tool or service an agent can invoke
 */
export class AgentTool {
  constructor(data = {}) {
    this.id = data.id || `tool-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Tool';
    this.description = data.description || '';
    this.type = data.type || 'builtin'; // builtin, external, runtime-service
    this.service = data.service || ''; // planning, decision, simulation, runtime, twin, etc.
    this.requiredParameters = data.requiredParameters || [];
    this.optionalParameters = data.optionalParameters || [];
    this.returnType = data.returnType || 'object'; // object, array, string, number, boolean
    this.requiresContext = data.requiresContext || false;
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }
    const validTypes = ['builtin', 'external', 'runtime-service'];
    if (!validTypes.includes(this.type)) {
      throw new Error(`Invalid tool type: ${this.type}`);
    }
    return true;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      service: this.service,
      type: this.type
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      service: this.service,
      requiredParameters: this.requiredParameters,
      optionalParameters: this.optionalParameters,
      returnType: this.returnType,
      requiresContext: this.requiresContext,
      createdAt: this.createdAt
    };
  }
}

/**
 * AgentContext
 * Contains execution context for an agent
 */
export class AgentContext {
  constructor(data = {}) {
    this.id = data.id || `ctx-${crypto.randomBytes(4).toString('hex')}`;
    this.tenantId = data.tenantId || 'default';
    this.userId = data.userId || 'system';
    this.organizationId = data.organizationId || '';
    this.sessionId = data.sessionId || `session-${crypto.randomBytes(4).toString('hex')}`;
    this.requestId = data.requestId || `req-${crypto.randomBytes(4).toString('hex')}`;
    this.executionMode = data.executionMode || 'normal'; // normal, dry-run, simulation
    this.permissions = data.permissions || []; // List of permitted operations
    this.accessibleModules = data.accessibleModules || []; // Which modules this agent can access
    this.accessibleTools = data.accessibleTools || []; // Which tools this agent can use
    this.memoryReferences = data.memoryReferences || []; // Past execution references
    this.metadata = data.metadata || {};
    this.status = 'initialized'; // initialized, active, awaiting-approval, blocked, completed
    this.createdAt = new Date().toISOString();
  }

  markActive() {
    this.status = 'active';
    return this;
  }

  markAwaitingApproval() {
    this.status = 'awaiting-approval';
    return this;
  }

  markBlocked(reason = '') {
    this.status = 'blocked';
    this.metadata.blockReason = reason;
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    this.metadata.completedAt = new Date().toISOString();
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      status: this.status,
      executionMode: this.executionMode
    };
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      userId: this.userId,
      organizationId: this.organizationId,
      sessionId: this.sessionId,
      requestId: this.requestId,
      executionMode: this.executionMode,
      permissions: this.permissions,
      accessibleModules: this.accessibleModules,
      accessibleTools: this.accessibleTools,
      memoryReferences: this.memoryReferences,
      metadata: this.metadata,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * AgentRequest
 * Represents a request to an agent
 */
export class AgentRequest {
  constructor(data = {}) {
    this.id = data.id || `areq-${crypto.randomBytes(4).toString('hex')}`;
    this.agentId = data.agentId || '';
    this.agentName = data.agentName || '';
    this.context = data.context || new AgentContext();
    this.objective = data.objective || '';
    this.parameters = data.parameters || {};
    this.requiredCapabilities = data.requiredCapabilities || [];
    this.requiredTools = data.requiredTools || [];
    this.constraints = data.constraints || [];
    this.escalationRules = data.escalationRules || [];
    this.expectedOutcome = data.expectedOutcome || '';
    this.priority = data.priority || 'normal'; // low, normal, high, critical
    this.deadline = data.deadline || null;
    this.status = 'submitted'; // submitted, accepted, executing, completed, failed
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.objective || typeof this.objective !== 'string') {
      throw new Error('Request objective must be a non-empty string');
    }
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!validPriorities.includes(this.priority)) {
      throw new Error(`Invalid priority: ${this.priority}`);
    }
    return true;
  }

  markAccepted() {
    this.status = 'accepted';
    return this;
  }

  markExecuting() {
    this.status = 'executing';
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    return this;
  }

  markFailed(reason = '') {
    this.status = 'failed';
    this.failureReason = reason;
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      agentName: this.agentName,
      objective: this.objective,
      priority: this.priority,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      agentName: this.agentName,
      context: this.context.toJSON(),
      objective: this.objective,
      parameters: this.parameters,
      requiredCapabilities: this.requiredCapabilities,
      requiredTools: this.requiredTools,
      constraints: this.constraints,
      escalationRules: this.escalationRules,
      expectedOutcome: this.expectedOutcome,
      priority: this.priority,
      deadline: this.deadline,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * AgentPlan
 * Represents an agent's execution plan
 */
export class AgentPlan {
  constructor(data = {}) {
    this.id = data.id || `aplan-${crypto.randomBytes(4).toString('hex')}`;
    this.agentId = data.agentId || '';
    this.requestId = data.requestId || '';
    this.stages = data.stages || []; // Stages: gather-info, analyze, plan, execute
    this.toolSequence = data.toolSequence || []; // Ordered list of tools to invoke
    this.collaborations = data.collaborations || []; // Other agents to collaborate with
    this.fallbackPlans = data.fallbackPlans || []; // Alternative paths if primary fails
    this.estimatedDuration = data.estimatedDuration || 0; // seconds
    this.estimatedCost = data.estimatedCost || 0;
    this.riskFactors = data.riskFactors || [];
    this.assumptions = data.assumptions || [];
    this.status = 'draft'; // draft, approved, executing, completed, aborted
    this.createdAt = new Date().toISOString();
  }

  addStage(stageName, description = '') {
    this.stages.push({ name: stageName, description, timestamp: new Date().toISOString() });
    return this;
  }

  addToolToSequence(toolId, toolName, parameters = {}) {
    this.toolSequence.push({ toolId, toolName, parameters, order: this.toolSequence.length + 1 });
    return this;
  }

  addCollaboration(agentId, agentName, reason = '') {
    this.collaborations.push({ agentId, agentName, reason });
    return this;
  }

  markApproved() {
    this.status = 'approved';
    return this;
  }

  markExecuting() {
    this.status = 'executing';
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    this.completedAt = new Date().toISOString();
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      agentId: this.agentId,
      stages: this.stages.length,
      tools: this.toolSequence.length,
      collaborations: this.collaborations.length,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      requestId: this.requestId,
      stages: this.stages,
      toolSequence: this.toolSequence,
      collaborations: this.collaborations,
      fallbackPlans: this.fallbackPlans,
      estimatedDuration: this.estimatedDuration,
      estimatedCost: this.estimatedCost,
      riskFactors: this.riskFactors,
      assumptions: this.assumptions,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * AgentMemoryReference
 * References previous executions in agent memory
 */
export class AgentMemoryReference {
  constructor(data = {}) {
    this.id = data.id || `mem-${crypto.randomBytes(4).toString('hex')}`;
    this.agentId = data.agentId || '';
    this.executionId = data.executionId || '';
    this.objectiveAchieved = data.objectiveAchieved || false;
    this.outcomeQuality = data.outcomeQuality || 'unknown'; // poor, fair, good, excellent
    this.toolsUsed = data.toolsUsed || [];
    this.collaborators = data.collaborators || [];
    this.duration = data.duration || 0; // seconds
    this.cost = data.cost || 0;
    this.lessonsLearned = data.lessonsLearned || [];
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  addLessonLearned(lesson = '') {
    this.lessonsLearned.push({ lesson, timestamp: new Date().toISOString() });
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      agentId: this.agentId,
      objectiveAchieved: this.objectiveAchieved,
      outcomeQuality: this.outcomeQuality,
      duration: this.duration
    };
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      executionId: this.executionId,
      objectiveAchieved: this.objectiveAchieved,
      outcomeQuality: this.outcomeQuality,
      toolsUsed: this.toolsUsed,
      collaborators: this.collaborators,
      duration: this.duration,
      cost: this.cost,
      lessonsLearned: this.lessonsLearned,
      timestamp: this.timestamp
    };
  }
}

/**
 * AgentExecution
 * Records an agent's execution attempt
 */
export class AgentExecution {
  constructor(data = {}) {
    this.id = data.id || `exec-${crypto.randomBytes(4).toString('hex')}`;
    this.agentId = data.agentId || '';
    this.requestId = data.requestId || '';
    this.planId = data.planId || '';
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.status = 'started'; // started, in-progress, completed, failed, aborted
    this.toolExecutions = data.toolExecutions || []; // Results from each tool call
    this.collaborationResults = data.collaborationResults || []; // Results from other agents
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.outputs = data.outputs || {};
    this.metrics = data.metrics || {};
    this.metadata = data.metadata || {};
  }

  recordToolExecution(toolId, toolName, parameters, result, duration) {
    this.toolExecutions.push({
      toolId,
      toolName,
      parameters,
      result,
      duration,
      timestamp: new Date().toISOString()
    });
    return this;
  }

  recordCollaboration(agentId, agentName, contribution) {
    this.collaborationResults.push({
      agentId,
      agentName,
      contribution,
      timestamp: new Date().toISOString()
    });
    return this;
  }

  recordError(errorMessage, severity = 'error') {
    this.errors.push({ message: errorMessage, severity, timestamp: new Date().toISOString() });
    return this;
  }

  recordWarning(warningMessage) {
    this.warnings.push({ message: warningMessage, timestamp: new Date().toISOString() });
    return this;
  }

  markCompleted() {
    this.status = 'completed';
    this.endTime = new Date().toISOString();
    this.metrics.duration = new Date(this.endTime) - new Date(this.startTime);
    return this;
  }

  markFailed() {
    this.status = 'failed';
    this.endTime = new Date().toISOString();
    this.metrics.duration = new Date(this.endTime) - new Date(this.startTime);
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      agentId: this.agentId,
      status: this.status,
      toolExecutions: this.toolExecutions.length,
      errors: this.errors.length,
      warnings: this.warnings.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      requestId: this.requestId,
      planId: this.planId,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      toolExecutions: this.toolExecutions,
      collaborationResults: this.collaborationResults,
      errors: this.errors,
      warnings: this.warnings,
      outputs: this.outputs,
      metrics: this.metrics,
      metadata: this.metadata
    };
  }
}

/**
 * AgentResponse
 * Response from agent execution
 */
export class AgentResponse {
  constructor(data = {}) {
    this.id = data.id || `aresp-${crypto.randomBytes(4).toString('hex')}`;
    this.agentId = data.agentId || '';
    this.requestId = data.requestId || '';
    this.executionId = data.executionId || '';
    this.status = 'initiated'; // initiated, successful, partial, failed
    this.primaryResult = data.primaryResult || null;
    this.alternativeResults = data.alternativeResults || [];
    this.recommendations = data.recommendations || [];
    this.reasoning = data.reasoning || '';
    this.confidence = data.confidence || 0; // 0-100
    this.requiresApproval = data.requiresApproval || false;
    this.approvalStatus = data.approvalStatus || 'pending'; // pending, approved, rejected
    this.metadata = data.metadata || {};
    this.timestamp = new Date().toISOString();
  }

  addRecommendation(recommendation = '') {
    this.recommendations.push({ text: recommendation, timestamp: new Date().toISOString() });
    return this;
  }

  addAlternative(result = null) {
    this.alternativeResults.push({ result, timestamp: new Date().toISOString() });
    return this;
  }

  markSuccessful() {
    this.status = 'successful';
    return this;
  }

  markPartial() {
    this.status = 'partial';
    return this;
  }

  markFailed() {
    this.status = 'failed';
    return this;
  }

  markApprovalRequired() {
    this.requiresApproval = true;
    return this;
  }

  markApproved() {
    this.approvalStatus = 'approved';
    this.metadata.approvedAt = new Date().toISOString();
    return this;
  }

  markRejected(reason = '') {
    this.approvalStatus = 'rejected';
    this.metadata.rejectionReason = reason;
    this.metadata.rejectedAt = new Date().toISOString();
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      agentId: this.agentId,
      status: this.status,
      confidence: this.confidence,
      approvalStatus: this.approvalStatus
    };
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      requestId: this.requestId,
      executionId: this.executionId,
      status: this.status,
      primaryResult: this.primaryResult,
      alternativeResults: this.alternativeResults,
      recommendations: this.recommendations,
      reasoning: this.reasoning,
      confidence: this.confidence,
      requiresApproval: this.requiresApproval,
      approvalStatus: this.approvalStatus,
      metadata: this.metadata,
      timestamp: this.timestamp
    };
  }
}

/**
 * Agent
 * Represents a registered AI agent
 */
export class Agent {
  constructor(data = {}) {
    this.id = data.id || `ag-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Unnamed Agent';
    this.description = data.description || '';
    this.role = data.role || 'specialist'; // specialist, coordinator, analyzer, executor
    this.domain = data.domain || ''; // operations, finance, hr, it, sales, customer, project
    this.capabilities = data.capabilities || []; // AgentCapability[]
    this.tools = data.tools || []; // AgentTool[]
    this.permissions = data.permissions || [];
    this.accessibleModules = data.accessibleModules || [];
    this.escalationRules = data.escalationRules || [];
    this.collaborators = data.collaborators || []; // Other agent IDs this can work with
    this.status = 'registered'; // registered, active, suspended, retired
    this.version = data.version || '1.0';
    this.createdAt = new Date().toISOString();
    this.validate();
  }

  validate() {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Agent name must be a non-empty string');
    }
    const validRoles = ['specialist', 'coordinator', 'analyzer', 'executor'];
    if (!validRoles.includes(this.role)) {
      throw new Error(`Invalid agent role: ${this.role}`);
    }
    return true;
  }

  addCapability(capability) {
    if (capability instanceof AgentCapability) {
      this.capabilities.push(capability);
    }
    return this;
  }

  addTool(tool) {
    if (tool instanceof AgentTool) {
      this.tools.push(tool);
    }
    return this;
  }

  markActive() {
    this.status = 'active';
    return this;
  }

  markSuspended() {
    this.status = 'suspended';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      domain: this.domain,
      capabilities: this.capabilities.length,
      tools: this.tools.length,
      status: this.status
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      role: this.role,
      domain: this.domain,
      capabilities: this.capabilities.map(c => c.toJSON()),
      tools: this.tools.map(t => t.toJSON()),
      permissions: this.permissions,
      accessibleModules: this.accessibleModules,
      escalationRules: this.escalationRules,
      collaborators: this.collaborators,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt
    };
  }
}

/**
 * AIOrchestrator
 * Main orchestrator contract for coordinating agents
 */
export class AIOrchestrator {
  constructor(data = {}) {
    this.id = data.id || `orch-${crypto.randomBytes(4).toString('hex')}`;
    this.name = data.name || 'Genesis AI Orchestrator';
    this.description = data.description || '';
    this.agents = data.agents || []; // Registered Agent[]
    this.activeRequests = data.activeRequests || []; // AgentRequest[]
    this.completedRequests = data.completedRequests || [];
    this.orchestrationRules = data.orchestrationRules || [];
    this.status = 'initialized'; // initialized, running, paused, stopped
    this.version = data.version || '1.0';
    this.createdAt = new Date().toISOString();
    this.metrics = {
      requestsProcessed: 0,
      agentsActive: 0,
      successRate: 0,
      averageResponseTime: 0
    };
  }

  registerAgent(agent) {
    if (agent instanceof Agent) {
      this.agents.push(agent);
      this.metrics.agentsActive = this.agents.filter(a => a.status === 'active').length;
    }
    return this;
  }

  submitRequest(request) {
    if (request instanceof AgentRequest) {
      this.activeRequests.push(request);
      request.markAccepted();
    }
    return this;
  }

  completeRequest(requestId, response) {
    const idx = this.activeRequests.findIndex(r => r.id === requestId);
    if (idx >= 0) {
      const request = this.activeRequests.splice(idx, 1)[0];
      this.completedRequests.push({ request, response });
      this.metrics.requestsProcessed++;
    }
    return this;
  }

  markRunning() {
    this.status = 'running';
    return this;
  }

  markPaused() {
    this.status = 'paused';
    return this;
  }

  markStopped() {
    this.status = 'stopped';
    return this;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      agents: this.agents.length,
      activeRequests: this.activeRequests.length,
      completedRequests: this.completedRequests.length
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      agents: this.agents.map(a => a.toJSON()),
      activeRequests: this.activeRequests.length,
      completedRequests: this.completedRequests.length,
      orchestrationRules: this.orchestrationRules,
      status: this.status,
      version: this.version,
      metrics: this.metrics,
      createdAt: this.createdAt
    };
  }
}
