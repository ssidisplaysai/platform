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
  ) {}

  async deliver(topic: string, envelope: MessageEnvelope, subscriptions: SubscriptionDefinition[]): Promise<void> {
    for (const subscription of subscriptions) {
      if (this.duplicateDetector?.({ topic, envelope, subscription })) {
        this.metrics.trackDuplicateSuppressed();
        continue;
      }

      let attempt = 1;
      // Retry loop is bounded by subscription-specific max attempts.
      while (true) {
        try {
          await Promise.resolve(subscription.handler(envelope));
          this.metrics.trackDelivered(topic, subscription.subscriberName);
          this.metrics.trackAudit(envelope);
          this.auditWriter.writeFromEnvelope({
            topic,
            subscriberName: subscription.subscriberName,
            status: "DELIVERED",
            envelope,
          });
          break;
        } catch (error) {
          if (this.retryService.shouldRetry(subscription, attempt)) {
            this.metrics.trackRetry();
            attempt += 1;
            continue;
          }

          const reason = error instanceof Error ? error.message : "delivery_failed";
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
          this.auditWriter.writeFromEnvelope({
            topic,
            subscriberName: subscription.subscriberName,
            status: "DEAD_LETTERED",
            envelope,
          });
          break;
        }
      }
    }
  }
}
