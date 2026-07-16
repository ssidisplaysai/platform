import type { HostState, RuntimeHostEvent } from "./types";

export class HostEventRouter {
  private sequence = 1;
  private readonly events: RuntimeHostEvent[] = [];

  emit(eventType: RuntimeHostEvent["eventType"], hostState: HostState, details: Readonly<Record<string, unknown>>, runtimeInstanceId?: string): void {
    this.events.push(Object.freeze({
      sequence: this.sequence++,
      eventType,
      hostState,
      runtimeInstanceId,
      details,
    }));
  }

  history(): readonly RuntimeHostEvent[] {
    return Object.freeze([...this.events]);
  }
}
