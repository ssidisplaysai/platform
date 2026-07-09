/**
 * RuntimeExecutionEngine - Genesis Runtime Execution v1
 *
 * Generic execution engine that:
 * - Accepts metadata-driven execution requests
 * - Validates targets, actions, actors, payloads
 * - Supports dry-run mode
 * - Returns structured execution results
 *
 * Execution types supported:
 * - command: Execute API command
 * - query: Execute API query
 * - event: Emit and handle event
 * - workflow: Execute workflow
 * - automation: Execute automation
 * - aiAgent: Invoke AI agent
 * - lifecycleTransition: Transition object lifecycle
 *
 * @module tools/genesis/runtime/RuntimeExecutionEngine.mjs
 */

import { ExecutionRequest, ExecutionResponse } from "./ExecutionContract.mjs";
import { ExecutionValidator } from "./ExecutionValidator.mjs";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class RuntimeExecutionEngine {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      ...config
    };

    this.validator = new ExecutionValidator();
    this.executionHistory = [];
    this.runtimeReady = false;
  }

  /**
   * Initialize engine with runtime manifest
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
      this.validator.runtimeManifest = manifest;

      if (!this.runtimeReady) {
        throw new Error("Runtime is not in READY state. Run 'genesis boot' first.");
      }

      return true;
    } catch (error) {
      throw new Error(
        `Failed to initialize execution engine: ${error.message}`
      );
    }
  }

  /**
   * Execute a request
   */
  async execute(requestData) {
    // Create request object
    const request =
      requestData instanceof ExecutionRequest
        ? requestData
        : new ExecutionRequest(requestData);

    // Validate request format
    const formatValidation = request.validate();
    if (!formatValidation.isValid) {
      const response = new ExecutionResponse({
        executionId: request.executionId,
        type: request.type,
        target: request.target,
        action: request.action,
        status: "failed",
        dryRun: request.dryRun,
        errors: formatValidation.errors,
        startTime: new Date().toISOString()
      });
      response.markExecuted();
      return response;
    }

    // Create response
    const response = new ExecutionResponse({
      executionId: request.executionId,
      type: request.type,
      target: request.target,
      action: request.action,
      status: "validating",
      dryRun: request.dryRun,
      startTime: new Date().toISOString(),
      executedBy: request.actor
    });

    try {
      // Stage 1: Validate request
      const validationResult = this.validator.validate(request);
      response.validationResults = {
        targetExists: validationResult.targetExists,
        actionExists: validationResult.actionExists,
        actorAllowed: validationResult.actorAllowed,
        payloadValid: validationResult.payloadValid,
        dependenciesAvailable: validationResult.dependenciesAvailable,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      };

      validationResult.errors.forEach((err) => response.addError(err));
      validationResult.warnings.forEach((warn) => response.addWarning(warn));

      if (!validationResult.allValid()) {
        response.status = "failed";
        response.markExecuted();
        this.executionHistory.push(response);
        return response;
      }

      response.status = "validated";

      // Stage 2: Handle dry-run
      if (request.dryRun) {
        response.status = "dryRun";
        response.result = {
          message: "Dry-run simulation completed",
          executionType: request.type,
          target: request.target,
          action: request.action,
          wouldExecute: true,
          simulatedResult: this.simulateExecution(request)
        };
        response.markExecuted();
        this.executionHistory.push(response);
        return response;
      }

      // Stage 3: Execute
      response.status = "executing";
      const executionResult = await this.executeRequest(request);

      response.status = "executed";
      response.setResult(executionResult);
      response.markExecuted();
    } catch (error) {
      response.status = "failed";
      response.addError(error.message);
      response.markExecuted();
    }

    this.executionHistory.push(response);
    return response;
  }

  /**
   * Execute the actual request (simulated for v1)
   */
  async executeRequest(request) {
    // For v1, execution is simulated but uses real runtime metadata
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.simulateExecution(request));
      }, Math.random() * 100); // Simulate variable latency
    });
  }

  /**
   * Simulate execution based on request type
   */
  simulateExecution(request) {
    const { type, target, action, payload, actor } = request;

    switch (type) {
      case "command":
        return {
          type: "command",
          target,
          action,
          status: "executed",
          message: `Command '${action}' executed on '${target}'`,
          result: {
            affected: payload.id ? 1 : 0,
            timestamp: new Date().toISOString()
          }
        };

      case "query":
        return {
          type: "query",
          target,
          action,
          status: "executed",
          message: `Query '${action}' executed on '${target}'`,
          results: [
            {
              id: "item-1",
              data: payload
            }
          ],
          count: 1
        };

      case "event":
        return {
          type: "event",
          target,
          action,
          status: "emitted",
          message: `Event '${action}' emitted on '${target}'`,
          eventId: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          handlers: 1
        };

      case "workflow":
        return {
          type: "workflow",
          target,
          action,
          status: "started",
          message: `Workflow '${target}' started`,
          workflowId: `wf-${Date.now()}`,
          stages: 5,
          currentStage: 1
        };

      case "automation":
        return {
          type: "automation",
          target,
          action,
          status: "triggered",
          message: `Automation '${target}' triggered`,
          automationId: `auto-${Date.now()}`,
          actions: 3,
          executedActions: 1
        };

      case "aiAgent":
        return {
          type: "aiAgent",
          target,
          action,
          status: "invoked",
          message: `AI Agent '${target}' invoked`,
          agentId: `agent-${Date.now()}`,
          response: `Agent processed request for '${action}'`,
          confidence: 0.95
        };

      case "lifecycleTransition":
        const { currentState, nextState } = payload;
        return {
          type: "lifecycleTransition",
          target,
          status: "transitioned",
          message: `Lifecycle transitioned from '${currentState}' to '${nextState}'`,
          previousState: currentState,
          newState: nextState,
          transitionedAt: new Date().toISOString(),
          transitionedBy: actor
        };

      default:
        return {
          type: request.type,
          target,
          action,
          status: "executed",
          message: `Request processed`
        };
    }
  }

  /**
   * Get execution history
   */
  getHistory() {
    return this.executionHistory;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId) {
    return this.executionHistory.find((e) => e.executionId === executionId);
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter((e) => e.isSuccess()).length;
    const failed = this.executionHistory.filter((e) => e.status === "failed").length;
    const dryRuns = this.executionHistory.filter((e) => e.status === "dryRun").length;

    const byType = {};
    this.executionHistory.forEach((e) => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });

    return {
      total,
      successful,
      failed,
      dryRuns,
      byType,
      uptime: this.runtimeReady ? "operational" : "not ready"
    };
  }
}
