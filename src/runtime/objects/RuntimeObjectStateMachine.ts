import type { RuntimeObjectLifecycleState } from "./types";

const TRANSITIONS: Readonly<Record<RuntimeObjectLifecycleState, readonly RuntimeObjectLifecycleState[]>> = Object.freeze({
  Declared: ["Materialized", "Failed"],
  Materialized: ["Initialized", "Failed", "Archived"],
  Initialized: ["Ready", "Failed", "Archived"],
  Ready: ["Active", "Failed", "Archived"],
  Active: ["Suspended", "Archived", "Failed"],
  Suspended: ["Active", "Archived", "Failed"],
  Archived: [],
  Failed: ["Archived"],
});

export class RuntimeObjectStateMachine {
  canTransition(current: RuntimeObjectLifecycleState, next: RuntimeObjectLifecycleState): boolean {
    return TRANSITIONS[current].includes(next);
  }

  transition(current: RuntimeObjectLifecycleState, next: RuntimeObjectLifecycleState, objectId: string): RuntimeObjectLifecycleState {
    if (!this.canTransition(current, next)) {
      throw new Error(`GRT-OBJ-STATE-001: Illegal object lifecycle transition for ${objectId}: ${current} -> ${next}`);
    }
    return next;
  }
}
