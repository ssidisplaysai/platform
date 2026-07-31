import type { MessageEnvelope, Router, SubscriptionDefinition } from "../contracts";
import { TopicRegistry } from "./TopicRegistry";
import { SubscriptionRegistry } from "./SubscriptionRegistry";

export class MessageRouter implements Router {
  constructor(
    private readonly topicRegistry: TopicRegistry,
    private readonly subscriptionRegistry: SubscriptionRegistry,
  ) {}

  route<TPayload = unknown>(topic: string, _envelope: MessageEnvelope<TPayload>): Array<SubscriptionDefinition<TPayload>> {
    if (!this.topicRegistry.has(topic)) {
      return [];
    }

    return this.subscriptionRegistry.resolve(topic);
  }
}
