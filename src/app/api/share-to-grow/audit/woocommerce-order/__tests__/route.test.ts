import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockListSourceEventReceipts = jest.fn();
const mockListProcessedCommerceLines = jest.fn();
const mockListPersistedLedgerEntries = jest.fn();
const mockListPersistedPayoutEntitlements = jest.fn();
const mockListEconomicRuleVersions = jest.fn();
const repositoryRoot = resolve(process.cwd());
const productionRouteFile = readFileSync(
  resolve(repositoryRoot, ".github/workflows/genesis-staging-bootstrap.yml"),
  "utf8",
);
const provisionScript = readFileSync(
  resolve(repositoryRoot, "infra/staging/provision.sh"),
  "utf8",
);

jest.mock("@/modules/share-to-grow/share-to-grow-repository", () => ({
  listSourceEventReceipts: (...args: unknown[]) => mockListSourceEventReceipts(...args),
  listProcessedCommerceLines: (...args: unknown[]) => mockListProcessedCommerceLines(...args),
  listCommerceAdjustments: () => [],
  listPersistedLedgerEntries: (...args: unknown[]) => mockListPersistedLedgerEntries(...args),
  listPersistedPayoutEntitlements: (...args: unknown[]) => mockListPersistedPayoutEntitlements(...args),
  listEconomicRuleVersions: (...args: unknown[]) => mockListEconomicRuleVersions(...args),
}));

import { GET } from "../route";

const originalEnvironment = process.env.GENESIS_ENVIRONMENT;

function request(query: string, authenticated = true) {
  return new NextRequest(`https://staging.glwplatform.com/api/share-to-grow/audit/woocommerce-order${query}`, {
    headers: authenticated ? { "x-amzn-oidc-identity": "staging-operator" } : {},
  });
}

function cleanRepository() {
  mockListSourceEventReceipts.mockReturnValue([]);
  mockListProcessedCommerceLines.mockReturnValue([]);
  mockListPersistedLedgerEntries.mockReturnValue([]);
  mockListPersistedPayoutEntitlements.mockReturnValue([]);
  mockListEconomicRuleVersions.mockReturnValue([]);
}

describe("staging WooCommerce order audit route", () => {
  beforeEach(() => {
    process.env.GENESIS_ENVIRONMENT = "staging";
    jest.clearAllMocks();
    cleanRepository();
  });

  afterAll(() => {
    if (originalEnvironment === undefined) delete process.env.GENESIS_ENVIRONMENT;
    else process.env.GENESIS_ENVIRONMENT = originalEnvironment;
  });

  test("accepts staging and returns a deterministic clean baseline", async () => {
    const first = await GET(request("?orderId=650"));
    const second = await GET(request("?orderId=650"));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody).toEqual(secondBody);
    expect(secondBody).toMatchObject({
      order: { orderId: 650 },
      state: "CLEAN",
      eventReceipts: [],
      processedLines: [],
      allocations: [],
      ledger: [],
      entitlements: [],
      idempotency: { economicEffectsPerCanonicalLine: [], receiptReplayEvidence: null },
    });
    expect(first.headers.get("cache-control")).toBe("no-store, private");
  });

  test("fails closed outside staging", async () => {
    process.env.GENESIS_ENVIRONMENT = "production";
    const response = await GET(request("?orderId=650"));
    expect(response.status).toBe(404);
    expect(mockListSourceEventReceipts).not.toHaveBeenCalled();
  });

  test("requires the ALB Cognito identity header", async () => {
    const response = await GET(request("?orderId=650", false));
    expect(response.status).toBe(401);
    expect(mockListSourceEventReceipts).not.toHaveBeenCalled();
  });

  test.each([
    ["missing", ""],
    ["zero", "?orderId=0"],
    ["negative", "?orderId=-1"],
    ["non-integer", "?orderId=1.5"],
    ["text", "?orderId=abc"],
    ["unsafe integer", "?orderId=9007199254740992"],
  ])("rejects %s orderId", async (_label, query) => {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(mockListSourceEventReceipts).not.toHaveBeenCalled();
  });

  test("accepts one exact receiptId and rejects duplicate receiptId values", async () => {
    mockListSourceEventReceipts.mockReturnValue([{
      sourceEventId: "delivery-650",
      source: "woocommerce",
      eventType: "order.updated",
      payloadHash: "sha256-body-hash",
      receivedAt: "2026-10-07T12:00:00Z",
    }]);
    const response = await GET(request("?orderId=650&receiptId=delivery-650"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "RECEIPT_ONLY",
      eventReceipts: [{ receiptId: "delivery-650", bodyHash: "sha256-body-hash" }],
      idempotency: {
        receiptReplayEvidence: {
          requestedReceiptId: "delivery-650",
          found: true,
          repeatedDeliveryAttemptsPersisted: false,
        },
      },
    });
    expect((await GET(request("?orderId=650&receiptId=a&receiptId=b"))).status).toBe(400);
  });

  test("returns not found for an unknown exact receipt ID", async () => {
    const response = await GET(request("?orderId=650&receiptId=not-recorded"));
    expect(response.status).toBe(404);
  });

  test("does not claim a clean order when uncorrelated Woo receipts exist", async () => {
    mockListSourceEventReceipts.mockReturnValue([{
      sourceEventId: "unlinked-delivery",
      source: "woocommerce",
      eventType: "order.updated",
      payloadHash: "opaque-hash",
      receivedAt: "2026-10-07T12:00:00Z",
    }]);
    const response = await GET(request("?orderId=650"));
    const body = await response.json();
    expect(body.state).toBe("RECEIPT_ASSOCIATION_UNKNOWN");
    expect(body.eventReceipts).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("unlinked-delivery");
  });

  test("rejects arbitrary path and query parameters", async () => {
    expect((await GET(request("?orderId=650&path=../../"))).status).toBe(400);
    expect((await GET(request("?orderId=650&file=/etc/passwd"))).status).toBe(400);
    expect(mockListSourceEventReceipts).not.toHaveBeenCalled();
  });

  test("returns only order-matched processed lines, allocations, ledger, and entitlements", async () => {
    mockListSourceEventReceipts.mockReturnValue([
      { sourceEventId: "delivery-650", source: "woocommerce", eventType: "order.updated", payloadHash: "hash-650", receivedAt: "2026-10-07T12:00:00Z" },
      { sourceEventId: "delivery-999", source: "woocommerce", eventType: "order.created", payloadHash: "hash-999", receivedAt: "2026-10-07T12:01:00Z" },
    ]);
    mockListProcessedCommerceLines.mockReturnValue([
      {
        lineKey: "woocommerce:650:77",
        sourceEventId: "delivery-650",
        organizationId: "stoner",
        attribution: {
          policyVersionId: "attribution-v1",
          sourceType: "deterministic_source",
          selectedPartnerId: "jessica",
          selectedTrackingIdentityId: "tracking-jessica",
          decisionReason: "eligible_deterministic_source",
        },
        ruleVersionId: "creator-rule-v1",
        ledgerEntryIds: ["ledger-stoner", "ledger-jessica", "ledger-daniel"],
        processedAt: "2026-10-07T12:00:00Z",
      },
      {
        lineKey: "woocommerce:999:88",
        sourceEventId: "delivery-999",
        organizationId: "stoner",
        attribution: { policyVersionId: "attribution-v1", sourceType: "organic", decisionReason: "no_eligible_source" },
        ruleVersionId: "organic-rule-v1",
        ledgerEntryIds: ["ledger-unrelated"],
        processedAt: "2026-10-07T12:01:00Z",
      },
    ]);
    mockListEconomicRuleVersions.mockReturnValue([{
      id: "creator-rule-v1",
      ruleId: "stoner-gym-recruited-creator",
      version: 1,
      effectiveFrom: "2026-10-05T00:00:00Z",
      beneficiaries: [
        { beneficiaryId: "stoner", role: "brand", basisPoints: 5000 },
        { beneficiaryId: "jessica", role: "creator", basisPoints: 3500 },
        { beneficiaryId: "daniel", role: "network_override", basisPoints: 1500 },
      ],
      residualBeneficiaryId: "stoner",
    }]);
    mockListPersistedLedgerEntries.mockReturnValue([
      { id: "ledger-stoner", idempotencyKey: "earning:woocommerce:650:77:rule:stoner", beneficiaryId: "stoner", allocationId: "allocation-stoner", entryType: "earning", amountMinor: "1850", currency: "USD", postedAt: "2026-10-07T12:00:00Z" },
      { id: "ledger-jessica", idempotencyKey: "earning:woocommerce:650:77:rule:jessica", beneficiaryId: "jessica", allocationId: "allocation-jessica", entryType: "earning", amountMinor: "1295", currency: "USD", postedAt: "2026-10-07T12:00:00Z" },
      { id: "ledger-daniel", idempotencyKey: "earning:woocommerce:650:77:rule:daniel", beneficiaryId: "daniel", allocationId: "allocation-daniel", entryType: "earning", amountMinor: "555", currency: "USD", postedAt: "2026-10-07T12:00:00Z" },
      { id: "ledger-unrelated", idempotencyKey: "earning:woocommerce:999:88:rule:other", beneficiaryId: "other", entryType: "earning", amountMinor: "10000", currency: "USD", postedAt: "2026-10-07T12:01:00Z" },
    ]);
    mockListPersistedPayoutEntitlements.mockReturnValue([
      { entitlementId: "entitlement-stoner", beneficiaryId: "stoner", currency: "USD", ledgerEntryId: "ledger-stoner", amountMinor: "1850", state: "pending", earnedAt: "2026-10-07T12:00:00Z", clearsAt: "2026-11-06T12:00:00Z" },
      { entitlementId: "entitlement-jessica", beneficiaryId: "jessica", currency: "USD", ledgerEntryId: "ledger-jessica", amountMinor: "1295", state: "pending", earnedAt: "2026-10-07T12:00:00Z", clearsAt: "2026-11-06T12:00:00Z" },
      { entitlementId: "entitlement-daniel", beneficiaryId: "daniel", currency: "USD", ledgerEntryId: "ledger-daniel", amountMinor: "555", state: "pending", earnedAt: "2026-10-07T12:00:00Z", clearsAt: "2026-11-06T12:00:00Z" },
      { entitlementId: "unrelated-entitlement", beneficiaryId: "other", currency: "USD", ledgerEntryId: "ledger-unrelated", amountMinor: "10000", state: "pending", earnedAt: "2026-10-07T12:01:00Z", clearsAt: "2026-11-06T12:01:00Z" },
    ]);

    const response = await GET(request("?orderId=650"));
    const body = await response.json();
    expect(body.state).toBe("PROCESSED");
    expect(body.eventReceipts).toHaveLength(1);
    expect(body.processedLines).toHaveLength(1);
    expect(body.processedLines[0]).toMatchObject({
      canonicalLineIdentity: "woocommerce:650:77",
      orderId: 650,
      lineItemId: "77",
      productId: null,
      attributedPartner: "jessica",
      trackingIdentityId: "tracking-jessica",
      campaignId: null,
      dmp: { amount: "37.00", currency: "USD" },
      processingState: "processed",
    });
    expect(body.allocations.map((item: { beneficiary: string; percentage: number; amount: { amount: string } }) => [
      item.beneficiary, item.percentage, item.amount.amount,
    ])).toEqual([["stoner", 50, "18.50"], ["jessica", 35, "12.95"], ["daniel", 15, "5.55"]]);
    expect(body.ledger).toHaveLength(3);
    expect(body.entitlements).toHaveLength(3);
    expect(body.idempotency.economicEffectsPerCanonicalLine).toEqual([{
      canonicalLineIdentity: "woocommerce:650:77",
      economicEffectCount: 1,
      allocationCount: 3,
      ledgerEntryCount: 3,
    }]);
    expect(JSON.stringify(body)).not.toMatch(/unrelated|delivery-999|ledger-unrelated|10000/);
  });

  test("represents a separately supplied delivery receipt as replay without duplicate economics", async () => {
    mockListSourceEventReceipts.mockReturnValue([
      { sourceEventId: "original-delivery", source: "woocommerce", eventType: "order.created", payloadHash: "hash-original", receivedAt: "2026-10-07T12:00:00Z" },
      { sourceEventId: "replay-delivery", source: "woocommerce", eventType: "order.created", payloadHash: "hash-original", receivedAt: "2026-10-07T12:02:00Z" },
    ]);
    mockListProcessedCommerceLines.mockReturnValue([{
      lineKey: "woocommerce:650:77",
      sourceEventId: "original-delivery",
      organizationId: "stoner",
      attribution: { policyVersionId: "v1", sourceType: "deterministic_source", selectedPartnerId: "jessica", decisionReason: "eligible" },
      ruleVersionId: "rule-v1",
      ledgerEntryIds: ["ledger-one"],
      processedAt: "2026-10-07T12:00:00Z",
    }]);
    mockListPersistedLedgerEntries.mockReturnValue([{
      id: "ledger-one", idempotencyKey: "earning:woocommerce:650:77:rule:stoner", beneficiaryId: "stoner",
      allocationId: "allocation-one", entryType: "earning", amountMinor: "3700", currency: "USD", postedAt: "2026-10-07T12:00:00Z",
    }]);
    const response = await GET(request("?orderId=650&receiptId=replay-delivery"));
    const body = await response.json();
    expect(body.state).toBe("REPLAY");
    expect(body.idempotency.receiptReplayEvidence).toMatchObject({
      requestedReceiptId: "replay-delivery",
      distinctFromProcessedEvent: true,
      repeatedDeliveryAttemptsPersisted: false,
    });
    expect(body.idempotency.economicEffectsPerCanonicalLine[0].economicEffectCount).toBe(1);
    expect(body.ledger).toHaveLength(1);
  });

  test("does not report DMP when the persisted allocation ledger is incomplete", async () => {
    mockListProcessedCommerceLines.mockReturnValue([{
      lineKey: "woocommerce:650:77",
      sourceEventId: "delivery-650",
      organizationId: "stoner",
      attribution: { policyVersionId: "v1", sourceType: "organic", decisionReason: "no_eligible_source" },
      ruleVersionId: "rule-v1",
      ledgerEntryIds: ["ledger-one", "ledger-missing"],
      processedAt: "2026-10-07T12:00:00Z",
    }]);
    mockListPersistedLedgerEntries.mockReturnValue([{
      id: "ledger-one", idempotencyKey: "earning:woocommerce:650:77:rule:stoner", beneficiaryId: "stoner",
      allocationId: "allocation-one", entryType: "earning", amountMinor: "1200", currency: "USD", postedAt: "2026-10-07T12:00:00Z",
    }]);
    const response = await GET(request("?orderId=650"));
    const body = await response.json();
    expect(body.processedLines[0]).toMatchObject({ dmp: null, processingState: "incomplete" });
  });

  test("does not return secret-like fields or invoke repository writes", async () => {
    const response = await GET(request("?orderId=650"));
    const bodyText = JSON.stringify(await response.json());
    expect(bodyText).not.toMatch(/secret|password|token|authorization/i);
    expect(mockListSourceEventReceipts).toHaveBeenCalledTimes(1);
    expect(mockListProcessedCommerceLines).toHaveBeenCalledTimes(1);
    expect(mockListPersistedLedgerEntries).toHaveBeenCalledTimes(1);
    expect(mockListPersistedPayoutEntitlements).toHaveBeenCalledTimes(1);
    expect(mockListEconomicRuleVersions).toHaveBeenCalledTimes(1);
    expect(productionRouteFile).not.toMatch(/\/api\/share-to-grow\/audit\/woocommerce-order/);
    expect(provisionScript).not.toMatch(/\/api\/share-to-grow\/audit\/woocommerce-order/);
  });
});
