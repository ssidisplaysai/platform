import type { MessageEnvelope } from "./MessageEnvelope";
import type { SubscriptionDefinition } from "./Subscription";

export interface Router {
  route<TPayload = unknown>(topic: string, envelope: MessageEnvelope<TPayload>): Array<SubscriptionDefinition<TPayload>>;
}
