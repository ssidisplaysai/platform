import type { SubscriptionDefinition } from "../contracts";
import { MessageBus } from "./MessageBus";

export class EventSubscriber {
  constructor(private readonly bus: MessageBus) {}

  subscribe<TPayload = unknown>(definition: SubscriptionDefinition<TPayload>): void {
    this.bus.subscribe(definition);
  }

  unsubscribe(subscriptionId: string): void {
    this.bus.unsubscribe(subscriptionId);
  }
}
