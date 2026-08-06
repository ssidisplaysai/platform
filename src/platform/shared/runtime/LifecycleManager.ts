import type { LifecycleState } from "../contracts";
import { compareDeterministicStrings } from "../utilities";

type LifecycleHandler = {
  stepId: string;
  run(): Promise<void>;
};

function sortHandlers(handlers: readonly LifecycleHandler[]): LifecycleHandler[] {
  return [...handlers].sort((left, right) => compareDeterministicStrings(left.stepId, right.stepId));
}

type LifecycleStopFailure = {
  stepId: string;
  reason: string;
};

export class LifecycleStopError extends Error {
  constructor(
    public readonly code: "INVALID_LIFECYCLE_TRANSITION" | "COMPONENT_STOP_FAILURE" | "MULTIPLE_COMPONENT_STOP_FAILURES",
    message: string,
    public readonly failures: LifecycleStopFailure[] = [],
  ) {
    super(message);
    this.name = "LifecycleStopError";
  }
}

export class LifecycleManager {
  private state: LifecycleState = "CREATED";
  private readonly beforeStartHandlers: LifecycleHandler[] = [];
  private readonly startHandlers: LifecycleHandler[] = [];
  private readonly stopHandlers: LifecycleHandler[] = [];

  getState(): LifecycleState {
    return this.state;
  }

  onBeforeStart(stepId: string, run: () => Promise<void>): void {
    this.beforeStartHandlers.push({ stepId, run });
  }

  onStart(stepId: string, run: () => Promise<void>): void {
    this.startHandlers.push({ stepId, run });
  }

  onStop(stepId: string, run: () => Promise<void>): void {
    this.stopHandlers.push({ stepId, run });
  }

  async start(): Promise<void> {
    if (this.state === "RUNNING") {
      return;
    }

    this.state = "STARTING";
    try {
      for (const handler of sortHandlers(this.beforeStartHandlers)) {
        await handler.run();
      }
      for (const handler of sortHandlers(this.startHandlers)) {
        await handler.run();
      }
      this.state = "RUNNING";
    } catch {
      this.state = "FAILED";
      throw new Error("lifecycle start failed");
    }
  }

  async stop(): Promise<void> {
    if (this.state === "CREATED" || this.state === "STARTING" || this.state === "STOPPING") {
      throw new LifecycleStopError("INVALID_LIFECYCLE_TRANSITION", `lifecycle stop invalid transition: ${this.state}`);
    }

    if (this.state === "STOPPED") {
      return;
    }

    this.state = "STOPPING";
    const failures: LifecycleStopFailure[] = [];
    for (const handler of sortHandlers(this.stopHandlers).reverse()) {
      try {
        await handler.run();
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown error";
        failures.push({ stepId: handler.stepId, reason });
      }
    }

    if (failures.length > 0) {
      this.state = "FAILED";
      const detail = failures.map((failure) => `${failure.stepId}: ${failure.reason}`).join(" | ");
      if (failures.length === 1) {
        throw new LifecycleStopError("COMPONENT_STOP_FAILURE", `lifecycle stop failed for 1 component: ${detail}`, failures);
      }
      throw new LifecycleStopError(
        "MULTIPLE_COMPONENT_STOP_FAILURES",
        `lifecycle stop failed for ${failures.length} components: ${detail}`,
        failures,
      );
    }

    this.state = "STOPPED";
  }
}
