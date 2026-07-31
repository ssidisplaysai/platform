import type { MessageEnvelope } from "../contracts";

export type DeadLetterEntry = {
  topic: string;
  subscriptionId: string;
  subscriberName: string;
  envelope: MessageEnvelope;
  reason: string;
  failedAt: string;
};

export class DeadLetterService {
  private readonly entries: DeadLetterEntry[] = [];

  push(entry: DeadLetterEntry): void {
    this.entries.push(entry);
  }

  list(): DeadLetterEntry[] {
    return this.entries.map((entry) => ({ ...entry, envelope: { ...entry.envelope, headers: { ...entry.envelope.headers }, metadata: { ...entry.envelope.metadata } } }));
  }

  size(): number {
    return this.entries.length;
  }
}
