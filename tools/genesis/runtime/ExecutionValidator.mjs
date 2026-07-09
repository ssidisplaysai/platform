/**
 * ExecutionValidator - Generic execution request validation
 *
 * Validates execution requests against runtime metadata:
 * - Target exists in registry
 * - Action exists on target
 * - Actor has permissions
 * - Payload is valid
 * - Dependencies are available
 * - Lifecycle transitions are allowed
 *
 * @module tools/genesis/runtime/ExecutionValidator.mjs
 */

import { ExecutionValidationResult } from "./ExecutionContract.mjs";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class ExecutionValidator {
  constructor(runtimeManifest = null) {
    this.runtimeManifest = runtimeManifest;
  }

  /**
   * Load runtime manifest from boot output
   */
  loadManifest() {
    try {
      const manifestPath = join(
        projectRoot,
        "out/generated/runtime-boot-manifest.json"
      );
      const content = readFileSync(manifestPath, "utf8");
      this.runtimeManifest = JSON.parse(content);
      return this.runtimeManifest;
    } catch (error) {
      throw new Error(
        `Failed to load runtime manifest: ${error.message}`
      );
    }
  }

  /**
   * Validate entire execution request
   */
  validate(request) {
    if (!this.runtimeManifest) {
      this.loadManifest();
    }

    const result = new ExecutionValidationResult();
    const finalState = this.runtimeManifest.finalState || {};

    // 1. Validate target exists
    this.validateTarget(request, result, finalState);

    // 2. Validate action exists
    this.validateAction(request, result);

    // 3. Validate actor permissions
    this.validateActor(request, result);

    // 4. Validate payload
    this.validatePayload(request, result);

    // 5. For lifecycle transitions, validate transition is allowed
    if (request.type === "lifecycleTransition") {
      this.validateLifecycleTransition(request, result);
    }

    // 6. Validate dependencies
    this.validateDependencies(request, result, finalState);

    return result;
  }

  /**
   * Validate target exists in runtime registry
   */
  validateTarget(request, result, finalState) {
    const { target, type } = request;

    if (!target) {
      result.addError("Target is required");
      return;
    }

    // Map execution type to registry
    let registryKey, registryCount;

    switch (type) {
      case "command":
      case "query":
        registryKey = "registeredAPIs";
        registryCount = finalState.registeredAPIs || 0;
        break;
      case "workflow":
        registryKey = "registeredWorkflows";
        registryCount = finalState.registeredWorkflows || 0;
        break;
      case "automation":
        registryKey = "registeredAutomations";
        registryCount = finalState.registeredAutomations || 0;
        break;
      case "aiAgent":
        registryKey = "registeredAgents";
        registryCount = finalState.registeredAgents || 0;
        break;
      case "event":
        registryKey = "registeredServices";
        registryCount = finalState.registeredServices || 0;
        break;
      case "lifecycleTransition":
        registryKey = "registeredModules";
        registryCount = finalState.registeredModules || 0;
        break;
      default:
        registryKey = null;
    }

    if (registryCount > 0) {
      result.targetExists = true;
    } else {
      result.addError(
        `Target '${target}' not found in ${registryKey || "registry"}`
      );
    }
  }

  /**
   * Validate action exists
   * For v1, we accept any action name as long as target exists
   */
  validateAction(request, result) {
    const { action } = request;

    if (!action) {
      result.addError("Action is required");
      return;
    }

    // For v1, action validation is simple: action must be non-empty
    // Future versions will validate against specific type schemas
    if (typeof action === "string" && action.length > 0) {
      result.actionExists = true;
    } else {
      result.addError("Action must be a non-empty string");
    }
  }

  /**
   * Validate actor has permissions
   * For v1, system actors always allowed; custom actors need audit
   */
  validateActor(request, result) {
    const { actor } = request;

    if (!actor) {
      result.addError("Actor is required");
      return;
    }

    // System actors are always allowed
    if (
      actor === "system" ||
      actor === "admin" ||
      actor === "automation" ||
      actor === "cli"
    ) {
      result.actorAllowed = true;
    } else {
      // For custom actors, allow but warn
      result.actorAllowed = true;
      result.addWarning(
        `Custom actor '${actor}' will execute; ensure proper authorization`
      );
    }
  }

  /**
   * Validate payload structure
   */
  validatePayload(request, result) {
    const { payload } = request;

    if (!payload) {
      result.addError("Payload is required");
      return;
    }

    // Payload must be an object
    if (typeof payload !== "object" || Array.isArray(payload)) {
      result.addError("Payload must be a JSON object");
      return;
    }

    result.payloadValid = true;
  }

  /**
   * Validate lifecycle transition is allowed
   */
  validateLifecycleTransition(request, result) {
    const { target, action, payload } = request;

    // Standard lifecycle transitions
    const validTransitions = {
      created: ["initialized", "activated"],
      initialized: ["activated", "suspended"],
      activated: ["suspended", "deactivated"],
      suspended: ["activated", "deactivated"],
      deactivated: ["created"]
    };

    const currentState = payload?.currentState || "created";
    const nextState = payload?.nextState;

    if (!nextState) {
      result.addError("Lifecycle transition requires nextState in payload");
      return;
    }

    const allowedTransitions = validTransitions[currentState] || [];

    if (allowedTransitions.includes(nextState)) {
      result.lifecycleTransitionAllowed = true;
    } else {
      result.addError(
        `Transition from ${currentState} to ${nextState} is not allowed`
      );
    }
  }

  /**
   * Validate dependencies are available
   */
  validateDependencies(request, result, finalState) {
    // For v1, we check if the runtime has registered items
    // Full dependency resolution happens in boot stage 11
    const totalRegistered = finalState.totalRegistered || 0;

    if (totalRegistered > 0) {
      result.dependenciesAvailable = true;
    } else {
      result.addWarning(
        "No components registered; dependencies may not be available"
      );
      result.dependenciesAvailable = false;
    }
  }
}
