import type { RuntimeKernelDiagnostic, RuntimeKernelState } from "./types";

const TRANSITIONS: Readonly<Record<RuntimeKernelState, readonly RuntimeKernelState[]>> = Object.freeze({
  Created: ["Loading", "Disposed"],
  Loading: ["Validating", "Failed"],
  Validating: ["Initializing", "Failed"],
  Initializing: ["Starting", "Failed"],
  Starting: ["Running", "Failed"],
  Running: ["Stopping", "Recovering", "Failed"],
  Stopping: ["Stopped", "Failed"],
  Stopped: ["Recovering", "Disposed"],
  Recovering: ["Recovered", "Failed"],
  Recovered: ["Running", "Stopping", "Disposed"],
  Failed: ["Recovering", "Disposed"],
  Disposed: [],
});

export class RuntimeStateMachine {
  private state: RuntimeKernelState = "Created";

  current(): RuntimeKernelState {
    return this.state;
  }

  transition(next: RuntimeKernelState): RuntimeKernelDiagnostic[] {
    const allowed = TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      return [{
        code: "GRT-STATE-001",
        severity: "Critical",
        category: "Runtime",
        message: `Illegal runtime lifecycle transition: ${this.state} -> ${next}`,
        blocking: true,
      }];
    }

    this.state = next;
    return [];
  }
}
