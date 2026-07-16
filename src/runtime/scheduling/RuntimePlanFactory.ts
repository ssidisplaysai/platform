import { createHash } from "node:crypto";

import { RuntimePlan } from "./RuntimePlan";
import type { RuntimeExecutionSlot, RuntimePlanRecord, RuntimeScheduleRecord, RuntimeSchedulingPrimitive } from "./types";

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

function stableSlot(slot: RuntimeExecutionSlot): RuntimeExecutionSlot {
  return deepFreeze({
    ...slot,
    metadata: slot.metadata ? stablePrimitiveRecord(slot.metadata) : undefined,
  });
}

export class RuntimePlanFactory {
  identityFor(record: Omit<RuntimePlanRecord, "planId">): string {
    const canonical = JSON.stringify({
      scheduleId: record.scheduleId,
      runtimeInstanceId: record.runtimeInstanceId,
      runtimeId: record.runtimeId,
      triggerType: record.triggerType,
      targetKind: record.targetKind,
      targetId: record.targetId,
      commandChannel: record.commandChannel,
      commandTopic: record.commandTopic,
      commandPayload: stableRecord(record.commandPayload),
      correlationId: record.correlationId,
      causationId: record.causationId,
      plannedSequence: record.plannedSequence,
      executionSlot: stableSlot(record.executionSlot),
      attempt: record.attempt,
      executionWindow: record.executionWindow,
      expirationPolicy: record.expirationPolicy,
      retryPolicy: record.retryPolicy,
      schemaVersion: record.schemaVersion,
      metadata: stableRecord(record.metadata),
    });
    return `plan-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  create(
    runtimeInstanceId: string,
    runtimeId: string,
    schedule: RuntimeScheduleRecord,
    slot: RuntimeExecutionSlot,
    plannedSequence: number,
    attempt: number,
    correlationId: string,
    causationId?: string,
  ): RuntimePlan {
    const base = deepFreeze({
      scheduleId: schedule.scheduleId,
      runtimeInstanceId,
      runtimeId,
      triggerType: schedule.trigger.triggerType,
      targetKind: schedule.targetKind,
      targetId: schedule.targetId,
      commandChannel: schedule.commandChannel,
      commandTopic: schedule.commandTopic,
      commandPayload: stableRecord(schedule.commandPayload),
      correlationId,
      causationId,
      plannedSequence,
      executionSlot: stableSlot(slot),
      attempt,
      executionWindow: schedule.executionWindow,
      expirationPolicy: schedule.expirationPolicy,
      retryPolicy: schedule.retryPolicy,
      schemaVersion: schedule.version,
      metadata: stablePrimitiveRecord(schedule.metadata),
    });

    return new RuntimePlan(deepFreeze({
      ...base,
      planId: this.identityFor(base),
    }));
  }
}