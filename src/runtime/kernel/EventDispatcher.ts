import type { RuntimeKernelEvent, RuntimeKernelState } from "./types";

export class EventDispatcher {
  private readonly events: RuntimeKernelEvent[] = [];
  private nextSequence = 1;

  emit(eventType: RuntimeKernelEvent["eventType"], state: RuntimeKernelState, details: Readonly<Record<string, unknown>> = {}): void {
    this.events.push(Object.freeze({
      sequence: this.nextSequence++,
      eventType,
      state,
      details,
    }));
  }

  history(): readonly RuntimeKernelEvent[] {
    return Object.freeze([...this.events]);
  }
}
