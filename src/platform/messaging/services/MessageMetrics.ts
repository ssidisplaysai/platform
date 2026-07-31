import type { DeliveryMode, MessageEnvelope } from "../contracts";

export type MessageMetricsSnapshot = {
  publishedCount: number;
  deliveredCount: number;
  failedCount: number;
  retriedCount: number;
  deadLetterCount: number;
  duplicateSuppressedCount: number;
  missingSubscriberCount: number;
  unknownTopicCount: number;
  transportFailureCount: number;
  auditFailureCount: number;
  metricsPersistenceFailureCount: number;
  retryDepth: number;
  queueDepth: number;
  oldestPendingMessageAt: string | null;
  averageDeliveryLatencyMs: number;
  averageRetryLatencyMs: number;
  failureRate: number;
  byMode: Record<DeliveryMode, number>;
  byTopic: Record<string, { published: number; delivered: number; failed: number }>;
  subscriberStats: Record<string, { delivered: number; failed: number }>;
};

export class MessageMetrics {
  private deliveryLatencyTotalMs = 0;
  private deliveryLatencySamples = 0;
  private retryLatencyTotalMs = 0;
  private retryLatencySamples = 0;

  private readonly snapshotState: MessageMetricsSnapshot = {
    publishedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    retriedCount: 0,
    deadLetterCount: 0,
    duplicateSuppressedCount: 0,
    missingSubscriberCount: 0,
    unknownTopicCount: 0,
    transportFailureCount: 0,
    auditFailureCount: 0,
    metricsPersistenceFailureCount: 0,
    retryDepth: 0,
    queueDepth: 0,
    oldestPendingMessageAt: null,
    averageDeliveryLatencyMs: 0,
    averageRetryLatencyMs: 0,
    failureRate: 0,
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

  trackMissingSubscriber(): void {
    this.snapshotState.missingSubscriberCount += 1;
  }

  trackUnknownTopic(): void {
    this.snapshotState.unknownTopicCount += 1;
  }

  trackTransportFailure(): void {
    this.snapshotState.transportFailureCount += 1;
  }

  trackAuditFailure(): void {
    this.snapshotState.auditFailureCount += 1;
  }

  trackMetricsPersistenceFailure(): void {
    this.snapshotState.metricsPersistenceFailureCount += 1;
  }

  trackDeliveryLatency(latencyMs: number): void {
    this.deliveryLatencyTotalMs += latencyMs;
    this.deliveryLatencySamples += 1;
    this.snapshotState.averageDeliveryLatencyMs = this.deliveryLatencyTotalMs / this.deliveryLatencySamples;
  }

  trackRetryLatency(latencyMs: number): void {
    this.retryLatencyTotalMs += latencyMs;
    this.retryLatencySamples += 1;
    this.snapshotState.averageRetryLatencyMs = this.retryLatencyTotalMs / this.retryLatencySamples;
  }

  updateDepths(input: {
    queueDepth: number;
    retryDepth: number;
    oldestPendingMessageAt: string | null;
  }): void {
    this.snapshotState.queueDepth = input.queueDepth;
    this.snapshotState.retryDepth = input.retryDepth;
    this.snapshotState.oldestPendingMessageAt = input.oldestPendingMessageAt;
  }

  trackAudit(_envelope: MessageEnvelope): void {
    // Placeholder hook for future audit stream counters.
  }

  hydrate(snapshot: MessageMetricsSnapshot): void {
    Object.assign(this.snapshotState, {
      ...snapshot,
      byMode: { ...snapshot.byMode },
      byTopic: Object.fromEntries(Object.entries(snapshot.byTopic).map(([topic, stats]) => [topic, { ...stats }])),
      subscriberStats: Object.fromEntries(
        Object.entries(snapshot.subscriberStats).map(([name, stats]) => [name, { ...stats }]),
      ),
    });

    this.deliveryLatencySamples = snapshot.deliveredCount > 0 ? snapshot.deliveredCount : 0;
    this.deliveryLatencyTotalMs = snapshot.averageDeliveryLatencyMs * this.deliveryLatencySamples;
    this.retryLatencySamples = snapshot.retriedCount > 0 ? snapshot.retriedCount : 0;
    this.retryLatencyTotalMs = snapshot.averageRetryLatencyMs * this.retryLatencySamples;
  }

  finalizeFailureRate(): void {
    const denominator = this.snapshotState.deliveredCount + this.snapshotState.failedCount;
    this.snapshotState.failureRate = denominator === 0 ? 0 : this.snapshotState.failedCount / denominator;
  }

  snapshot(): MessageMetricsSnapshot {
    this.finalizeFailureRate();
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
