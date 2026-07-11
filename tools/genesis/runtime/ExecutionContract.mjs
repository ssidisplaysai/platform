/**
 * ExecutionContract - Execution request/response schemas
 *
 * Defines the generic contracts for all execution types:
 * - command, query, lifecycleTransition, event, workflow, automation, aiAgent
 *
 * @module tools/genesis/runtime/ExecutionContract.mjs
 */

/**
 * ExecutionRequest
 * Generic request contract for all execution types
 */
export class ExecutionRequest {
  constructor(data = {}) {
    this.executionId = data.executionId || `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = data.type; // command|query|lifecycleTransition|event|workflow|automation|aiAgent
    this.target = data.target; // module/object name, workflow name, etc.
    this.action = data.action; // action name: execute, query, transition, etc.
    this.payload = data.payload || {}; // action-specific parameters
    this.actor = data.actor || "system"; // who is executing
    this.dryRun = data.dryRun || false;
    this.metadata = data.metadata || {};
    this.requestedAt = new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.type) {
      errors.push("type is required (command|query|lifecycleTransition|event|workflow|automation|aiAgent)");
    }

    if (!this.target) {
      errors.push("target is required");
    }

    if (!this.action) {
      errors.push("action is required");
    }

    const validTypes = [
      "command",
      "query",
      "lifecycleTransition",
      "event",
      "workflow",
      "automation",
      "aiAgent"
    ];

    if (this.type && !validTypes.includes(this.type)) {
      errors.push(`type must be one of: ${validTypes.join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * ExecutionResponse
 * Generic response contract for all execution types
 */
export class ExecutionResponse {
  constructor(data = {}) {
    this.executionId = data.executionId;
    this.type = data.type;
    this.target = data.target;
    this.action = data.action;
    this.status = data.status; // pending|validating|validated|executing|executed|failed|dryRun
    this.result = data.result || null;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.dryRun = data.dryRun || false;
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.validationResults = data.validationResults || {};
    this.metadata = data.metadata || {};
    this.executedBy = data.executedBy || null;
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  setResult(result) {
    this.result = result;
  }

  markExecuted(endTime = null) {
    this.endTime = endTime || new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  isSuccess() {
    return this.status === "executed" && this.errors.length === 0;
  }
}

/**
 * ExecutionValidationResult
 * Validation status for request components
 */
export class ExecutionValidationResult {
  constructor() {
    this.targetExists = false;
    this.actionExists = false;
    this.actorAllowed = false;
    this.payloadValid = false;
    this.lifecycleTransitionAllowed = false;
    this.dependenciesAvailable = false;
    this.errors = [];
    this.warnings = [];
  }

  allValid() {
    return (
      this.targetExists &&
      this.actionExists &&
      this.actorAllowed &&
      this.payloadValid &&
      this.dependenciesAvailable
    );
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}
