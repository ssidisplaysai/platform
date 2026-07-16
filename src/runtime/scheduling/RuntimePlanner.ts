import { createHash } from "node:crypto";

import { RuntimeExecutionWindow } from "./RuntimeExecutionWindow";
import { RuntimePlanFactory } from "./RuntimePlanFactory";
import { RuntimeTriggerRegistry, type RuntimeTriggerEvaluationContext } from "./RuntimeTriggerRegistry";
import type { RuntimePlanRecord, RuntimeScheduleRecord } from "./types";

export class RuntimePlanner {
  private readonly triggers = new RuntimeTriggerRegistry();
  private readonly windows = new RuntimeExecutionWindow();
  private readonly planFactory = new RuntimePlanFactory();

  planIfDue(
    runtimeInstanceId: string,
    runtimeId: string,
    schedule: RuntimeScheduleRecord,
    plannedSequence: number,
    attempt: number,
    context: RuntimeTriggerEvaluationContext,
    causationId?: string,
  ): RuntimePlanRecord | undefined {
    const slot = this.triggers.evaluate(schedule, context);
    if (!slot) {
      return undefined;
    }
    if (this.windows.isExpired(context.currentSequence, slot, schedule.expirationPolicy)) {
      return undefined;
    }
    if (!this.windows.canExecute(context.currentSequence, schedule.executionWindow)) {
      return undefined;
    }

    const correlationId = `correlation-${createHash("sha256")
      .update(JSON.stringify({ runtimeInstanceId, scheduleId: schedule.scheduleId, slotId: slot.slotId, attempt }))
      .digest("hex")
      .slice(0, 16)}`;

    return this.planFactory.create(
      runtimeInstanceId,
      runtimeId,
      schedule,
      slot,
      plannedSequence,
      attempt,
      correlationId,
      causationId,
    ).snapshot();
  }
}