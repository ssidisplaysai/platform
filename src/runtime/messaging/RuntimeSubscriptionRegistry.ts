import type { RuntimeEnvelopeType, RuntimeSubscriptionDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function uniqueSortedEnvelopeTypes(types: readonly RuntimeEnvelopeType[]): readonly RuntimeEnvelopeType[] {
  return Object.freeze([...new Set(types)].sort((a, b) => a.localeCompare(b)) as RuntimeEnvelopeType[]);
}

export class RuntimeSubscriptionRegistry {
  private readonly subscriptions = new Map<string, RuntimeSubscriptionDescriptor>();

  register(descriptor: RuntimeSubscriptionDescriptor): void {
    if (!descriptor.subscriptionId || descriptor.subscriptionId.trim().length === 0) {
      throw new Error("GRT-MSG-SUB-001: subscriptionId is required");
    }
    if (this.subscriptions.has(descriptor.subscriptionId)) {
      throw new Error(`GRT-MSG-SUB-002: Duplicate subscription: ${descriptor.subscriptionId}`);
    }
    if (!descriptor.channel || descriptor.channel.trim().length === 0) {
      throw new Error(`GRT-MSG-SUB-003: channel is required for subscription ${descriptor.subscriptionId}`);
    }
    if (!descriptor.topicPattern || descriptor.topicPattern.trim().length === 0) {
      throw new Error(`GRT-MSG-SUB-004: topicPattern is required for subscription ${descriptor.subscriptionId}`);
    }
    if (!descriptor.subscriberId || descriptor.subscriberId.trim().length === 0) {
      throw new Error(`GRT-MSG-SUB-005: subscriberId is required for subscription ${descriptor.subscriptionId}`);
    }
    if (!descriptor.version || descriptor.version.trim().length === 0) {
      throw new Error(`GRT-MSG-SUB-006: version is required for subscription ${descriptor.subscriptionId}`);
    }
    if (descriptor.acceptedEnvelopeTypes.length === 0) {
      throw new Error(`GRT-MSG-SUB-007: acceptedEnvelopeTypes are required for subscription ${descriptor.subscriptionId}`);
    }

    const normalized = deepFreeze({
      ...descriptor,
      acceptedEnvelopeTypes: uniqueSortedEnvelopeTypes(descriptor.acceptedEnvelopeTypes),
      deliveryPolicy: descriptor.deliveryPolicy ?? "accept",
      metadata: descriptor.metadata
        ? Object.freeze(Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0]))))
        : undefined,
    });

    this.subscriptions.set(normalized.subscriptionId, normalized);
  }

  list(): readonly RuntimeSubscriptionDescriptor[] {
    return Object.freeze(
      [...this.subscriptions.values()].sort((a, b) => {
        const left = `${a.channel}:${a.topicPattern}:${a.subscriptionId}:${a.subscriberKind}:${a.subscriberId}`;
        const right = `${b.channel}:${b.topicPattern}:${b.subscriptionId}:${b.subscriberKind}:${b.subscriberId}`;
        return left.localeCompare(right);
      }),
    );
  }

  get(subscriptionId: string): RuntimeSubscriptionDescriptor {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`GRT-MSG-SUB-008: Unknown subscription: ${subscriptionId}`);
    }
    return subscription;
  }
}
