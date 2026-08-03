import { randomUUID } from "node:crypto";
import type { DeliveryAttempt, DeliveryResult, NotificationRequestId } from "../contracts";
import type { NotificationPersistence } from "../persistence";

export class AttemptTracker {
  constructor(private readonly persistence: NotificationPersistence) {}

  async createAttempt(input: {
    requestId: NotificationRequestId;
    recipientId: string;
    channel: DeliveryAttempt["channel"];
    providerName: string;
    dedupeKey: string;
    correlationId: string;
    causationId: string;
  }): Promise<DeliveryAttempt> {
    const attempts = await this.persistence.attempts.listByRequestId(input.requestId);
    const attempt: DeliveryAttempt = {
      attemptId: `nattempt_${randomUUID()}`,
      requestId: input.requestId,
      recipientId: input.recipientId,
      channel: input.channel,
      providerName: input.providerName,
      attemptNumber: attempts.length + 1,
      dedupeKey: input.dedupeKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      createdAt: new Date().toISOString(),
    };

    await this.persistence.attempts.append(attempt);
    return attempt;
  }

  async completeAttempt(requestId: NotificationRequestId, attemptId: string, result: DeliveryResult): Promise<void> {
    const attempts = await this.persistence.attempts.listByRequestId(requestId);
    const target = attempts.find((attempt) => attempt.attemptId === attemptId);
    if (!target) {
      return;
    }

    target.result = result;
    target.completedAt = new Date().toISOString();
    await this.persistence.attempts.update(target);
  }

  async listAttempts(requestId: NotificationRequestId): Promise<DeliveryAttempt[]> {
    return this.persistence.attempts.listByRequestId(requestId);
  }
}
