import type { NotificationPersistence } from "../persistence";

export class DedupeService {
  constructor(private readonly persistence: NotificationPersistence) {}

  async isDuplicate(idempotencyKey: string): Promise<boolean> {
    const requests = await this.persistence.requests.list();
    return requests.some((record) => record.request.idempotencyKey === idempotencyKey);
  }

  createDeliveryDedupeKey(input: {
    requestId: string;
    recipientId: string;
    channel: string;
    attemptNumber: number;
  }): string {
    return `${input.requestId}:${input.recipientId}:${input.channel}:${input.attemptNumber}`;
  }
}
