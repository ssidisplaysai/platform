import type { MissedRunPolicy, ScheduleOccurrence } from "../contracts";

export class MissedRunPolicyService {
  apply(policy: MissedRunPolicy, dueOccurrences: ScheduleOccurrence[]): ScheduleOccurrence[] {
    if (dueOccurrences.length <= 1) {
      return dueOccurrences;
    }

    const missed = dueOccurrences.slice(0, dueOccurrences.length - 1);
    const current = dueOccurrences[dueOccurrences.length - 1];

    switch (policy.type) {
      case "SKIP":
        return [current];
      case "RUN_ONCE":
        return [current];
      case "CATCH_UP_ALL":
        return dueOccurrences;
      case "CATCH_UP_LIMITED": {
        const limit = Math.max(1, policy.catchUpLimit ?? 1);
        const retainedMissed = missed.slice(-limit);
        return [...retainedMissed, current];
      }
      case "FAIL":
        throw new Error("schedule_missed_run_policy_fail");
      default:
        return [current];
    }
  }
}
