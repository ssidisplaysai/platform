import type { RuntimeExecutionSlot, RuntimeRetryState, RuntimeScheduleRecord } from "./types";
import { RuntimeExecutionWindow } from "./RuntimeExecutionWindow";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeRetryPolicyEvaluator {
  private readonly windows = new RuntimeExecutionWindow();

  derive(
    schedule: RuntimeScheduleRecord,
    currentSequence: number,
    slot: RuntimeExecutionSlot,
    previous?: RuntimeRetryState,
  ): RuntimeRetryState {
    const nextAttempt = (previous?.lastAttempt ?? 0) + 1;
    const policy = schedule.retryPolicy;

    if (policy.policyType === "Never") {
      return deepFreeze({ scheduleId: schedule.scheduleId, lastAttempt: nextAttempt, nextEligibleSequence: currentSequence, exhausted: true });
    }

    if (policy.policyType === "CompensationRequired") {
      return deepFreeze({ scheduleId: schedule.scheduleId, lastAttempt: nextAttempt, nextEligibleSequence: currentSequence, exhausted: true });
    }

    if (policy.policyType === "FixedAttempts") {
      const maxAttempts = policy.maxAttempts ?? 1;
      return deepFreeze({
        scheduleId: schedule.scheduleId,
        lastAttempt: nextAttempt,
        nextEligibleSequence: currentSequence + Math.max(policy.interval ?? 1, 1),
        exhausted: nextAttempt >= maxAttempts,
      });
    }

    if (policy.policyType === "LinearBackoff") {
      const interval = Math.max(policy.interval ?? 1, 1);
      return deepFreeze({
        scheduleId: schedule.scheduleId,
        lastAttempt: nextAttempt,
        nextEligibleSequence: currentSequence + (interval * nextAttempt),
        exhausted: false,
      });
    }

    if (policy.policyType === "ExponentialBackoff") {
      const interval = Math.max(policy.interval ?? 1, 1);
      const multiplier = Math.max(policy.multiplier ?? 2, 1);
      return deepFreeze({
        scheduleId: schedule.scheduleId,
        lastAttempt: nextAttempt,
        nextEligibleSequence: currentSequence + (interval * (multiplier ** Math.max(nextAttempt - 1, 0))),
        exhausted: false,
      });
    }

    const expired = this.windows.isExpired(currentSequence, slot, schedule.expirationPolicy);
    return deepFreeze({
      scheduleId: schedule.scheduleId,
      lastAttempt: nextAttempt,
      nextEligibleSequence: currentSequence + 1,
      exhausted: expired,
    });
  }
}