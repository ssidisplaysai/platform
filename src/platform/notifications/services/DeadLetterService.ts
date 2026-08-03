import { randomUUID } from "node:crypto";
import type { DeadLetterRecord, NotificationRequestId } from "../contracts";
import type { NotificationPersistence } from "../persistence";

export class DeadLetterService {
  constructor(private readonly persistence: NotificationPersistence) {}

  async create(input: {
    requestId: NotificationRequestId;
    reason: string;
    finalAttemptNumber: number;
    recoverable: boolean;
    metadata?: Record<string, string>;
  }): Promise<DeadLetterRecord> {
    const record: DeadLetterRecord = {
      deadLetterId: `ndl_${randomUUID()}`,
      requestId: input.requestId,
      reason: input.reason,
      finalAttemptNumber: input.finalAttemptNumber,
      createdAt: new Date().toISOString(),
      recoverable: input.recoverable,
      metadata: input.metadata,
    };

    await this.persistence.deadLetters.append(record);
    return record;
  }

  async list(): Promise<DeadLetterRecord[]> {
    return this.persistence.deadLetters.list();
  }
}
