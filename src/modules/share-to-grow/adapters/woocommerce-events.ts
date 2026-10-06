import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { recordSourceEventReceipt } from "../share-to-grow-repository";

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

export function acceptWooCommerceWebhook(
  envelope: WooCommerceWebhookEnvelope,
  secret: string,
): VerifiedWooCommerceEvent {
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
  const recorded = recordSourceEventReceipt({
    sourceEventId: envelope.sourceEventId,
    source: "woocommerce",
    eventType: envelope.eventType,
    payloadHash,
    receivedAt: envelope.receivedAt,
  });

  return Object.freeze({
    sourceEventId: envelope.sourceEventId,
    eventType: envelope.eventType,
    payloadHash,
    receivedAt: envelope.receivedAt,
    replay: recorded.replay,
  });
}
