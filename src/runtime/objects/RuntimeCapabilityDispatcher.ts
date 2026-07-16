import { RuntimeObjectFactory } from "./RuntimeObjectFactory";
import type { RuntimeBehaviorRegistry } from "./RuntimeBehaviorRegistry";
import type { RuntimeObjectDiagnostics } from "./RuntimeObjectDiagnostics";
import type { RuntimeObjectEvidence } from "./RuntimeObjectEvidence";
import type { RuntimeObjectRegistry } from "./RuntimeObjectRegistry";
import type { RuntimeObjectStateMachine } from "./RuntimeObjectStateMachine";
import type { RuntimeObjectTelemetry } from "./RuntimeObjectTelemetry";
import type { RuntimePermissionEvaluator } from "./RuntimePermissionEvaluator";
import type {
  RuntimeCapabilityDispatchRequest,
  RuntimeCapabilityDispatchResult,
  RuntimeObjectLifecycleState,
} from "./types";

export class RuntimeCapabilityDispatcher {
  private readonly factory = new RuntimeObjectFactory();

  dispatch(
    runtimeInstanceId: string,
    request: RuntimeCapabilityDispatchRequest,
    collaborators: {
      registry: RuntimeObjectRegistry;
      stateMachine: RuntimeObjectStateMachine;
      behaviorRegistry: RuntimeBehaviorRegistry;
      permissionEvaluator: RuntimePermissionEvaluator;
      diagnostics: RuntimeObjectDiagnostics;
      evidence: RuntimeObjectEvidence;
      telemetry: RuntimeObjectTelemetry;
    },
  ): RuntimeCapabilityDispatchResult {
    const object = collaborators.registry.get(request.objectId);
    collaborators.telemetry.increment("object.dispatch.attempt");
    collaborators.evidence.append(runtimeInstanceId, "DispatchAttempted", { capabilityId: request.capabilityId, principal: request.principal }, object.objectId);

    const capability = collaborators.behaviorRegistry.capability(request.capabilityId);
    const permission = collaborators.permissionEvaluator.evaluate({
      principal: request.principal,
      action: capability.action,
      resource: request.objectId,
      constraints: {
        capabilityId: request.capabilityId,
        classification: object.classification,
      },
    });

    collaborators.evidence.append(runtimeInstanceId, "PermissionEvaluated", {
      granted: permission.granted,
      matchedRuleIds: permission.matchedRuleIds,
      denyRuleIds: permission.denyRuleIds,
      allowRuleIds: permission.allowRuleIds,
    }, object.objectId);

    if (!permission.granted) {
      collaborators.telemetry.increment("object.dispatch.failure");
      collaborators.diagnostics.log(runtimeInstanceId, "Warning", "GRT-OBJ-DISPATCH-001", "Permission denied", object.objectId, {
        capabilityId: request.capabilityId,
      });
      collaborators.evidence.append(runtimeInstanceId, "DispatchFailed", { reason: "permission-denied", capabilityId: request.capabilityId }, object.objectId);
      return Object.freeze({
        objectId: object.objectId,
        capabilityId: request.capabilityId,
        success: false,
        permissionGranted: false,
        diagnosticsCode: "GRT-OBJ-DISPATCH-001",
        output: Object.freeze({ reason: "permission-denied" }),
      });
    }

    if (!capability.allowedStates.includes(object.lifecycleState)) {
      collaborators.telemetry.increment("object.dispatch.failure");
      collaborators.diagnostics.log(runtimeInstanceId, "Warning", "GRT-OBJ-DISPATCH-002", "Lifecycle state not allowed for capability", object.objectId, {
        capabilityId: request.capabilityId,
        lifecycleState: object.lifecycleState,
      });
      collaborators.evidence.append(runtimeInstanceId, "DispatchFailed", { reason: "invalid-lifecycle", capabilityId: request.capabilityId }, object.objectId);
      return Object.freeze({
        objectId: object.objectId,
        capabilityId: request.capabilityId,
        success: false,
        permissionGranted: true,
        diagnosticsCode: "GRT-OBJ-DISPATCH-002",
        output: Object.freeze({ reason: "invalid-lifecycle" }),
      });
    }

    const behavior = collaborators.behaviorRegistry.resolveBehavior(request.capabilityId, object.classification);
    const result = collaborators.behaviorRegistry.execute(behavior, object, request);

    let lifecycleState = object.lifecycleState;
    if (result.nextLifecycleState) {
      lifecycleState = collaborators.stateMachine.transition(object.lifecycleState, result.nextLifecycleState as RuntimeObjectLifecycleState, object.objectId);
    }

    const evolved = this.factory.evolve(object, {
      lifecycleState,
      health: result.health,
      state: result.nextState ?? object.state,
    }).snapshot();

    collaborators.registry.update(evolved);
    collaborators.telemetry.increment("object.dispatch.success");
    collaborators.evidence.append(runtimeInstanceId, "DispatchSucceeded", {
      capabilityId: request.capabilityId,
      behaviorId: behavior.descriptor.behaviorId,
      transitioned: result.nextLifecycleState ? `${object.lifecycleState}->${lifecycleState}` : undefined,
    }, object.objectId);

    return Object.freeze({
      objectId: object.objectId,
      capabilityId: request.capabilityId,
      success: true,
      permissionGranted: true,
      output: result.output,
      stateTransition: result.nextLifecycleState ? { from: object.lifecycleState, to: lifecycleState } : undefined,
    });
  }
}
