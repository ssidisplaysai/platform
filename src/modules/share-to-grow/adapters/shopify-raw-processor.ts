import type { AttributionTouch } from "../attribution";
import { AppendOnlyLedger } from "../ledger";
import { STONER_GYM_REFERENCE } from "../reference/stoner-gym";
import {
  parseShopifyOrderEligibilityFacts,
  parseShopifyOrderPayload,
} from "./shopify-payloads";
import { evaluateShopifyOrderEligibility } from "./shopify-eligibility";
import { verifyShopifyWebhookSignature } from "./shopify-events";
import {
  ignoreIneligibleShopifyOrder,
  processShopifyOrder,
  type ShopifyOrderProcessingResult,
} from "./shopify-processor";
import type { ShopifyWebhookEnvelope } from "./shopify-events";

export interface RawShopifyOrderProcessingInput {
  readonly webhook: ShopifyWebhookEnvelope;
  readonly webhookSecret: string;
  readonly qualifiedTouches: readonly AttributionTouch[];
  readonly recruitedCreatorPartnerIds: readonly string[];
  readonly ledger: AppendOnlyLedger;
}

export async function processRawShopifyOrder(
  input: RawShopifyOrderProcessingInput,
): Promise<ShopifyOrderProcessingResult> {
  if (
    input.webhook.eventType !== "order.paid"
    && input.webhook.eventType !== "order.created"
    && input.webhook.eventType !== "order.updated"
  ) {
    throw new Error("UNSUPPORTED_SHOPIFY_ORDER_EVENT");
  }

  if (!verifyShopifyWebhookSignature({
    rawBody: input.webhook.rawBody,
    signature: input.webhook.signature,
    secret: input.webhookSecret,
  })) {
    throw new Error("INVALID_SHOPIFY_WEBHOOK_SIGNATURE");
  }

  const eligibility = evaluateShopifyOrderEligibility(
    parseShopifyOrderEligibilityFacts(input.webhook.rawBody),
  );
  if (!eligibility.eligible) {
    return ignoreIneligibleShopifyOrder({
      webhook: input.webhook,
      webhookSecret: input.webhookSecret,
      eligibility,
    });
  }

  const parsed = parseShopifyOrderPayload({
    rawBody: input.webhook.rawBody,
    organizationId: STONER_GYM_REFERENCE.organizationId,
  });

  return processShopifyOrder({
    webhook: input.webhook,
    webhookSecret: input.webhookSecret,
    order: parsed.order,
    orderAttributes: parsed.orderAttributes,
    qualifiedTouches: input.qualifiedTouches,
    recruitedCreatorPartnerIds: input.recruitedCreatorPartnerIds,
    ledger: input.ledger,
  });
}
