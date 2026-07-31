import type { MessageEnvelope } from "../contracts";

export type MessageAuditRecord = {
  messageId: string;
  topic: string;
  subscriberName: string;
  status: "DELIVERED" | "DEAD_LETTERED";
  correlationId: string;
  causationId: string;
  occurredAt: string;
};

export class AuditWriter {
  private readonly records: MessageAuditRecord[] = [];

  write(record: MessageAuditRecord): void {
    this.records.push(record);
  }

  writeFromEnvelope(input: {
    topic: string;
    subscriberName: string;
    status: "DELIVERED" | "DEAD_LETTERED";
    envelope: MessageEnvelope;
  }): void {
    this.write({
      messageId: input.envelope.messageId,
      topic: input.topic,
      subscriberName: input.subscriberName,
      status: input.status,
      correlationId: input.envelope.correlationId,
      causationId: input.envelope.causationId,
      occurredAt: new Date().toISOString(),
    });
  }

  list(): MessageAuditRecord[] {
    return this.records.map((record) => ({ ...record }));
  }
}
