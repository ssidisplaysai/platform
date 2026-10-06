import type { AttributionTouch } from "../attribution";
import { AppendOnlyLedger } from "../ledger";
import { STONER_GYM_REFERENCE } from "../reference/stoner-gym";
import { parseWooCommerceOrderPayload } from "./woocommerce-payloads";
import {
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
export function processRawWooCommerceOrder(
  input: RawWooCommerceOrderProcessingInput,
): WooCommerceOrderProcessingResult {
  if (input.webhook.eventType !== "order.created" && input.webhook.eventType !== "order.updated") {
    throw new Error("UNSUPPORTED_WOOCOMMERCE_ORDER_EVENT");
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
