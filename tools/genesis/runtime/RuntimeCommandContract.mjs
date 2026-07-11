/**
 * RuntimeCommandContract - Command Bus contracts
 *
 * Defines contracts for state-changing operations:
 * - create, update, delete, restore, archive
 * - lifecycle transitions
 * - workflow start, automation trigger, aiAgent invoke
 *
 * Commands MUST change state.
 * Commands MUST validate against runtime metadata.
 *
 * @module tools/genesis/runtime/RuntimeCommandContract.mjs
 */

/**
 * RuntimeCommand
 * Generic contract for all state-changing operations
 */
export class RuntimeCommand {
  constructor(data = {}) {
    this.commandId = data.commandId || `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.commandType = data.commandType; // create|update|delete|restore|archive|lifecycle|workflow|automation|aiAgent
    this.aggregateType = data.aggregateType; // what type of thing (Company, Customer, etc.)
    this.aggregateId = data.aggregateId; // ID of the thing
    this.action = data.action; // specific action (POST, PUT, DELETE, etc.)
    this.payload = data.payload || {}; // command-specific data
    this.actor = data.actor || "system"; // who issued the command
    this.dryRun = data.dryRun || false;
    this.metadata = data.metadata || {};
    this.issuedAt = new Date().toISOString();
  }

  validate() {
    const errors = [];

    if (!this.commandType) {
      errors.push("commandType is required");
    }

    if (!this.aggregateType) {
      errors.push("aggregateType is required");
    }

    if (!this.action) {
      errors.push("action is required");
    }

    const validCommandTypes = [
      "create",
      "update",
      "delete",
      "softDelete",
      "restore",
      "archive",
      "lifecycleTransition",
      "workflowStart",
      "automationTrigger",
      "aiAgentInvoke"
    ];

    if (this.commandType && !validCommandTypes.includes(this.commandType)) {
      errors.push(`commandType must be one of: ${validCommandTypes.join(", ")}`);
    }

    // aggregateId required for: update, delete, softDelete, restore, archive, lifecycleTransition, and status queries
    // Not required for: create, workflowStart, automationTrigger, aiAgentInvoke, relationships lookup, module lookup
    const requiresAggregateId = [
      "update",
      "delete",
      "softDelete",
      "restore",
      "archive",
      "lifecycleTransition"
    ];

    if (requiresAggregateId.includes(this.commandType) && !this.aggregateId) {
      errors.push("aggregateId is required for " + this.commandType);
    }

    if (typeof this.payload !== "object" || Array.isArray(this.payload)) {
      errors.push("payload must be a JSON object (not an array or primitive)");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isStateChanging() {
    // All commands change state by definition
    return true;
  }
}

/**
 * RuntimeCommandResult
 * Response from command execution
 */
export class RuntimeCommandResult {
  constructor(data = {}) {
    this.commandId = data.commandId;
    this.commandType = data.commandType;
    this.aggregateType = data.aggregateType;
    this.aggregateId = data.aggregateId;
    this.status = data.status; // pending|validated|executing|executed|failed
    this.result = data.result || null;
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.dryRun = data.dryRun || false;
    this.validationResults = data.validationResults || {};
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.metadata = data.metadata || {};
    this.executedBy = data.executedBy || null;
    this.stateChanged = false;
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

  markStateChanged() {
    this.stateChanged = true;
  }

  markExecuted(endTime = null) {
    this.endTime = endTime || new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  isSuccess() {
    return (this.status === "executed" || this.status === "dryRun") && this.errors.length === 0;
  }
}

/**
 * CommandValidationResult
 * Validation status for command
 */
export class CommandValidationResult {
  constructor() {
    this.aggregateTypeExists = false;
    this.aggregateExists = false;
    this.actionAllowed = false;
    this.actorAllowed = false;
    this.payloadValid = false;
    this.stateTransitionAllowed = false;
    this.errors = [];
    this.warnings = [];
  }

  allValid() {
    return (
      this.aggregateTypeExists &&
      (this.aggregateExists || this.commandType === "create") &&
      this.actionAllowed &&
      this.actorAllowed &&
      this.payloadValid
    );
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}
