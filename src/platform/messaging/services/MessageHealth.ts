import type { TransportHealth, TransportQueueStats } from "../contracts";
import { DeadLetterService } from "./DeadLetterService";
import { MessageMetrics } from "./MessageMetrics";
import { SubscriptionRegistry } from "./SubscriptionRegistry";
import { TopicRegistry } from "./TopicRegistry";

export type MessageHealthSnapshot = {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: Array<{ name: string; status: "PASS" | "WARN" | "FAIL"; detail: string }>;
  generatedAt: string;
};

export class MessageHealth {
  snapshot(input: {
    transport: TransportHealth;
    queueStats: TransportQueueStats;
    metrics: MessageMetrics;
    topicRegistry: TopicRegistry;
    subscriptionRegistry: SubscriptionRegistry;
    deadLetterService: DeadLetterService;
  }): MessageHealthSnapshot {
    const metricSnapshot = input.metrics.snapshot();
    const deadLetters = input.deadLetterService.size();

    const checks: Array<{ name: string; status: "PASS" | "WARN" | "FAIL"; detail: string }> = [
      {
        name: "transport",
        status: input.transport.status === "HEALTHY" ? "PASS" : input.transport.status === "DEGRADED" ? "WARN" : "FAIL",
        detail: input.transport.detail,
      },
      {
        name: "topics",
        status: input.topicRegistry.list().length > 0 ? "PASS" : "WARN",
        detail: `registered=${input.topicRegistry.list().length}`,
      },
      {
        name: "subscriptions",
        status: input.subscriptionRegistry.size() > 0 ? "PASS" : "WARN",
        detail: `registered=${input.subscriptionRegistry.size()}`,
      },
      {
        name: "delivery",
        status: metricSnapshot.failureRate > 0.1 ? "WARN" : "PASS",
        detail: `published=${metricSnapshot.publishedCount}; delivered=${metricSnapshot.deliveredCount}; failed=${metricSnapshot.failedCount}; failureRate=${metricSnapshot.failureRate.toFixed(3)}`,
      },
      {
        name: "dead_letter",
        status: deadLetters > 100 ? "WARN" : "PASS",
        detail: `entries=${deadLetters}; retryDepth=${metricSnapshot.retryDepth}`,
      },
      {
        name: "queue",
        status: metricSnapshot.queueDepth > 1000 || input.queueStats.inFlight > 1000 ? "WARN" : "PASS",
        detail: `inFlight=${input.queueStats.inFlight}; queueDepth=${metricSnapshot.queueDepth}; oldestPending=${metricSnapshot.oldestPendingMessageAt ?? "none"}`,
      },
      {
        name: "durability",
        status: metricSnapshot.metricsPersistenceFailureCount > 0 ? "WARN" : "PASS",
        detail: `metricsPersistenceFailures=${metricSnapshot.metricsPersistenceFailureCount}; auditFailures=${metricSnapshot.auditFailureCount}; transportFailures=${metricSnapshot.transportFailureCount}`,
      },
    ];

    const status = checks.some((check) => check.status === "FAIL")
      ? "CRITICAL"
      : checks.some((check) => check.status === "WARN")
        ? "DEGRADED"
        : "HEALTHY";

    return {
      status,
      checks,
      generatedAt: new Date().toISOString(),
    };
  }
}
