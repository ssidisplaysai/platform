import type { AttributionTouch, AttributionDecision } from "../attribution";
import { decideAttribution } from "../attribution";
import { normalizeCommerceOrder } from "../commerce";
import { allocateCommerceLine, type ProcessedCommerceLine } from "../allocation-pipeline";
import { AppendOnlyLedger } from "../ledger";
import { createPendingEntitlement, type PayoutEntitlement } from "../payout";
import { persistProcessedCommerceLine } from "../durable-processing";
import {
  acceptWooCommerceWebhook,
  type WooCommerceWebhookEnvelope,
} from "./woocommerce-events";
import type { WooCommerceOrderEligibility } from "./woocommerce-eligibility";
import {
  genesisAttributionFromWooMeta,
  normalizeWooCommerceOrder,
  type WooCommerceOrderSnapshot,
} from "./woocommerce";
import {
  createStonerGymRuleResolver,
  STONER_GYM_REFERENCE,
} from "../reference/stoner-gym";

export interface WooCommerceOrderProcessingInput {
  readonly webhook: WooCommerceWebhookEnvelope;
  readonly webhookSecret: string;
  readonly order: WooCommerceOrderSnapshot;
  readonly orderMeta: Readonly<Record<string, string | undefined>>;
  readonly qualifiedTouches: readonly AttributionTouch[];
  readonly recruitedCreatorPartnerIds: readonly string[];
  readonly ledger: AppendOnlyLedger;
}

export type WooCommerceOrderEconomicDisposition = "processed" | "replay" | "ignored_ineligible";

export interface WooCommerceOrderProcessingResult {
  readonly replay: boolean;
  readonly economicDisposition: WooCommerceOrderEconomicDisposition;
  readonly reason?: string;
  readonly attribution?: AttributionDecision;
  readonly processedLines: readonly ProcessedCommerceLine[];
  readonly pendingEntitlements: readonly PayoutEntitlement[];
}

export function ignoreIneligibleWooCommerceOrder(input: {
  readonly webhook: WooCommerceWebhookEnvelope;
  readonly webhookSecret: string;
  readonly eligibility: WooCommerceOrderEligibility;
}): WooCommerceOrderProcessingResult {
  const verified = acceptWooCommerceWebhook(input.webhook, input.webhookSecret);
  return Object.freeze({
    replay: verified.replay,
    economicDisposition: "ignored_ineligible" as const,
    reason: input.eligibility.reason,
    processedLines: Object.freeze([]),
    pendingEntitlements: Object.freeze([]),
  });
}

export function processWooCommerceOrder(
  input: WooCommerceOrderProcessingInput,
): WooCommerceOrderProcessingResult {
  const verified = acceptWooCommerceWebhook(input.webhook, input.webhookSecret);

  if (input.order.organizationId !== STONER_GYM_REFERENCE.organizationId) {
    throw new Error("STONER_GYM_ORGANIZATION_MISMATCH");
  }

  const commerceInput = normalizeWooCommerceOrder(input.order);
  const lines = normalizeCommerceOrder(commerceInput);
  const evidence = genesisAttributionFromWooMeta(input.orderMeta);

  const deterministicSource = evidence?.canonicalPartnerId
    ? {
        sourceId: input.webhook.sourceEventId,
        canonicalPartnerId: evidence.canonicalPartnerId,
        trackingIdentityId: evidence.trackingIdentityId,
        eligible: true,
      }
    : undefined;

  const attribution = decideAttribution({
    conversionAt: input.order.convertedAt,
    policy: STONER_GYM_REFERENCE.attributionPolicy,
    deterministicSource,
    touches: input.qualifiedTouches,
  });

  if (verified.replay) {
    return Object.freeze({
      replay: true,
      economicDisposition: "replay" as const,
      attribution,
      processedLines: Object.freeze([]),
      pendingEntitlements: Object.freeze([]),
    });
  }

  const ruleResolver = createStonerGymRuleResolver({
    recruitedCreatorPartnerIds: input.recruitedCreatorPartnerIds,
  });

  const processedLines = lines.map((line) =>
    allocateCommerceLine({
      line,
      attribution,
      ruleResolver,
      ledger: input.ledger,
      postedAt: input.order.convertedAt,
    }),
  );

  let anyNewLine = false;
  const pendingEntitlements = processedLines.flatMap((processed, index) => {
    const entitlements = processed.ledgerEntries.map((entry) =>
      createPendingEntitlement({
        ledgerEntry: entry,
        policy: STONER_GYM_REFERENCE.payoutPolicy,
      }),
    );
    const committed = persistProcessedCommerceLine({
      saleMerchandiseMinor: (
        lines[index].grossMerchandise.minor - lines[index].discount.minor
      ).toString(),
      sourceEventId: input.webhook.sourceEventId,
      organizationId: input.order.organizationId,
      processedAt: input.order.convertedAt,
      processedLine: processed,
      attribution,
      entitlements,
    });
    if (!committed.replay) anyNewLine = true;
    return entitlements;
  });

  return Object.freeze({
    replay: false,
    // A later delivery for an already-processed canonical line creates no new economics.
    economicDisposition: anyNewLine ? ("processed" as const) : ("replay" as const),
    attribution,
    processedLines: Object.freeze(anyNewLine ? processedLines : []),
    pendingEntitlements: Object.freeze(anyNewLine ? pendingEntitlements : []),
  });
}