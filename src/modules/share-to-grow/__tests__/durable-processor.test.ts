import { createHmac } from "node:crypto";
import { processWooCommerceOrder } from "../adapters/woocommerce-processor";
import { GENESIS_WOOCOMMERCE_ORDER_META } from "../adapters/woocommerce";
import { AppendOnlyLedger } from "../ledger";
import {
  listPersistedLedgerEntries,
  listPersistedPayoutEntitlements,
  listProcessedCommerceLines,
  reloadShareToGrowRepositoryFromPersistence,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

function input(sourceEventId: string, ledger: AppendOnlyLedger) {
  const rawBody = JSON.stringify({ id: 78142, status: "processing" });
  const secret = "durable-secret";
  return {
    webhook: {
      sourceEventId,
      eventType: "order.created" as const,
      rawBody,
      signature: createHmac("sha256", secret).update(rawBody).digest("base64"),
      receivedAt: "2026-10-06T12:00:00Z",
    },
    webhookSecret: secret,
    order: {
      orderId: "78142",
      organizationId: "stoner",
      currency: "USD",
      convertedAt: "2026-10-06T12:00:00Z",
      lines: [{
        lineItemId: "9001",
        productId: "stoner-gym-performance-tee",
        quantity: 1,
        grossMerchandiseMinor: BigInt(6000),
        discountMinor: BigInt(0),
        refundMinor: BigInt(0),
        cogsMinor: BigInt(1800),
        inboundFreightDutyMinor: BigInt(100),
        fulfillmentPackagingMinor: BigInt(200),
        paymentProcessingMinor: BigInt(200),
      }],
    },
    orderMeta: {
      [GENESIS_WOOCOMMERCE_ORDER_META.canonicalPartnerId]: "jessica",
      [GENESIS_WOOCOMMERCE_ORDER_META.trackingIdentityId]: "tracking-jessica",
    },
    qualifiedTouches: [],
    recruitedCreatorPartnerIds: ["jessica"],
    ledger,
  };
}

describe("durable WooCommerce processor", () => {
  beforeEach(() => resetShareToGrowRepositoryForTests());

  test("persists line provenance, exact ledger entries and Pending entitlements", () => {
    processWooCommerceOrder(input("durable-order-1", new AppendOnlyLedger()));

    expect(listProcessedCommerceLines()).toHaveLength(1);
    expect(listPersistedLedgerEntries().map((e) => e.amountMinor)).toEqual(["1850", "1295", "555"]);
    expect(listPersistedPayoutEntitlements()).toHaveLength(3);
    expect(listPersistedPayoutEntitlements().every((e) => e.state === "pending")).toBe(true);

    const record = listProcessedCommerceLines()[0];
    expect(record.attribution.selectedPartnerId).toBe("jessica");
    expect(record.ruleVersionId).toBe("stoner-gym-creator-jessica-v1");
  });

  test("durable records survive repository reload", () => {
    processWooCommerceOrder(input("durable-order-2", new AppendOnlyLedger()));
    reloadShareToGrowRepositoryFromPersistence();

    expect(listProcessedCommerceLines()).toHaveLength(1);
    expect(listPersistedLedgerEntries()).toHaveLength(3);
    expect(listPersistedPayoutEntitlements()).toHaveLength(3);
  });

  test("source replay does not duplicate durable economics", () => {
    const ledger = new AppendOnlyLedger();
    const first = processWooCommerceOrder(input("durable-replay-1", ledger));
    const replay = processWooCommerceOrder(input("durable-replay-1", ledger));

    expect(first.replay).toBe(false);
    expect(replay.replay).toBe(true);
    expect(listProcessedCommerceLines()).toHaveLength(1);
    expect(listPersistedLedgerEntries()).toHaveLength(3);
    expect(listPersistedPayoutEntitlements()).toHaveLength(3);
  });
});
