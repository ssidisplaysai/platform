import type { RuntimeEnvelopeSnapshot, RuntimeMessageRecord } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeMessageLog {
  private readonly messages: RuntimeMessageRecord[] = [];
  private readonly deadLetters: RuntimeMessageRecord[] = [];
  private sequence = 1;

  issueSequence(): number {
    return this.sequence++;
  }

  append(record: RuntimeMessageRecord): RuntimeMessageRecord {
    const frozen = deepFreeze(record);
    this.messages.push(frozen);
    if (frozen.deadLettered) {
      this.deadLetters.push(frozen);
    }
    return frozen;
  }

  history(): readonly RuntimeMessageRecord[] {
    return Object.freeze([...this.messages]);
  }

  deadLetterHistory(): readonly RuntimeMessageRecord[] {
    return Object.freeze([...this.deadLetters]);
  }

  fromSequence(sequence: number): readonly RuntimeMessageRecord[] {
    return Object.freeze(this.messages.filter((entry) => entry.envelope.sequence >= sequence));
  }

  byCorrelationId(correlationId: string): readonly RuntimeMessageRecord[] {
    return Object.freeze(this.messages.filter((entry) => entry.envelope.correlationId === correlationId));
  }

  byTopic(channel: string, topic: string): readonly RuntimeMessageRecord[] {
    return Object.freeze(this.messages.filter((entry) => entry.envelope.channel === channel && entry.envelope.topic === topic));
  }

  count(): number {
    return this.messages.length;
  }

  latestSequence(): number {
    return this.messages[this.messages.length - 1]?.envelope.sequence ?? 0;
  }

  hasSequence(sequence: number): boolean {
    return this.messages.some((entry) => entry.envelope.sequence === sequence);
  }

  get(messageId: string): RuntimeMessageRecord {
    const record = this.messages.find((entry) => entry.envelope.messageId === messageId);
    if (!record) {
      throw new Error(`GRT-MSG-LOG-001: Unknown message: ${messageId}`);
    }
    return record;
  }

  hasMessage(messageId: string): boolean {
    return this.messages.some((entry) => entry.envelope.messageId === messageId);
  }

  snapshotEnvelopes(): readonly RuntimeEnvelopeSnapshot[] {
    return Object.freeze(this.messages.map((entry) => entry.envelope));
  }
}
