import { createHash } from "node:crypto";

import { RuntimeCommand } from "./RuntimeCommand";
import { RuntimeEnvelope } from "./RuntimeEnvelope";
import { RuntimeEvent } from "./RuntimeEvent";
import { RuntimeQuery } from "./RuntimeQuery";
import { RuntimeReply } from "./RuntimeReply";
import type {
  RuntimeCommandEnvelope,
  RuntimeEnvelopeMetadata,
  RuntimeEnvelopeSnapshot,
  RuntimeEventEnvelope,
  RuntimePublishIntent,
  RuntimeQueryEnvelope,
  RuntimeReplyEnvelope,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function stableRecord(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return deepFreeze(Object.fromEntries(Object.entries(record).sort((a, b) => a[0].localeCompare(b[0]))));
}

export class RuntimeEnvelopeFactory {
  private correlationId(runtimeInstanceId: string, runtimeId: string, intent: RuntimePublishIntent): string {
    const hash = createHash("sha256")
      .update(JSON.stringify({
        runtimeInstanceId,
        runtimeId,
        channel: intent.channel,
        topic: intent.topic,
        envelopeType: intent.envelopeType,
        publisherKind: intent.publisherKind,
        publisherId: intent.publisherId,
        payload: stableRecord(intent.payload),
        schemaVersion: intent.schemaVersion,
      }))
      .digest("hex");
    return `correlation-${hash.slice(0, 16)}`;
  }

  private messageId(record: Omit<RuntimeEnvelopeSnapshot, "messageId">): string {
    const canonical = JSON.stringify({
      runtimeInstanceId: record.runtimeInstanceId,
      runtimeId: record.runtimeId,
      channel: record.channel,
      topic: record.topic,
      envelopeType: record.envelopeType,
      publisherKind: record.publisherKind,
      publisherId: record.publisherId,
      payload: stableRecord(record.payload),
      correlationId: record.correlationId,
      causationId: record.causationId,
      sequence: record.sequence,
      schemaVersion: record.schemaVersion,
    });
    return `message-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  }

  create(
    runtimeInstanceId: string,
    runtimeId: string,
    sequence: number,
    intent: RuntimePublishIntent,
  ): RuntimeEnvelope {
    if (!intent.channel || intent.channel.trim().length === 0) {
      throw new Error("GRT-MSG-ENV-001: channel is required");
    }
    if (!intent.topic || intent.topic.trim().length === 0) {
      throw new Error("GRT-MSG-ENV-002: topic is required");
    }
    if (!intent.publisherId || intent.publisherId.trim().length === 0) {
      throw new Error("GRT-MSG-ENV-003: publisherId is required");
    }
    if (!intent.schemaVersion || intent.schemaVersion.trim().length === 0) {
      throw new Error("GRT-MSG-ENV-004: schemaVersion is required");
    }

    const metadata: RuntimeEnvelopeMetadata = stableRecord(intent.metadata ?? {}) as RuntimeEnvelopeMetadata;
    const base = deepFreeze({
      runtimeInstanceId,
      runtimeId,
      channel: intent.channel,
      topic: intent.topic,
      envelopeType: intent.envelopeType,
      publisherKind: intent.publisherKind,
      publisherId: intent.publisherId,
      payload: stableRecord(intent.payload),
      correlationId: intent.correlationId ?? this.correlationId(runtimeInstanceId, runtimeId, intent),
      causationId: intent.causationId,
      sequence,
      schemaVersion: intent.schemaVersion,
      metadata,
    });

    const record = deepFreeze({
      ...base,
      messageId: this.messageId(base),
    }) as RuntimeEnvelopeSnapshot;

    switch (record.envelopeType) {
      case "Command":
        return new RuntimeCommand(record as RuntimeCommandEnvelope);
      case "Event":
        return new RuntimeEvent(record as RuntimeEventEnvelope);
      case "Query":
        return new RuntimeQuery(record as RuntimeQueryEnvelope);
      case "Reply":
        return new RuntimeReply(record as RuntimeReplyEnvelope);
      default:
        throw new Error(`GRT-MSG-ENV-005: Unsupported envelope type: ${(record as RuntimeEnvelopeSnapshot).envelopeType}`);
    }
  }
}
