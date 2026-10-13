import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SourceEventReceiptRecord } from "../persistence-types";
import {
  loadShareToGrowRepositorySnapshot,
  type ShareToGrowRepositorySnapshot,
} from "../share-to-grow-repository";

export type ShopifyEventType =
  | "order.created"
  | "order.paid"
  | "order.updated"
  | "order.cancelled"
  | "refund.created";

export interface ShopifyWebhookEnvelope {
  readonly sourceEventId: string;
  readonly eventType: ShopifyEventType;
  readonly rawBody: string;
  readonly signature: string;
  readonly receivedAt: string;
}

export interface VerifiedShopifyEvent {
  readonly sourceEventId: string;
  readonly eventType: ShopifyEventType;
  readonly payloadHash: string;
  readonly receivedAt: string;
  readonly replay: boolean;
  readonly persistenceRevision: number;
  readonly receipt: SourceEventReceiptRecord;
  readonly repositorySnapshot: ShareToGrowRepositorySnapshot;
}

export function verifyShopifyWebhookSignature(input: {
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

export async function acceptShopifyWebhook(
  envelope: ShopifyWebhookEnvelope,
  secret: string,
): Promise<VerifiedShopifyEvent> {
  if (!verifyShopifyWebhookSignature({
    rawBody: envelope.rawBody,
    signature: envelope.signature,
    secret,
  })) {
    throw new Error("INVALID_SHOPIFY_WEBHOOK_SIGNATURE");
  }
  if (!Number.isFinite(Date.parse(envelope.receivedAt))) {
    throw new Error("INVALID_SHOPIFY_EVENT_TIMESTAMP");
  }

  const payloadHash = createHash("sha256").update(envelope.rawBody, "utf8").digest("hex");
  const receipt: SourceEventReceiptRecord = {
    sourceEventId: envelope.sourceEventId,
    source: "shopify",
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
