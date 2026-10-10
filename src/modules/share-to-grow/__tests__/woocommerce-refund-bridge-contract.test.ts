import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { processWooCommerceWebhookHttp } from "../adapters/woocommerce-webhook-http";
import {
  listCommerceAdjustments,
  listPersistedLedgerEntries,
  resetShareToGrowRepositoryForTests,
} from "../share-to-grow-repository";

const bridgeRoot = path.join(process.cwd(), "integrations", "wordpress", "genesis-share-to-grow");
const bridgeSource = readFileSync(path.join(bridgeRoot, "includes", "class-genesis-s2g-refund-bridge.php"), "utf8");
const phpTests = readFileSync(path.join(bridgeRoot, "tests", "run.php"), "utf8");
const goldenBody = readFileSync(path.join(bridgeRoot, "tests", "fixtures", "two-line-refund.json"), "utf8").trim();
const secret = "bridge-contract-secret";

function lineItem(id: number, total: string, cogs: string) {
  return {
    id,
    product_id: 646,
    variation_id: 0,
    quantity: 1,
    subtotal: total,
    total,
    meta_data: [
      { key: "_genesis_cogs", value: cogs },
      { key: "_genesis_inbound_freight_duty", value: "1.00" },
      { key: "_genesis_fulfillment_packaging", value: "2.00" },
      { key: "_genesis_payment_processing", value: "2.00" },
    ],
  };
}

function twoLineOrder(id: number): string {
  return JSON.stringify({
    id,
    status: "processing",
    total: "90.00",
    currency: "USD",
    date_paid_gmt: "2026-10-07T01:37:55Z",
    date_created_gmt: "2026-10-07T01:37:51Z",
    meta_data: [
      { key: "_genesis_touch_id", value: "touch-jessica" },
      { key: "_genesis_tracking_identity_id", value: "tracking-jessica" },
      { key: "_genesis_partner_id", value: "jessica" },
      { key: "_genesis_campaign_id", value: "GYM" },
    ],
    line_items: [lineItem(2, "60.00", "18.00"), lineItem(3, "30.00", "9.00")],
  });
}

async function send(topic: string, deliveryId: string, rawBody: string, signingSecret = secret) {
  return await (processWooCommerceWebhookHttp({
    rawBody,
    headers: {
      "x-wc-webhook-signature": createHmac("sha256", signingSecret).update(rawBody).digest("base64"),
      "x-wc-webhook-topic": topic,
      "x-wc-webhook-delivery-id": deliveryId,
    },
    secret,
    receivedAt: "2026-10-07T02:00:00Z",
    recruitedCreatorPartnerIds: ["jessica"],
  }));
}

describe("WordPress refund bridge contract", () => {
  beforeEach(async () => await (resetShareToGrowRepositoryForTests()));

  test("golden two-line refund payload is accepted by the Genesis parser with exact line association", async () => {
    await (send("order.updated", "d-1", twoLineOrder(812)));
    const result = await (send("refund.created", "woo-refund-812-9001", goldenBody));
    expect(["partially_reversed", "reversed"]).toContain(result.economicDisposition);

    const [adjustment] = await (listCommerceAdjustments());
    expect(adjustment.adjustmentId).toBe("refund:812:9001");
    const byLine = new Map(adjustment.lineRefunds.map((entry) => [entry.lineKey, entry.refundMinor]));
    expect(byLine.get("woocommerce:812:2")).toBe("2000");
    expect(byLine.get("woocommerce:812:3")).toBe("550");
    expect(adjustment.customerRefundMinor).toBe("2550");
    expect(adjustment.economicReversalMinor).toBe("2550");
  });

  test("the bridge delivery id and a duplicate bridge send add no second reversal", async () => {
    await (send("order.updated", "d-1", twoLineOrder(812)));
    await (send("refund.created", "woo-refund-812-9001", goldenBody));
    const entries = (await listPersistedLedgerEntries()).length;
    expect((await send("refund.created", "woo-refund-812-9001", goldenBody)).economicDisposition).toBe("replay");
    expect((await send("refund.created", "woo-refund-812-9001-retry", goldenBody)).economicDisposition).toBe("replay");
    expect(await (listPersistedLedgerEntries())).toHaveLength(entries);
  });

  test("a body signed with a different secret is rejected", async () => {
    await (send("order.updated", "d-1", twoLineOrder(812)));
    await expect(send("refund.created", "woo-refund-812-9001", goldenBody, "other-secret")).rejects.toThrow();
  });

  test("the PHP HMAC test vector equals Node's HMAC (Genesis verification semantics)", () => {
    const vector = /'([A-Za-z0-9+/=]{44})' === \$B::sign\( '\{"id":1\}', 'test-secret' \)/.exec(phpTests);
    expect(vector).not.toBeNull();
    expect(vector![1]).toBe(createHmac("sha256", "test-secret").update('{"id":1}').digest("base64"));
  });

  test("bridge source honours the security contract", () => {
    expect(bridgeSource).toContain("'woocommerce_refund_created'");
    expect(bridgeSource).toContain("'X-WC-Webhook-Topic'        => 'refund.created'");
    expect(bridgeSource).toContain("hash_hmac( 'sha256', $body, $secret, true )");
    expect(bridgeSource).toContain("$webhook->get_secret()");
    expect(bridgeSource).toContain("const WEBHOOK_NAME        = 'Genesis Share-to-Grow Staging'");
    expect(bridgeSource).toContain("const DEFAULT_ALLOWED_HOST = 'staging.stonerusa.com'");
    expect(bridgeSource).toMatch(/const MAX_ATTEMPTS\s+= 5;/);
    expect(bridgeSource).toMatch(/const TIMEOUT_SECONDS\s+= 10;/);
    // No hard-coded secret and no REST credentials, endpoints or payout logic.
    expect(bridgeSource).not.toMatch(/consumer_(key|secret)|register_rest_route|payout|wp_ajax|admin_post/i);
  });

  const php = spawnSync("php", ["-v"], { encoding: "utf8" });
  (php.status === 0 ? test : test.skip)("PHP bridge unit tests pass", () => {
    const run = spawnSync("php", [path.join(bridgeRoot, "tests", "run.php")], { encoding: "utf8" });
    expect(run.stdout).toMatch(/\d+ passed, 0 failed/);
    expect(run.status).toBe(0);
  });
});
