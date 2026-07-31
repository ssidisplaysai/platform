import type { SubscriptionDefinition } from "./Subscription";

export interface Subscriber {
  subscribe<TPayload = unknown>(definition: SubscriptionDefinition<TPayload>): void;
  unsubscribe(subscriptionId: string): void;
}
