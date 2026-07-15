import type { CompilerEvent } from "./types";

export type CompilerEventSubscriber = (event: CompilerEvent) => void;

export class CompilerEventBus {
  private readonly events: CompilerEvent[] = [];
  private readonly subscribers = new Set<CompilerEventSubscriber>();

  subscribe(subscriber: CompilerEventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  publish(event: CompilerEvent): void {
    this.events.push(event);
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  snapshot(): readonly CompilerEvent[] {
    return [...this.events];
  }
}