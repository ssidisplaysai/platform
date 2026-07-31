import type { DeliveryMode, MessageEnvelope } from "../contracts";

export type MessageMetricsSnapshot = {
  publishedCount: number;
  deliveredCount: number;
  failedCount: number;
  retriedCount: number;
  deadLetterCount: number;
  duplicateSuppressedCount: number;
  byMode: Record<DeliveryMode, number>;
  byTopic: Record<string, { published: number; delivered: number; failed: number }>;
  subscriberStats: Record<string, { delivered: number; failed: number }>;
};

export class MessageMetrics {
  private readonly snapshotState: MessageMetricsSnapshot = {
    publishedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    retriedCount: 0,
    deadLetterCount: 0,
    duplicateSuppressedCount: 0,
    byMode: {
      FIRE_AND_FORGET: 0,
      REQUEST_REPLY: 0,
      PUBLISH_SUBSCRIBE: 0,
      BROADCAST: 0,
      POINT_TO_POINT: 0,
    },
    byTopic: {},
    subscriberStats: {},
  };

  trackPublished(topic: string, mode: DeliveryMode): void {
    this.snapshotState.publishedCount += 1;
    this.snapshotState.byMode[mode] += 1;
    const topicEntry = this.snapshotState.byTopic[topic] ?? { published: 0, delivered: 0, failed: 0 };
    topicEntry.published += 1;
    this.snapshotState.byTopic[topic] = topicEntry;
  }

  trackDelivered(topic: string, subscriberName: string): void {
    this.snapshotState.deliveredCount += 1;
    const topicEntry = this.snapshotState.byTopic[topic] ?? { published: 0, delivered: 0, failed: 0 };
    topicEntry.delivered += 1;
    this.snapshotState.byTopic[topic] = topicEntry;

    const subscriberEntry = this.snapshotState.subscriberStats[subscriberName] ?? { delivered: 0, failed: 0 };
    subscriberEntry.delivered += 1;
    this.snapshotState.subscriberStats[subscriberName] = subscriberEntry;
  }

  trackFailure(topic: string, subscriberName: string): void {
    this.snapshotState.failedCount += 1;
    const topicEntry = this.snapshotState.byTopic[topic] ?? { published: 0, delivered: 0, failed: 0 };
    topicEntry.failed += 1;
    this.snapshotState.byTopic[topic] = topicEntry;

    const subscriberEntry = this.snapshotState.subscriberStats[subscriberName] ?? { delivered: 0, failed: 0 };
    subscriberEntry.failed += 1;
    this.snapshotState.subscriberStats[subscriberName] = subscriberEntry;
  }

  trackRetry(): void {
    this.snapshotState.retriedCount += 1;
  }

  trackDeadLetter(): void {
    this.snapshotState.deadLetterCount += 1;
  }

  trackDuplicateSuppressed(): void {
    this.snapshotState.duplicateSuppressedCount += 1;
  }

  trackAudit(_envelope: MessageEnvelope): void {
    // Placeholder hook for future audit stream counters.
  }

  snapshot(): MessageMetricsSnapshot {
    return {
      ...this.snapshotState,
      byMode: { ...this.snapshotState.byMode },
      byTopic: Object.fromEntries(
        Object.entries(this.snapshotState.byTopic).map(([topic, stats]) => [topic, { ...stats }]),
      ),
      subscriberStats: Object.fromEntries(
        Object.entries(this.snapshotState.subscriberStats).map(([name, stats]) => [name, { ...stats }]),
      ),
    };
  }
}
