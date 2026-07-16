import { createHash } from "node:crypto";

import { RuntimeSchedule } from "./RuntimeSchedule";
import type {
  RuntimeExecutionSlot,
  RuntimeExecutionWindowPolicy,
  RuntimeExpirationPolicy,
  RuntimeRetryPolicy,
  RuntimeScheduleDescriptor,
  RuntimeScheduleRecord,
  RuntimeScheduleTrigger,
  RuntimeSchedulingPrimitive,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function stableRecord(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return deepFreeze(Object.fromEntries(Object.entries(record).sort((a, b) => a[0].localeCompare(b[0]))));
}

function stablePrimitiveRecord(
  record: Readonly<Record<string, RuntimeSchedulingPrimitive>>,
): Readonly<Record<string, RuntimeSchedulingPrimitive>> {
  return stableRecord(record) as Readonly<Record<string, RuntimeSchedulingPrimitive>>;
}

function stableSlot(slot?: RuntimeExecutionSlot): RuntimeExecutionSlot | undefined {
  if (!slot) {
    return undefined;
  }
  return deepFreeze({
    ...slot,
    metadata: slot.metadata ? stablePrimitiveRecord(slot.metadata) : undefined,
  });
}

function stableTrigger(trigger: RuntimeScheduleTrigger): RuntimeScheduleTrigger {
  return deepFreeze({
    ...trigger,
    slot: stableSlot(trigger.slot),
    recurrence: trigger.recurrence ? { ...trigger.recurrence } : undefined,
    dependency: trigger.dependency ? { ...trigger.dependency } : undefined,
    event: trigger.event ? { ...trigger.event } : undefined,
    command: trigger.command ? { ...trigger.command } : undefined,
    workflow: trigger.workflow ? { ...trigger.workflow } : undefined,
    recovery: trigger.recovery ? { ...trigger.recovery } : undefined,
    manual: trigger.manual ? { ...trigger.manual } : undefined,
  });
}

function stableWindow(executionWindow: RuntimeExecutionWindowPolicy): RuntimeExecutionWindowPolicy {
  return deepFreeze({
    ...executionWindow,
    allowedSequences: Object.freeze([...executionWindow.allowedSequences].sort((a, b) => a - b)),
    graceSequences: Object.freeze([...executionWindow.graceSequences].sort((a, b) => a - b)),
    metadata: executionWindow.metadata ? stablePrimitiveRecord(executionWindow.metadata) : undefined,
  });
}

function stableRetryPolicy(retryPolicy: RuntimeRetryPolicy): RuntimeRetryPolicy {
  return deepFreeze({ ...retryPolicy });
}

function stableExpiration(expirationPolicy: RuntimeExpirationPolicy): RuntimeExpirationPolicy {
  return deepFreeze({ ...expirationPolicy });
}

export class RuntimeScheduleFactory {
  identityFor(descriptor: RuntimeScheduleDescriptor): string {
    const canonical = JSON.stringify({
      scheduleType: descriptor.scheduleType,
      targetKind: descriptor.targetKind,
      targetId: descriptor.targetId,
      targetCapability: descriptor.targetCapability,
      commandChannel: descriptor.commandChannel,
      commandTopic: descriptor.commandTopic,
      commandPayload: stableRecord(descriptor.commandPayload),
      trigger: stableTrigger(descriptor.trigger),
      executionWindow: stableWindow(descriptor.executionWindow),
      retryPolicy: stableRetryPolicy(descriptor.retryPolicy),
      expirationPolicy: stableExpiration(descriptor.expirationPolicy),
      priority: descriptor.priority,
      metadata: stableRecord(descriptor.metadata),
      version: descriptor.version,
    });
    return `schedule-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  create(descriptor: RuntimeScheduleDescriptor): RuntimeSchedule {
    this.validateDescriptor(descriptor);
    const record: RuntimeScheduleRecord = {
      scheduleId: this.identityFor(descriptor),
      scheduleType: descriptor.scheduleType,
      targetKind: descriptor.targetKind,
      targetId: descriptor.targetId,
      targetCapability: descriptor.targetCapability,
      commandChannel: descriptor.commandChannel,
      commandTopic: descriptor.commandTopic,
      commandPayload: stableRecord(descriptor.commandPayload),
      trigger: stableTrigger(descriptor.trigger),
      executionWindow: stableWindow(descriptor.executionWindow),
      retryPolicy: stableRetryPolicy(descriptor.retryPolicy),
      expirationPolicy: stableExpiration(descriptor.expirationPolicy),
      priority: descriptor.priority,
      metadata: stablePrimitiveRecord(descriptor.metadata),
      version: descriptor.version,
    };

    return new RuntimeSchedule(deepFreeze(record));
  }

  private validateDescriptor(descriptor: RuntimeScheduleDescriptor): void {
    if (!descriptor.targetId || descriptor.targetId.trim().length === 0) {
      throw new Error("GRT-SCH-SCHEDULE-001: targetId is required");
    }
    if (!descriptor.targetCapability || descriptor.targetCapability.trim().length === 0) {
      throw new Error(`GRT-SCH-SCHEDULE-002: targetCapability is required for target ${descriptor.targetId}`);
    }
    if (!descriptor.commandChannel || descriptor.commandChannel.trim().length === 0) {
      throw new Error(`GRT-SCH-SCHEDULE-003: commandChannel is required for target ${descriptor.targetId}`);
    }
    if (!descriptor.commandTopic || descriptor.commandTopic.trim().length === 0) {
      throw new Error(`GRT-SCH-SCHEDULE-004: commandTopic is required for target ${descriptor.targetId}`);
    }
    if (!descriptor.version || descriptor.version.trim().length === 0) {
      throw new Error(`GRT-SCH-SCHEDULE-005: version is required for target ${descriptor.targetId}`);
    }
  }
}