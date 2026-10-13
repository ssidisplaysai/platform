import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { SourceEventReceiptRecord } from "../persistence-types";
import {
  loadShareToGrowRepositorySnapshot,
  type ShareToGrowRepositorySnapshot,
} from "../share-to-grow-repository";

export type WooCommerceEventType =
  | "order.created"
  | "order.updated"
  | "order.cancelled"
  | "refund.created";

export interface WooCommerceWebhookEnvelope {
  readonly sourceEventId: string;
  readonly eventType: WooCommerceEventType;
  readonly rawBody: string;
  readonly signature: string;
  readonly receivedAt: string;
}

export interface VerifiedWooCommerceEvent {
  readonly sourceEventId: string;
  readonly eventType: WooCommerceEventType;
  readonly payloadHash: string;
  readonly receivedAt: string;
  readonly replay: boolean;
  readonly persistenceRevision: number;
  readonly receipt: SourceEventReceiptRecord;
  readonly repositorySnapshot: ShareToGrowRepositorySnapshot;
}

export function verifyWooCommerceWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  if (!input.secret || !input.signature) return false;
  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody, "utf8")
    .digest("base64");
  const supplied = Buffer.from(input.signature, "utf8");
  const calculated = Buffer.from(expected, "utf8");
  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}

export async function acceptWooCommerceWebhook(
  envelope: WooCommerceWebhookEnvelope,
  secret: string,
): Promise<VerifiedWooCommerceEvent> {
  if (!verifyWooCommerceWebhookSignature({
    rawBody: envelope.rawBody,
    signature: envelope.signature,
    secret,
  })) {
    throw new Error("INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE");
  }
  if (!Number.isFinite(Date.parse(envelope.receivedAt))) {
    throw new Error("INVALID_WOOCOMMERCE_EVENT_TIMESTAMP");
  }

  const payloadHash = createHash("sha256").update(envelope.rawBody, "utf8").digest("hex");
  const receipt: SourceEventReceiptRecord = {
    sourceEventId: envelope.sourceEventId,
    source: "woocommerce",
    eventType: envelope.eventType,
    payloadHash,
    receivedAt: envelope.receivedAt,
  };
  const snapshot = await loadShareToGrowRepositorySnapshot();
  const existing = snapshot.state.sourceEventReceipts.find(
    (candidate) => candidate.sourceEventId === envelope.sourceEventId,
  );
  if (existing && (
    existing.source !== receipt.source
    || existing.eventType !== receipt.eventType
    || existing.payloadHash !== receipt.payloadHash
  )) {
    throw new Error("SOURCE_EVENT_ID_COLLISION");
  }

  return Object.freeze({
    sourceEventId: envelope.sourceEventId,
    eventType: envelope.eventType,
    payloadHash,
    receivedAt: envelope.receivedAt,
    replay: existing !== undefined,
    persistenceRevision: snapshot.revision,
    receipt: existing ?? receipt,
    repositorySnapshot: snapshot,
  });
}
