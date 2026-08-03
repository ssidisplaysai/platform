import type {
  NotificationChannel,
  NotificationMetrics,
  NotificationState,
} from "../contracts";
import type { NotificationPersistence } from "../persistence";

function defaultMetrics(): NotificationMetrics {
  return {
    registeredNotificationDefinitions: 0,
    registeredTemplates: 0,
    requestedNotifications: 0,
    suppressedNotifications: 0,
    deferredNotifications: 0,
    queuedNotifications: 0,
    deliveredNotifications: 0,
    failedNotifications: 0,
    deadLetteredNotifications: 0,
    deliveryAttempts: 0,
    retryCount: 0,
    duplicateRequestCount: 0,
    preferenceRejections: 0,
    quietHourDeferrals: 0,
    providerFailures: 0,
    auditFailures: 0,
    auditRetries: 0,
    auditRecoveries: 0,
    auditBacklog: 0,
    auditLatencyMs: 0,
    recoveryCount: 0,
    activeQueuedNotifications: 0,
    activeDeferredNotifications: 0,
    oldestPendingNotificationAgeMs: null,
    averageDeliveryLatencyMs: 0,
    deliverySuccessRateByChannel: {},
  };
}

export class NotificationMetricsService {
  constructor(private readonly persistence: NotificationPersistence) {}

  async getMetrics(): Promise<NotificationMetrics> {
    return (await this.persistence.metrics.load()) ?? defaultMetrics();
  }

  async replace(metrics: NotificationMetrics): Promise<void> {
    await this.persistence.metrics.save(metrics);
  }

  async increment(field: keyof NotificationMetrics, amount = 1): Promise<void> {
    const metrics = await this.getMetrics();
    const current = metrics[field];
    if (typeof current === "number") {
      (metrics[field] as number) = current + amount;
    }
    await this.persistence.metrics.save(metrics);
  }

  async updateQueueState(input: {
    state: NotificationState;
    createdAt: string;
  }): Promise<void> {
    const metrics = await this.getMetrics();

    if (input.state === "QUEUED") {
      metrics.activeQueuedNotifications += 1;
    }
    if (input.state === "DEFERRED") {
      metrics.activeDeferredNotifications += 1;
    }

    if (metrics.oldestPendingNotificationAgeMs === null) {
      metrics.oldestPendingNotificationAgeMs = Math.max(0, Date.now() - Date.parse(input.createdAt));
    }

    await this.persistence.metrics.save(metrics);
  }

  async recordDelivery(channel: NotificationChannel, succeeded: boolean, latencyMs: number): Promise<void> {
    const metrics = await this.getMetrics();
    const channelRate = metrics.deliverySuccessRateByChannel[channel] ?? 0;

    if (succeeded) {
      metrics.deliveredNotifications += 1;
      metrics.deliverySuccessRateByChannel[channel] = Math.min(100, channelRate + 1);
    } else {
      metrics.failedNotifications += 1;
      metrics.providerFailures += 1;
      metrics.deliverySuccessRateByChannel[channel] = Math.max(0, channelRate - 1);
    }

    const sampleSize = Math.max(1, metrics.deliveryAttempts);
    metrics.averageDeliveryLatencyMs = Math.round(
      (metrics.averageDeliveryLatencyMs * (sampleSize - 1) + latencyMs) / sampleSize,
    );

    await this.persistence.metrics.save(metrics);
  }

  async recordAuditLatency(latencyMs: number): Promise<void> {
    const metrics = await this.getMetrics();
    const sampleSize = Math.max(1, metrics.auditFailures + metrics.auditRecoveries + 1);
    metrics.auditLatencyMs = Math.round((metrics.auditLatencyMs * (sampleSize - 1) + latencyMs) / sampleSize);
    await this.persistence.metrics.save(metrics);
  }

  async recordAuditFailure(retryable: boolean): Promise<void> {
    const metrics = await this.getMetrics();
    metrics.auditFailures += 1;
    metrics.auditBacklog += 1;
    if (retryable) {
      metrics.auditRetries += 1;
    }
    await this.persistence.metrics.save(metrics);
  }

  async recordAuditRecovery(): Promise<void> {
    const metrics = await this.getMetrics();
    if (metrics.auditBacklog > 0) {
      metrics.auditBacklog -= 1;
    }
    metrics.auditRecoveries += 1;
    await this.persistence.metrics.save(metrics);
  }
}
