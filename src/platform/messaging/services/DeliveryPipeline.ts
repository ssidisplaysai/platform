import type { MessageEnvelope, SubscriptionDefinition } from "../contracts";
import { AuditWriter } from "./AuditWriter";
import { DeadLetterService } from "./DeadLetterService";
import { MessageMetrics } from "./MessageMetrics";
import { RetryService } from "./RetryService";

export type DuplicateDetector = (input: {
  topic: string;
  envelope: MessageEnvelope;
  subscription: SubscriptionDefinition;
}) => boolean;

export class DeliveryPipeline {
  constructor(
    private readonly retryService: RetryService,
    private readonly deadLetterService: DeadLetterService,
    private readonly metrics: MessageMetrics,
    private readonly auditWriter: AuditWriter,
    private readonly duplicateDetector?: DuplicateDetector,
    private readonly callbacks?: {
      onRetry?: (input: {
        topic: string;
        subscription: SubscriptionDefinition;
        envelope: MessageEnvelope;
        attempt: number;
        reason: string;
      }) => Promise<void>;
      onDeadLetter?: (input: {
        topic: string;
        subscription: SubscriptionDefinition;
        envelope: MessageEnvelope;
        reason: string;
      }) => Promise<void>;
      onAuditFailure?: () => void;
    },
  ) {}

  async deliver(topic: string, envelope: MessageEnvelope, subscriptions: SubscriptionDefinition[]): Promise<void> {
    for (const subscription of subscriptions) {
      if (this.duplicateDetector?.({ topic, envelope, subscription })) {
        this.metrics.trackDuplicateSuppressed();
        continue;
      }

      let attempt = 1;
      const startedAt = Date.now();
      // Retry loop is bounded by subscription-specific max attempts.
      while (true) {
        try {
          await Promise.resolve(subscription.handler(envelope));
          this.metrics.trackDeliveryLatency(Date.now() - startedAt);
          this.metrics.trackDelivered(topic, subscription.subscriberName);
          this.metrics.trackAudit(envelope);
          try {
            this.auditWriter.writeFromEnvelope({
              topic,
              subscriberName: subscription.subscriberName,
              status: "DELIVERED",
              envelope,
            });
          } catch {
            this.metrics.trackAuditFailure();
            this.callbacks?.onAuditFailure?.();
          }
          break;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "delivery_failed";
          if (this.retryService.shouldRetry(subscription, attempt)) {
            this.metrics.trackRetry();
            this.metrics.trackRetryLatency(Date.now() - startedAt);
            await this.callbacks?.onRetry?.({
              topic,
              subscription,
              envelope,
              attempt,
              reason,
            });
            attempt += 1;
            continue;
          }

          this.metrics.trackFailure(topic, subscription.subscriberName);
          this.metrics.trackDeadLetter();
          this.deadLetterService.push({
            topic,
            subscriptionId: subscription.id,
            subscriberName: subscription.subscriberName,
            envelope,
            reason,
            failedAt: new Date().toISOString(),
          });
          await this.callbacks?.onDeadLetter?.({
            topic,
            subscription,
            envelope,
            reason,
          });
          try {
            this.auditWriter.writeFromEnvelope({
              topic,
              subscriberName: subscription.subscriberName,
              status: "DEAD_LETTERED",
              envelope,
            });
          } catch {
            this.metrics.trackAuditFailure();
            this.callbacks?.onAuditFailure?.();
          }
          break;
        }
      }
    }
  }
}
