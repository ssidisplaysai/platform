import type { SubscriptionDefinition } from "../contracts";

export class SubscriptionRegistry {
  private readonly byTopic = new Map<string, Map<string, SubscriptionDefinition>>();
  private readonly topicBySubscription = new Map<string, string>();
  private duplicateRegistrationCount = 0;

  register<TPayload = unknown>(definition: SubscriptionDefinition<TPayload>): void {
    const topicSubscriptions = this.byTopic.get(definition.topic) ?? new Map<string, SubscriptionDefinition>();
    if (topicSubscriptions.has(definition.id)) {
      this.duplicateRegistrationCount += 1;
    }
    topicSubscriptions.set(definition.id, definition as SubscriptionDefinition);
    this.byTopic.set(definition.topic, topicSubscriptions);
    this.topicBySubscription.set(definition.id, definition.topic);
  }

  unregister(subscriptionId: string): void {
    const topic = this.topicBySubscription.get(subscriptionId);
    if (!topic) {
      return;
    }

    const topicSubscriptions = this.byTopic.get(topic);
    topicSubscriptions?.delete(subscriptionId);
    if (topicSubscriptions && topicSubscriptions.size === 0) {
      this.byTopic.delete(topic);
    }

    this.topicBySubscription.delete(subscriptionId);
  }

  resolve<TPayload = unknown>(topic: string): Array<SubscriptionDefinition<TPayload>> {
    const topicSubscriptions = this.byTopic.get(topic);
    if (!topicSubscriptions) {
      return [];
    }

    return [...topicSubscriptions.values()] as Array<SubscriptionDefinition<TPayload>>;
  }

  size(): number {
    return this.topicBySubscription.size;
  }

  sizeByTopic(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const [topic, entries] of this.byTopic.entries()) {
      snapshot[topic] = entries.size;
    }

    return snapshot;
  }

  getDuplicateRegistrationCount(): number {
    return this.duplicateRegistrationCount;
  }
}
