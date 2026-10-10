import type { AttributionTouch } from "../attribution";
import { AppendOnlyLedger } from "../ledger";
import { STONER_GYM_REFERENCE } from "../reference/stoner-gym";
import {
  parseWooCommerceOrderEligibilityFacts,
  parseWooCommerceOrderPayload,
} from "./woocommerce-payloads";
import { evaluateWooCommerceOrderEligibility } from "./woocommerce-eligibility";
import { verifyWooCommerceWebhookSignature } from "./woocommerce-events";
import {
  ignoreIneligibleWooCommerceOrder,
  processWooCommerceOrder,
  type WooCommerceOrderProcessingResult,
} from "./woocommerce-processor";
import type { WooCommerceWebhookEnvelope } from "./woocommerce-events";

export interface RawWooCommerceOrderProcessingInput {
  readonly webhook: WooCommerceWebhookEnvelope;
  readonly webhookSecret: string;
  readonly qualifiedTouches: readonly AttributionTouch[];
  readonly recruitedCreatorPartnerIds: readonly string[];
  readonly ledger: AppendOnlyLedger;
}

/**
 * Production-facing order boundary. The same raw bytes that are signature
 * verified are parsed into the provider snapshot; callers cannot substitute a
 * different parsed order after verification.
 */
export async function processRawWooCommerceOrder(
  input: RawWooCommerceOrderProcessingInput,
): Promise<WooCommerceOrderProcessingResult> {
  if (input.webhook.eventType !== "order.created" && input.webhook.eventType !== "order.updated") {
    throw new Error("UNSUPPORTED_WOOCOMMERCE_ORDER_EVENT");
  }

  // Authenticate the raw bytes before interpreting them.
  if (!verifyWooCommerceWebhookSignature({
    rawBody: input.webhook.rawBody,
    signature: input.webhook.signature,
    secret: input.webhookSecret,
  })) {
    throw new Error("INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE");
  }

  const eligibility = evaluateWooCommerceOrderEligibility(
    parseWooCommerceOrderEligibilityFacts(input.webhook.rawBody),
  );
  if (!eligibility.eligible) {
    // Ineligible orders need no cost metadata; only the signed receipt is persisted.
    return ignoreIneligibleWooCommerceOrder({
      webhook: input.webhook,
      webhookSecret: input.webhookSecret,
      eligibility,
    });
  }

  const parsed = parseWooCommerceOrderPayload({
    rawBody: input.webhook.rawBody,
    organizationId: STONER_GYM_REFERENCE.organizationId,
  });

  return processWooCommerceOrder({
    webhook: input.webhook,
    webhookSecret: input.webhookSecret,
    order: parsed.order,
    orderMeta: parsed.orderMeta,
    qualifiedTouches: input.qualifiedTouches,
    recruitedCreatorPartnerIds: input.recruitedCreatorPartnerIds,
    ledger: input.ledger,
  });
}
