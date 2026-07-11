/**
 * RuntimeAutomationContract - Genesis Automation Runtime v1 Contracts
 *
 * Defines contracts for:
 * - RuntimeAutomation: Automation definition
 * - AutomationTrigger: Event that initiates automation
 * - AutomationCondition: Conditional logic for automation execution
 * - AutomationAction: Individual action within automation workflow
 * - AutomationExecution: Execution instance of automation
 * - AutomationExecutionResult: Result of automation execution
 * - AutomationContext: Context passed through automation execution chain
 *
 * @module tools/genesis/runtime/RuntimeAutomationContract.mjs
 */

/**
 * AutomationTrigger - Defines what initiates an automation
 *
 * Trigger types:
 * - event: Triggered by EventBus event
 * - lifecycleTransition: Triggered by object lifecycle state change
 * - workflowState: Triggered by workflow reaching specific state
 * - schedule: Triggered by cron schedule
 * - manual: Triggered by manual invocation
 * - exception: Triggered by error/exception
 */
export class AutomationTrigger {
  constructor(data = {}) {
    this.triggerId = data.triggerId || `trg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.triggerType = data.triggerType; // event|lifecycleTransition|workflowState|schedule|manual|exception
    this.eventType = data.eventType; // for event triggers (e.g., "commandExecuted")
    this.aggregateType = data.aggregateType; // optional filter for aggregate type
    this.sourceState = data.sourceState; // for lifecycle triggers (from state)
    this.targetState = data.targetState; // for lifecycle triggers (to state)
    this.workflowId = data.workflowId; // for workflow triggers
    this.workflowState = data.workflowState; // for workflow triggers
    this.schedule = data.schedule; // for scheduled triggers (cron string)
    this.errorConditions = data.errorConditions || []; // for exception triggers
    this.conditions = data.conditions || []; // AutomationCondition[]
    this.isActive = data.isActive !== false; // default true
  }

  /**
   * Validate trigger format
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.triggerType) {
      errors.push("Trigger type is required");
    }

    const validTypes = ['event', 'lifecycleTransition', 'workflowState', 'schedule', 'manual', 'exception'];
    if (this.triggerType && !validTypes.includes(this.triggerType)) {
      errors.push(`Invalid trigger type: ${this.triggerType}. Valid types: ${validTypes.join(', ')}`);
    }

    // Type-specific validation
    if (this.triggerType === 'event' && !this.eventType) {
      errors.push("Event type required for event trigger");
    }

    if (this.triggerType === 'lifecycleTransition' && (!this.sourceState || !this.targetState)) {
      errors.push("Source and target states required for lifecycle trigger");
    }

    if (this.triggerType === 'workflowState' && !this.workflowState) {
      errors.push("Workflow state required for workflow trigger");
    }

    if (this.triggerType === 'schedule' && !this.schedule) {
      errors.push("Schedule (cron) required for scheduled trigger");
    }

    if (this.triggerType === 'exception' && (!this.errorConditions || this.errorConditions.length === 0)) {
      warnings.push("No error conditions specified for exception trigger");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      allValid: () => errors.length === 0
    };
  }

  /**
   * Check if trigger matches event
   */
  matches(event) {
    if (this.triggerType !== 'event') return false;
    if (this.eventType && this.eventType !== event.eventType) return false;
    if (this.aggregateType && this.aggregateType !== event.target) return false;
    return true;
  }

  /**
   * Check if trigger matches lifecycle transition
   */
  matchesLifecycleTransition(aggregateType, fromState, toState) {
    if (this.triggerType !== 'lifecycleTransition') return false;
    if (this.aggregateType && this.aggregateType !== aggregateType) return false;
    if (this.sourceState && this.sourceState !== fromState) return false;
    if (this.targetState && this.targetState !== toState) return false;
    return true;
  }
}

/**
 * AutomationCondition - Conditions that must be met for automation to proceed
 */
export class AutomationCondition {
  constructor(data = {}) {
    this.conditionId = data.conditionId || `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.field = data.field; // field to evaluate
    this.operator = data.operator; // eq|neq|gt|lt|gte|lte|contains|in|exists
    this.value = data.value; // value to compare against
    this.logicType = data.logicType || 'and'; // and|or
  }

  /**
   * Evaluate condition
   */
  evaluate(context) {
    const fieldValue = this.getFieldValue(context, this.field);

    switch (this.operator) {
      case 'eq':
        return fieldValue === this.value;
      case 'neq':
        return fieldValue !== this.value;
      case 'gt':
        return fieldValue > this.value;
      case 'lt':
        return fieldValue < this.value;
      case 'gte':
        return fieldValue >= this.value;
      case 'lte':
        return fieldValue <= this.value;
      case 'contains':
        return String(fieldValue).includes(String(this.value));
      case 'in':
        return Array.isArray(this.value) && this.value.includes(fieldValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  /**
   * Get field value from context using dot notation
   */
  getFieldValue(context, path) {
    return path.split('.').reduce((obj, key) => obj?.[key], context);
  }

  /**
   * Validate condition
   */
  validate() {
    const errors = [];
    const validOperators = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'exists'];

    if (!this.field) errors.push("Condition field is required");
    if (!this.operator) errors.push("Condition operator is required");
    if (this.operator && !validOperators.includes(this.operator)) {
      errors.push(`Invalid operator: ${this.operator}`);
    }

    return { isValid: errors.length === 0, errors };
  }
}

/**
 * AutomationAction - Individual action to execute as part of automation
 *
 * Action types:
 * - command: Execute command via CommandBus
 * - query: Execute query via QueryBus
 * - eventPublish: Publish event via EventBus
 * - workflowStart: Start workflow
 * - notification: Send notification
 * - approvalRequest: Request approval
 * - aiAgentAssist: Invoke AI agent
 * - externalIntegration: Call external webhook/API
 */
export class AutomationAction {
  constructor(data = {}) {
    this.actionId = data.actionId || `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.actionType = data.actionType; // command|query|eventPublish|workflowStart|notification|approvalRequest|aiAgentAssist|externalIntegration
    this.name = data.name;
    this.description = data.description;
    this.enabled = data.enabled !== false; // default true
    this.async = data.async || false; // wait for completion or fire-and-forget
    this.retryable = data.retryable !== false; // default true
    this.maxRetries = data.maxRetries || 3;
    this.timeout = data.timeout || 30000; // milliseconds
    this.onFailure = data.onFailure || 'halt'; // halt|continue|compensate
    
    // Action-specific payloads
    this.commandPayload = data.commandPayload || {}; // for command actions
    this.queryPayload = data.queryPayload || {}; // for query actions
    this.eventPayload = data.eventPayload || {}; // for eventPublish actions
    this.workflowPayload = data.workflowPayload || {}; // for workflowStart actions
    this.notificationPayload = data.notificationPayload || {}; // for notification actions
    this.approvalPayload = data.approvalPayload || {}; // for approvalRequest actions
    this.aiAgentPayload = data.aiAgentPayload || {}; // for aiAgentAssist actions
    this.integrationPayload = data.integrationPayload || {}; // for externalIntegration actions
  }

  /**
   * Validate action
   */
  validate() {
    const errors = [];
    const validTypes = ['command', 'query', 'eventPublish', 'workflowStart', 'notification', 'approvalRequest', 'aiAgentAssist', 'externalIntegration'];

    if (!this.actionType) {
      errors.push("Action type is required");
    }

    if (this.actionType && !validTypes.includes(this.actionType)) {
      errors.push(`Invalid action type: ${this.actionType}. Valid types: ${validTypes.join(', ')}`);
    }

    if (!this.name) {
      errors.push("Action name is required");
    }

    const validOnFailure = ['halt', 'continue', 'compensate'];
    if (this.onFailure && !validOnFailure.includes(this.onFailure)) {
      errors.push(`Invalid onFailure strategy: ${this.onFailure}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      allValid: () => errors.length === 0
    };
  }

  /**
   * Get payload for this action
   */
  getPayload() {
    switch (this.actionType) {
      case 'command':
        return this.commandPayload;
      case 'query':
        return this.queryPayload;
      case 'eventPublish':
        return this.eventPayload;
      case 'workflowStart':
        return this.workflowPayload;
      case 'notification':
        return this.notificationPayload;
      case 'approvalRequest':
        return this.approvalPayload;
      case 'aiAgentAssist':
        return this.aiAgentPayload;
      case 'externalIntegration':
        return this.integrationPayload;
      default:
        return {};
    }
  }
}

/**
 * RuntimeAutomation - Complete automation definition
 */
export class RuntimeAutomation {
  constructor(data = {}) {
    this.automationId = data.automationId || `aut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name;
    this.description = data.description;
    this.module = data.module; // module ID that owns this automation
    this.version = data.version || '1.0.0';
    this.enabled = data.enabled !== false; // default true
    this.priority = data.priority || 'normal'; // low|normal|high|critical
    
    this.trigger = data.trigger instanceof AutomationTrigger 
      ? data.trigger 
      : new AutomationTrigger(data.trigger || {});
    
    this.conditions = (data.conditions || []).map(c => 
      c instanceof AutomationCondition ? c : new AutomationCondition(c)
    );
    
    this.actions = (data.actions || []).map(a => 
      a instanceof AutomationAction ? a : new AutomationAction(a)
    );
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.modifiedAt = data.modifiedAt || new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
  }

  /**
   * Validate automation
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name) errors.push("Automation name is required");
    if (!this.module) errors.push("Module is required");
    if (!this.trigger) errors.push("Trigger is required");
    if (!this.actions || this.actions.length === 0) {
      errors.push("At least one action is required");
    }

    // Validate trigger
    if (this.trigger) {
      const triggerValidation = this.trigger.validate();
      errors.push(...triggerValidation.errors);
      warnings.push(...triggerValidation.warnings);
    }

    // Validate conditions
    if (this.conditions && this.conditions.length > 0) {
      this.conditions.forEach((cond, idx) => {
        const condValidation = cond.validate();
        errors.push(...condValidation.errors.map(e => `Condition ${idx}: ${e}`));
      });
    }

    // Validate actions
    if (this.actions && this.actions.length > 0) {
      this.actions.forEach((action, idx) => {
        const actionValidation = action.validate();
        errors.push(...actionValidation.errors.map(e => `Action ${idx}: ${e}`));
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      allValid: () => errors.length === 0
    };
  }

  /**
   * Check if automation should execute based on trigger
   */
  shouldExecute(context) {
    // Check all conditions
    if (this.conditions && this.conditions.length > 0) {
      return this.conditions.every(cond => cond.evaluate(context));
    }
    return true;
  }
}

/**
 * AutomationContext - Context passed through automation execution
 */
export class AutomationContext {
  constructor(data = {}) {
    this.contextId = data.contextId || `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.automationId = data.automationId;
    this.executionId = data.executionId;
    this.trigger = data.trigger; // RuntimeEvent or lifecycle transition data
    this.actor = data.actor || 'system';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.data = data.data || {}; // custom data passed through automation
    this.results = data.results || {}; // results from previous actions
    this.metadata = data.metadata || {};
    this.correlationId = data.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add result from action execution
   */
  addResult(actionId, result) {
    this.results[actionId] = {
      status: result.status,
      result: result.result,
      error: result.error,
      duration: result.duration,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get result from previous action
   */
  getResult(actionId) {
    return this.results[actionId];
  }
}

/**
 * AutomationExecution - Execution instance of an automation
 */
export class AutomationExecution {
  constructor(data = {}) {
    this.executionId = data.executionId || `exe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.automationId = data.automationId;
    this.automationName = data.automationName;
    this.status = data.status || 'pending'; // pending|validating|executing|succeeded|failed|halted
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.actor = data.actor || 'system';
    this.triggerType = data.triggerType; // event|lifecycleTransition|workflowState|schedule|manual|exception
    this.dryRun = data.dryRun || false;
    this.context = data.context instanceof AutomationContext 
      ? data.context 
      : new AutomationContext(data.context || {});
  }

  /**
   * Mark execution as executing
   */
  markExecuting() {
    this.status = 'executing';
  }

  /**
   * Mark execution as succeeded
   */
  markSucceeded() {
    this.status = 'succeeded';
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Mark execution as failed
   */
  markFailed() {
    this.status = 'failed';
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Mark execution as halted
   */
  markHalted() {
    this.status = 'halted';
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Check if execution is complete
   */
  isComplete() {
    return ['succeeded', 'failed', 'halted'].includes(this.status);
  }
}

/**
 * AutomationExecutionResult - Result of automation execution
 */
export class AutomationExecutionResult {
  constructor(data = {}) {
    this.executionId = data.executionId;
    this.automationId = data.automationId;
    this.automationName = data.automationName;
    this.status = data.status || 'pending'; // pending|validating|executing|succeeded|failed|halted|dryRun
    this.operationType = data.operationType || 'execute'; // execute|validate
    this.result = data.result || null;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.actionsExecuted = data.actionsExecuted || 0;
    this.actionResults = data.actionResults || [];
    this.dryRun = data.dryRun || false;
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.validationResults = data.validationResults || null;
    this.actor = data.actor || 'system';
  }

  /**
   * Mark execution as validating
   */
  markValidating() {
    this.status = 'validating';
  }

  /**
   * Mark execution as executing
   */
  markExecuting() {
    this.status = 'executing';
  }

  /**
   * Mark execution as succeeded
   */
  markSucceeded() {
    this.status = 'succeeded';
    this.markExecuted();
  }

  /**
   * Mark execution as failed
   */
  markFailed() {
    this.status = 'failed';
    this.markExecuted();
  }

  /**
   * Mark execution as halted
   */
  markHalted() {
    this.status = 'halted';
    this.markExecuted();
  }

  /**
   * Mark execution as dry-run
   */
  markDryRun() {
    this.status = 'dryRun';
    this.dryRun = true;
    this.markExecuted();
  }

  /**
   * Mark execution as complete
   */
  markExecuted() {
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  /**
   * Add error
   */
  addError(error) {
    this.errors.push(error);
  }

  /**
   * Add warning
   */
  addWarning(warning) {
    this.warnings.push(warning);
  }

  /**
   * Add action result
   */
  addActionResult(actionResult) {
    this.actionResults.push(actionResult);
    if (actionResult.status === 'succeeded' || actionResult.status === 'executed') {
      this.actionsExecuted++;
    }
  }

  /**
   * Set result
   */
  setResult(result) {
    this.result = result;
  }

  /**
   * Check if result indicates success
   */
  isSuccess() {
    return this.status === 'succeeded' || this.status === 'dryRun';
  }

  /**
   * Validation result for metadata validation
   */
  setValidationResults(results) {
    this.validationResults = results;
  }
}
