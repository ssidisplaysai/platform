import { createHash } from "node:crypto";

import { RuntimeExecutionIntent } from "./RuntimeExecutionIntent";
import { RuntimeWorkflow } from "./RuntimeWorkflow";
import type {
  RuntimeActivityDescriptor,
  RuntimeActivityRecord,
  RuntimeCompensationDefinition,
  RuntimeCompensationDefinitionRecord,
  RuntimeExecutionIntentRecord,
  RuntimeTransitionDescriptor,
  RuntimeTransitionRecord,
  RuntimeWaitingDefinition,
  RuntimeWaitingDefinitionRecord,
  RuntimeWorkflowDescriptor,
  RuntimeWorkflowMaterializationRequest,
  RuntimeWorkflowRecord,
} from "./types";
import { deepFreeze, stablePrimitiveRecord, stableSerialize, stableStringArray, stableUnknownRecord } from "./types";

function stableActivity(descriptor: RuntimeActivityDescriptor): RuntimeActivityRecord {
  return deepFreeze({
    activityId: descriptor.activityId,
    activityType: descriptor.activityType,
    targetKind: descriptor.targetKind,
    targetId: descriptor.targetId,
    targetCapability: descriptor.targetCapability,
    commandChannel: descriptor.commandChannel,
    commandTopic: descriptor.commandTopic,
    input: stableUnknownRecord(descriptor.input),
    expectedOutcomes: stableStringArray(descriptor.expectedOutcomes),
    transitionIds: stableStringArray(descriptor.transitionIds),
    waitingPolicy: descriptor.waitingPolicy
      ? deepFreeze({
        ...descriptor.waitingPolicy,
        metadata: stablePrimitiveRecord(descriptor.waitingPolicy.metadata),
      })
      : undefined,
    compensationActivityId: descriptor.compensationActivityId,
    metadata: stablePrimitiveRecord(descriptor.metadata),
    version: descriptor.version,
  });
}

function stableTransition(descriptor: RuntimeTransitionDescriptor): RuntimeTransitionRecord {
  const transitionId = descriptor.transitionId ?? `transition-${createHash("sha256")
    .update(stableSerialize(descriptor))
    .digest("hex")
    .slice(0, 16)}`;

  return deepFreeze({
    transitionId,
    fromActivityId: descriptor.fromActivityId,
    toActivityId: descriptor.toActivityId,
    triggerType: descriptor.triggerType,
    expectedEnvelopeType: descriptor.expectedEnvelopeType,
    expectedChannel: descriptor.expectedChannel,
    expectedTopic: descriptor.expectedTopic,
    expectedMessageType: descriptor.expectedMessageType,
    guardDescriptor: descriptor.guardDescriptor ? deepFreeze({ ...descriptor.guardDescriptor }) : undefined,
    priority: descriptor.priority,
    metadata: stablePrimitiveRecord(descriptor.metadata),
  });
}

function stableWaitingDefinition(descriptor: RuntimeWaitingDefinition): RuntimeWaitingDefinitionRecord {
  const waitingDefinitionId = descriptor.waitingDefinitionId ?? `waiting-definition-${createHash("sha256")
    .update(stableSerialize(descriptor))
    .digest("hex")
    .slice(0, 16)}`;

  return deepFreeze({
    waitingDefinitionId,
    activityId: descriptor.activityId,
    waitingReason: descriptor.waitingReason,
    expectedEnvelopeType: descriptor.expectedEnvelopeType,
    expectedChannel: descriptor.expectedChannel,
    expectedTopic: descriptor.expectedTopic,
    expectedMessageType: descriptor.expectedMessageType,
    correlationId: descriptor.correlationId,
    causationId: descriptor.causationId,
    resumePolicy: descriptor.resumePolicy,
    metadata: stablePrimitiveRecord(descriptor.metadata),
  });
}

function stableCompensationDefinition(descriptor: RuntimeCompensationDefinition): RuntimeCompensationDefinitionRecord {
  const compensationDefinitionId = descriptor.compensationDefinitionId ?? `compensation-definition-${createHash("sha256")
    .update(stableSerialize(descriptor))
    .digest("hex")
    .slice(0, 16)}`;

  return deepFreeze({
    compensationDefinitionId,
    activityId: descriptor.activityId,
    compensationActivityId: descriptor.compensationActivityId,
    trigger: descriptor.trigger,
    metadata: stablePrimitiveRecord(descriptor.metadata),
  });
}

export class RuntimeWorkflowFactory {
  workflowIdentityFor(descriptor: RuntimeWorkflowDescriptor): string {
    const canonical = stableSerialize({
      processType: descriptor.processType,
      name: descriptor.name,
      version: descriptor.version,
      entryActivityIds: stableStringArray(descriptor.entryActivityIds),
      exitActivityIds: stableStringArray(descriptor.exitActivityIds),
      activities: [...descriptor.activities].map((activity) => stableActivity(activity)).sort((a, b) => a.activityId.localeCompare(b.activityId)),
      transitions: [...descriptor.transitions].map((transition) => stableTransition(transition)).sort((a, b) => a.transitionId.localeCompare(b.transitionId)),
      waitingDefinitions: [...descriptor.waitingDefinitions].map((definition) => stableWaitingDefinition(definition)).sort((a, b) => a.waitingDefinitionId.localeCompare(b.waitingDefinitionId)),
      compensationDefinitions: [...descriptor.compensationDefinitions].map((definition) => stableCompensationDefinition(definition)).sort((a, b) => a.compensationDefinitionId.localeCompare(b.compensationDefinitionId)),
      metadata: stablePrimitiveRecord(descriptor.metadata),
      schemaVersion: descriptor.schemaVersion,
    });
    return `workflow-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  activityIdentityFor(workflowId: string, descriptor: Omit<RuntimeActivityDescriptor, "activityId">): string {
    const canonical = stableSerialize({ workflowId, descriptor: stableActivity({ ...descriptor, activityId: "derived" }) });
    return `activity-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  workflowInstanceIdentityFor(
    runtimeInstanceId: string,
    workflowId: string,
    request: RuntimeWorkflowMaterializationRequest,
  ): string {
    const canonical = stableSerialize({
      runtimeInstanceId,
      workflowId,
      startCause: request.startCause ?? {},
      correlationId: request.correlationId,
      causationId: request.causationId,
      metadata: stablePrimitiveRecord(request.metadata),
    });
    return `workflow-instance-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  executionIntentIdentityFor(record: Omit<RuntimeExecutionIntentRecord, "intentId">, ordinal: number): string {
    return RuntimeExecutionIntent.identityFor(record, ordinal);
  }

  create(descriptor: RuntimeWorkflowDescriptor): RuntimeWorkflow {
    this.validateDescriptor(descriptor);
    const workflowId = this.workflowIdentityFor(descriptor);
    const record: RuntimeWorkflowRecord = {
      processId: workflowId,
      workflowId,
      processType: descriptor.processType,
      name: descriptor.name,
      version: descriptor.version,
      entryActivityIds: stableStringArray(descriptor.entryActivityIds),
      exitActivityIds: stableStringArray(descriptor.exitActivityIds),
      activities: Object.freeze([...descriptor.activities].map((activity) => stableActivity(activity)).sort((a, b) => a.activityId.localeCompare(b.activityId))),
      transitions: Object.freeze([...descriptor.transitions].map((transition) => stableTransition(transition)).sort((a, b) => a.transitionId.localeCompare(b.transitionId))),
      waitingDefinitions: Object.freeze([...descriptor.waitingDefinitions].map((definition) => stableWaitingDefinition(definition)).sort((a, b) => a.waitingDefinitionId.localeCompare(b.waitingDefinitionId))),
      compensationDefinitions: Object.freeze([...descriptor.compensationDefinitions].map((definition) => stableCompensationDefinition(definition)).sort((a, b) => a.compensationDefinitionId.localeCompare(b.compensationDefinitionId))),
      metadata: stablePrimitiveRecord(descriptor.metadata),
      schemaVersion: descriptor.schemaVersion,
    };
    return new RuntimeWorkflow(deepFreeze(record));
  }

  private validateDescriptor(descriptor: RuntimeWorkflowDescriptor): void {
    if (descriptor.processType !== "RuntimeWorkflow") {
      throw new Error("GRT-WF-FACTORY-001: processType must be RuntimeWorkflow");
    }
    if (!descriptor.name.trim()) {
      throw new Error("GRT-WF-FACTORY-002: workflow name is required");
    }
    if (!descriptor.version.trim()) {
      throw new Error("GRT-WF-FACTORY-003: workflow version is required");
    }
    if (!descriptor.schemaVersion.trim()) {
      throw new Error("GRT-WF-FACTORY-004: workflow schemaVersion is required");
    }
    if (descriptor.activities.length === 0) {
      throw new Error("GRT-WF-FACTORY-005: workflow requires at least one activity");
    }
    for (const activity of descriptor.activities) {
      if (!activity.activityId.trim()) {
        throw new Error("GRT-WF-FACTORY-006: activityId is required");
      }
      if (!activity.targetId.trim()) {
        throw new Error(`GRT-WF-FACTORY-007: targetId is required for activity ${activity.activityId}`);
      }
      if (!activity.targetCapability.trim()) {
        throw new Error(`GRT-WF-FACTORY-008: targetCapability is required for activity ${activity.activityId}`);
      }
      if (!activity.commandChannel.trim()) {
        throw new Error(`GRT-WF-FACTORY-009: commandChannel is required for activity ${activity.activityId}`);
      }
      if (!activity.commandTopic.trim()) {
        throw new Error(`GRT-WF-FACTORY-010: commandTopic is required for activity ${activity.activityId}`);
      }
      if (!activity.version.trim()) {
        throw new Error(`GRT-WF-FACTORY-011: activity version is required for activity ${activity.activityId}`);
      }
    }
  }
}
