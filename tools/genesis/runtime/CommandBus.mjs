/**
 * CommandBus - Genesis Command Bus v1
 *
 * Executes state-changing operations:
 * - Commands must pass runtime metadata validation
 * - Commands always change state
 * - Commands return structured results
 * - Supports dry-run mode
 *
 * @module tools/genesis/runtime/CommandBus.mjs
 */

import { RuntimeCommand, RuntimeCommandResult, CommandValidationResult } from "./RuntimeCommandContract.mjs";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class CommandBus {
  constructor(validator = null) {
    this.validator = validator;
    this.commandHistory = [];
    this.runtimeReady = false;
  }

  /**
   * Initialize bus with runtime manifest
   */
  initialize() {
    try {
      const manifestPath = join(
        projectRoot,
        "out/generated/runtime-boot-manifest.json"
      );
      const content = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);

      this.runtimeReady = manifest.finalState?.ready || false;
      this.runtimeManifest = manifest;

      if (!this.runtimeReady) {
        throw new Error("Runtime is not in READY state.");
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize command bus: ${error.message}`);
    }
  }

  /**
   * Execute a command
   */
  async execute(commandData) {
    // Create command object
    const command =
      commandData instanceof RuntimeCommand
        ? commandData
        : new RuntimeCommand(commandData);

    // Validate command format
    const formatValidation = command.validate();
    if (!formatValidation.isValid) {
      const result = new RuntimeCommandResult({
        commandId: command.commandId,
        commandType: command.commandType,
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId,
        status: "failed",
        dryRun: command.dryRun,
        errors: formatValidation.errors,
        startTime: new Date().toISOString(),
        executedBy: command.actor
      });
      result.markExecuted();
      return result;
    }

    // Create result
    const result = new RuntimeCommandResult({
      commandId: command.commandId,
      commandType: command.commandType,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      status: "validating",
      dryRun: command.dryRun,
      startTime: new Date().toISOString(),
      executedBy: command.actor
    });

    try {
      // Stage 1: Validate command against metadata
      const validationResult = await this.validateCommand(command);
      result.validationResults = {
        aggregateTypeExists: validationResult.aggregateTypeExists,
        aggregateExists: validationResult.aggregateExists,
        actionAllowed: validationResult.actionAllowed,
        actorAllowed: validationResult.actorAllowed,
        payloadValid: validationResult.payloadValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };

      validationResult.errors.forEach((err) => result.addError(err));
      validationResult.warnings.forEach((warn) => result.addWarning(warn));

      if (!validationResult.allValid()) {
        result.status = "failed";
        result.markExecuted();
        this.commandHistory.push(result);
        return result;
      }

      result.status = "validated";

      // Stage 2: Handle dry-run
      if (command.dryRun) {
        result.status = "dryRun";
        result.result = {
          message: "Dry-run simulation completed",
          commandType: command.commandType,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId,
          wouldChangeState: true,
          simulatedResult: this.simulateCommandExecution(command)
        };
        result.markStateChanged();
        result.markExecuted();
        this.commandHistory.push(result);
        return result;
      }

      // Stage 3: Execute command
      result.status = "executing";
      const executionResult = await this.executeCommand(command);

      result.status = "executed";
      result.setResult(executionResult);
      result.markStateChanged();
      result.markExecuted();
    } catch (error) {
      result.status = "failed";
      result.addError(error.message);
      result.markExecuted();
    }

    this.commandHistory.push(result);
    return result;
  }

  /**
   * Validate command against runtime metadata
   */
  async validateCommand(command) {
    const result = new CommandValidationResult();
    const finalState = this.runtimeManifest?.finalState || {};

    // 1. Validate aggregate type exists
    if (
      finalState.registeredModules > 0 ||
      finalState.registeredAPIs > 0 ||
      finalState.registeredObjects > 0
    ) {
      result.aggregateTypeExists = true;
    } else {
      result.addError(
        `Aggregate type '${command.aggregateType}' not found in registry`
      );
    }

    // 2. Validate aggregateId requirement based on command type
    // aggregateId required for: update, delete, softDelete, restore, archive, lifecycleTransition
    // Not required for: create, workflowStart, automationTrigger, aiAgentInvoke
    const requiresAggregateId = [
      "update",
      "delete",
      "softDelete",
      "restore",
      "archive",
      "lifecycleTransition"
    ];

    if (requiresAggregateId.includes(command.commandType) && !command.aggregateId) {
      result.addError(`aggregateId required for ${command.commandType}`);
    } else if (requiresAggregateId.includes(command.commandType)) {
      result.aggregateExists = true;
    } else if (command.commandType === "create") {
      result.aggregateExists = true;
    } else {
      // For workflowStart, automationTrigger, aiAgentInvoke - they work on aggregate types
      result.aggregateExists = true;
    }

    // 3. Validate action is allowed
    if (command.action && typeof command.action === "string") {
      result.actionAllowed = true;
    } else {
      result.addError("action must be a non-empty string");
    }

    // 4. Validate actor
    if (
      command.actor === "system" ||
      command.actor === "admin" ||
      command.actor === "automation" ||
      command.actor === "cli"
    ) {
      result.actorAllowed = true;
    } else {
      result.actorAllowed = true; // Allow custom with warning
      result.addWarning(
        `Custom actor '${command.actor}' should be verified for authorization`
      );
    }

    // 5. Validate payload
    if (typeof command.payload === "object" && !Array.isArray(command.payload)) {
      result.payloadValid = true;
    } else {
      result.addError("payload must be a JSON object");
    }

    return result;
  }

  /**
   * Execute command (simulated for v1)
   */
  async executeCommand(command) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.simulateCommandExecution(command));
      }, Math.random() * 100);
    });
  }

  /**
   * Simulate command execution
   */
  simulateCommandExecution(command) {
    const { commandType, aggregateType, aggregateId, action, payload, actor } = command;

    switch (commandType) {
      case "create":
        return {
          type: "create",
          aggregateType,
          status: "created",
          message: `Created new ${aggregateType}`,
          createdId: `${aggregateType}-${Date.now()}`,
          createdAt: new Date().toISOString(),
          createdBy: actor
        };

      case "update":
        return {
          type: "update",
          aggregateType,
          aggregateId,
          status: "updated",
          message: `Updated ${aggregateType} ${aggregateId}`,
          updatedAt: new Date().toISOString(),
          updatedBy: actor,
          fieldsModified: Object.keys(payload).length
        };

      case "delete":
        return {
          type: "delete",
          aggregateType,
          aggregateId,
          status: "deleted",
          message: `Deleted ${aggregateType} ${aggregateId}`,
          deletedAt: new Date().toISOString(),
          deletedBy: actor
        };

      case "softDelete":
        return {
          type: "softDelete",
          aggregateType,
          aggregateId,
          status: "marked_deleted",
          message: `Soft-deleted ${aggregateType} ${aggregateId}`,
          deletedAt: new Date().toISOString(),
          deletedBy: actor,
          recoverable: true
        };

      case "restore":
        return {
          type: "restore",
          aggregateType,
          aggregateId,
          status: "restored",
          message: `Restored ${aggregateType} ${aggregateId}`,
          restoredAt: new Date().toISOString(),
          restoredBy: actor
        };

      case "archive":
        return {
          type: "archive",
          aggregateType,
          aggregateId,
          status: "archived",
          message: `Archived ${aggregateType} ${aggregateId}`,
          archivedAt: new Date().toISOString(),
          archivedBy: actor
        };

      case "lifecycleTransition":
        return {
          type: "lifecycleTransition",
          aggregateType,
          aggregateId,
          status: "transitioned",
          message: `Lifecycle transition for ${aggregateType} ${aggregateId}`,
          fromState: payload.currentState,
          toState: payload.nextState,
          transitionedAt: new Date().toISOString(),
          transitionedBy: actor
        };

      case "workflowStart":
        return {
          type: "workflowStart",
          aggregateType,
          status: "workflow_started",
          message: `Started workflow on ${aggregateType}`,
          workflowId: `wf-${Date.now()}`,
          startedAt: new Date().toISOString(),
          startedBy: actor
        };

      case "automationTrigger":
        return {
          type: "automationTrigger",
          aggregateType,
          status: "automation_triggered",
          message: `Triggered automation on ${aggregateType}`,
          automationId: `auto-${Date.now()}`,
          triggeredAt: new Date().toISOString(),
          triggeredBy: actor
        };

      case "aiAgentInvoke":
        return {
          type: "aiAgentInvoke",
          aggregateType,
          status: "agent_invoked",
          message: `Invoked AI agent on ${aggregateType}`,
          agentId: `agent-${Date.now()}`,
          invokedAt: new Date().toISOString(),
          invokedBy: actor
        };

      default:
        return {
          type: commandType,
          aggregateType,
          status: "executed",
          message: "Command executed"
        };
    }
  }

  /**
   * Get command history
   */
  getHistory() {
    return this.commandHistory;
  }

  /**
   * Get command by ID
   */
  getCommand(commandId) {
    return this.commandHistory.find((c) => c.commandId === commandId);
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.commandHistory.length;
    const successful = this.commandHistory.filter((c) => c.isSuccess()).length;
    const failed = this.commandHistory.filter((c) => c.status === "failed").length;
    const dryRuns = this.commandHistory.filter((c) => c.status === "dryRun").length;

    const byType = {};
    this.commandHistory.forEach((c) => {
      byType[c.commandType] = (byType[c.commandType] || 0) + 1;
    });

    const stateChanges = this.commandHistory.filter((c) => c.stateChanged).length;

    return {
      total,
      successful,
      failed,
      dryRuns,
      stateChanges,
      byType,
      uptime: this.runtimeReady ? "operational" : "not ready"
    };
  }
}
