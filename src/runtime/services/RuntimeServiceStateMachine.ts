import type { RuntimeServiceState } from "./types";

const TRANSITIONS: Readonly<Record<RuntimeServiceState, readonly RuntimeServiceState[]>> = Object.freeze({
  Registered: ["Resolving", "Disposed"],
  Resolving: ["Resolved", "Failed"],
  Resolved: ["Activating", "Stopped", "Disposed"],
  Activating: ["Active", "Failed"],
  Active: ["Deactivating", "Failed"],
  Deactivating: ["Stopped", "Failed"],
  Stopped: ["Activating", "Disposed"],
  Failed: ["Stopped", "Disposed"],
  Disposed: [],
});

export class RuntimeServiceStateMachine {
  constructor(private state: RuntimeServiceState = "Registered") {}

  current(): RuntimeServiceState {
    return this.state;
  }

  transition(next: RuntimeServiceState, serviceId: string): void {
    if (!TRANSITIONS[this.state].includes(next)) {
      throw new Error(`GRT-SVC-STATE-001: Illegal service lifecycle transition for ${serviceId}: ${this.state} -> ${next}`);
    }
    this.state = next;
  }
}
