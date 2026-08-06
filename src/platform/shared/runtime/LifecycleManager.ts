import type { LifecycleState } from "../contracts";

type LifecycleHandler = {
  stepId: string;
  run(): Promise<void>;
};

function sortHandlers(handlers: readonly LifecycleHandler[]): LifecycleHandler[] {
  return [...handlers].sort((left, right) => left.stepId.localeCompare(right.stepId));
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
    if (this.state === "STOPPED") {
      return;
    }

    this.state = "STOPPING";
    for (const handler of sortHandlers(this.stopHandlers)) {
      await handler.run();
    }
    this.state = "STOPPED";
  }
}
