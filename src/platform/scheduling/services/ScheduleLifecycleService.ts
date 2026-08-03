import type { ScheduleState } from "../contracts";

const transitions: Record<ScheduleState, ScheduleState[]> = {
  DRAFT: ["ACTIVE", "CANCELLED", "FAILED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED", "FAILED"],
  PAUSED: ["ACTIVE", "CANCELLED", "FAILED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ["ACTIVE"],
};

export class ScheduleLifecycleService {
  activate(state: ScheduleState): ScheduleState {
    return this.transition(state, "ACTIVE");
  }

  pause(state: ScheduleState): ScheduleState {
    return this.transition(state, "PAUSED");
  }

  resume(state: ScheduleState): ScheduleState {
    return this.transition(state, "ACTIVE");
  }

  cancel(state: ScheduleState): ScheduleState {
    return this.transition(state, "CANCELLED");
  }

  complete(state: ScheduleState): ScheduleState {
    return this.transition(state, "COMPLETED");
  }

  fail(state: ScheduleState): ScheduleState {
    return this.transition(state, "FAILED");
  }

  transition(from: ScheduleState, to: ScheduleState): ScheduleState {
    if (from === to) {
      return from;
    }

    if (!transitions[from].includes(to)) {
      throw new Error(`schedule_invalid_lifecycle_transition:${from}->${to}`);
    }

    return to;
  }
}
