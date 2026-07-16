import type { RuntimeExecutionSlot, RuntimeScheduleRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function defaultSlot(currentSequence: number, window: string): RuntimeExecutionSlot {
  return deepFreeze({
    slotId: `slot-${currentSequence.toString().padStart(6, "0")}`,
    sequence: currentSequence,
    window,
  });
}

export interface RuntimeTriggerEvaluationContext {
  currentSequence: number;
  observedEvent?: { channel: string; topic: string; messageId?: string };
  observedCommand?: { channel: string; topic: string; messageId?: string };
  completedDependencies?: readonly { dependencyId: string; requiredState: string }[];
  completedWorkflows?: readonly string[];
  recoveryReason?: string;
  manualApprovalId?: string;
}

export class RuntimeTriggerRegistry {
  evaluate(schedule: RuntimeScheduleRecord, context: RuntimeTriggerEvaluationContext): RuntimeExecutionSlot | undefined {
    switch (schedule.trigger.triggerType) {
      case "Immediate":
        return defaultSlot(context.currentSequence, "immediate");
      case "Slot":
        if (schedule.trigger.slot && schedule.trigger.slot.sequence === context.currentSequence) {
          return schedule.trigger.slot;
        }
        return undefined;
      case "Recurrence": {
        const interval = schedule.trigger.recurrence?.interval ?? 0;
        const limit = schedule.trigger.recurrence?.limit;
        if (interval <= 0) {
          return undefined;
        }
        const occurrence = context.currentSequence / interval;
        if (context.currentSequence % interval !== 0) {
          return undefined;
        }
        if (limit !== undefined && occurrence > limit) {
          return undefined;
        }
        return defaultSlot(context.currentSequence, `recurrence-${interval}`);
      }
      case "DependencyCompletion": {
        const dependency = schedule.trigger.dependency;
        const matched = context.completedDependencies?.some((entry) =>
          entry.dependencyId === dependency?.dependencyId && entry.requiredState === dependency.requiredState);
        return matched ? defaultSlot(context.currentSequence, "dependency") : undefined;
      }
      case "RuntimeEvent": {
        const event = schedule.trigger.event;
        const observed = context.observedEvent;
        if (event && observed && event.channel === observed.channel && event.topic === observed.topic) {
          return defaultSlot(context.currentSequence, "event");
        }
        return undefined;
      }
      case "RuntimeCommand": {
        const command = schedule.trigger.command;
        const observed = context.observedCommand;
        if (command && observed && command.channel === observed.channel && command.topic === observed.topic) {
          return defaultSlot(context.currentSequence, "command");
        }
        return undefined;
      }
      case "WorkflowCompletion": {
        const workflowId = schedule.trigger.workflow?.workflowId;
        return workflowId && context.completedWorkflows?.includes(workflowId)
          ? defaultSlot(context.currentSequence, "workflow")
          : undefined;
      }
      case "Recovery": {
        const reason = schedule.trigger.recovery?.reason;
        return reason && context.recoveryReason === reason
          ? defaultSlot(context.currentSequence, "recovery")
          : undefined;
      }
      case "Manual": {
        const approvalId = schedule.trigger.manual?.approvalId;
        return approvalId && context.manualApprovalId === approvalId
          ? defaultSlot(context.currentSequence, "manual")
          : undefined;
      }
      default:
        return undefined;
    }
  }
}