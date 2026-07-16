import type { HostState } from "./types";

const HOST_TRANSITIONS: Readonly<Record<HostState, readonly HostState[]>> = Object.freeze({
  Created: ["Starting", "Disposed"],
  Starting: ["Running", "Failed"],
  Running: ["Stopping", "Recovering", "Failed"],
  Stopping: ["Stopped", "Failed"],
  Stopped: ["Starting", "Disposed"],
  Recovering: ["Running", "Failed"],
  Failed: ["Recovering", "Disposed"],
  Disposed: [],
});

export class HostStateMachine {
  private state: HostState = "Created";

  current(): HostState {
    return this.state;
  }

  transition(next: HostState): void {
    const allowed = HOST_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      throw new Error(`Illegal host transition: ${this.state} -> ${next}`);
    }
    this.state = next;
  }
}
