import type { RuntimeDeliveryRecord, RuntimeEnvelopeSnapshot, RuntimeSubscriptionDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeDispatcher {
  dispatch(
    envelope: RuntimeEnvelopeSnapshot,
    subscriptions: readonly RuntimeSubscriptionDescriptor[],
    mode: "publish" | "replay" = "publish",
  ): { deliveries: readonly RuntimeDeliveryRecord[]; deadLettered: boolean } {
    const deliveries = subscriptions.map((subscription) => {
      const rejected = subscription.deliveryPolicy === "reject";
      return deepFreeze({
        messageId: envelope.messageId,
        subscriptionId: subscription.subscriptionId,
        subscriberKind: subscription.subscriberKind,
        subscriberId: subscription.subscriberId,
        status: rejected ? "Rejected" : mode === "replay" ? "Replayed" : "Delivered",
        reason: rejected ? "delivery-rejected" : undefined,
      } satisfies RuntimeDeliveryRecord);
    });

    const deadLettered = deliveries.length === 0 || deliveries.every((entry) => entry.status === "Rejected");
    return deepFreeze({
      deliveries: Object.freeze(deliveries),
      deadLettered,
    });
  }
}
