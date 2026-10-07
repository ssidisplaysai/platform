import { AppendOnlyLedger } from "../ledger";
import type { WooCommerceEventType } from "./woocommerce-events";
import { processRawWooCommerceOrder } from "./woocommerce-raw-processor";

export interface WooCommerceWebhookHttpInput {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly secret: string;
  readonly receivedAt: string;
  readonly recruitedCreatorPartnerIds: readonly string[];
  readonly ledger?: AppendOnlyLedger;
}

export interface WooCommerceWebhookHttpResult {
  readonly sourceEventId: string;
  readonly replay: boolean;
  readonly selectedPartnerId?: string;
  readonly lines: readonly {
    readonly lineKey: string;
    readonly ruleVersionId: string;
    readonly allocations: readonly {
      readonly beneficiaryId: string;
      readonly amountMinor: string;
      readonly currency: string;
    }[];
  }[];
  readonly pendingEntitlements: readonly {
    readonly entitlementId: string;
    readonly beneficiaryId: string;
    readonly amountMinor: string;
    readonly currency: string;
    readonly state: string;
  }[];
}

function header(input: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  return input[name] ?? input[name.toLowerCase()] ?? input[name.toUpperCase()];
}

function normalizeWooEventType(topic: string | undefined): WooCommerceEventType {
  switch (topic) {
    case "order.created":
    case "order.updated":
    case "order.cancelled":
    case "refund.created":
      return topic;
    default:
      throw new Error("UNSUPPORTED_WOOCOMMERCE_WEBHOOK_TOPIC");
  }
}

export function processWooCommerceWebhookHttp(
  input: WooCommerceWebhookHttpInput,
): WooCommerceWebhookHttpResult {
  const signature = header(input.headers, "x-wc-webhook-signature");
  const sourceEventId =
    header(input.headers, "x-wc-webhook-delivery-id") ??
    header(input.headers, "x-wc-webhook-id");
  const topic = header(input.headers, "x-wc-webhook-topic");

  if (!signature) throw new Error("MISSING_WOOCOMMERCE_WEBHOOK_SIGNATURE");
  if (!sourceEventId) throw new Error("MISSING_WOOCOMMERCE_WEBHOOK_DELIVERY_ID");

  const eventType = normalizeWooEventType(topic);
  if (eventType !== "order.created" && eventType !== "order.updated") {
    throw new Error("WOOCOMMERCE_EVENT_HANDLER_NOT_IMPLEMENTED");
  }

  const result = processRawWooCommerceOrder({
    webhook: {
      sourceEventId,
      eventType,
      rawBody: input.rawBody,
      signature,
      receivedAt: input.receivedAt,
    },
    webhookSecret: input.secret,
    qualifiedTouches: [],
    recruitedCreatorPartnerIds: input.recruitedCreatorPartnerIds,
    ledger: input.ledger ?? new AppendOnlyLedger(),
  });

  return Object.freeze({
    sourceEventId,
    replay: result.replay,
    selectedPartnerId: result.attribution.selectedPartnerId,
    lines: Object.freeze(result.processedLines.map((line) => Object.freeze({
      lineKey: line.lineKey,
      ruleVersionId: line.ruleVersionId,
      allocations: Object.freeze(line.allocations.map((allocation) => Object.freeze({
        beneficiaryId: allocation.beneficiaryId,
        amountMinor: allocation.amount.minor.toString(),
        currency: allocation.amount.currency,
      }))),
    }))),
    pendingEntitlements: Object.freeze(result.pendingEntitlements.map((entitlement) => Object.freeze({
      entitlementId: entitlement.entitlementId,
      beneficiaryId: entitlement.beneficiaryId,
      amountMinor: entitlement.amountMinor.toString(),
      currency: entitlement.currency,
      state: entitlement.state,
    }))),
  });
}
