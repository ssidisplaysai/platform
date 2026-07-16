import type { RuntimeEnvelopeSnapshot, RuntimeRoutingTableEntry, RuntimeSubscriptionDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}.`);
  }
  return pattern === topic;
}

export class RuntimeRouter {
  route(
    envelope: RuntimeEnvelopeSnapshot,
    subscriptions: readonly RuntimeSubscriptionDescriptor[],
  ): readonly RuntimeSubscriptionDescriptor[] {
    return Object.freeze(
      subscriptions
        .filter((subscription) =>
          subscription.channel === envelope.channel
          && topicMatches(subscription.topicPattern, envelope.topic)
          && subscription.acceptedEnvelopeTypes.includes(envelope.envelopeType))
        .sort((a, b) => {
          const left = `${a.subscriptionId}:${a.subscriberKind}:${a.subscriberId}`;
          const right = `${b.subscriptionId}:${b.subscriberKind}:${b.subscriberId}`;
          return left.localeCompare(right);
        }),
    );
  }

  routingTable(subscriptions: readonly RuntimeSubscriptionDescriptor[]): readonly RuntimeRoutingTableEntry[] {
    const groups = new Map<string, string[]>();
    for (const subscription of subscriptions) {
      const key = `${subscription.channel}:${subscription.topicPattern}`;
      const list = groups.get(key) ?? [];
      list.push(subscription.subscriptionId);
      groups.set(key, list);
    }

    return Object.freeze(
      [...groups.entries()]
        .map(([key, subscriptionIds]) => {
          const split = key.indexOf(":");
          return deepFreeze({
            channel: key.slice(0, split),
            topicPattern: key.slice(split + 1),
            subscriptionIds: Object.freeze([...subscriptionIds].sort((a, b) => a.localeCompare(b))),
          });
        })
        .sort((a, b) => `${a.channel}:${a.topicPattern}`.localeCompare(`${b.channel}:${b.topicPattern}`)),
    );
  }
}
