import {
  GENESIS_WOOCOMMERCE_LINE_META,
  parseWooCommerceOrderPayload,
  parseWooCommerceRefundPayload,
  wooDecimalToMinor,
} from "../adapters/woocommerce-payloads";

const lineMeta = [
  { key: GENESIS_WOOCOMMERCE_LINE_META.cogs, value: "18.00" },
  { key: GENESIS_WOOCOMMERCE_LINE_META.inboundFreightDuty, value: "1.00" },
  { key: GENESIS_WOOCOMMERCE_LINE_META.fulfillmentPackaging, value: "2.00" },
  { key: GENESIS_WOOCOMMERCE_LINE_META.paymentProcessing, value: "2.00" },
];

describe("WooCommerce raw payload parsing", () => {
  test("converts decimal strings to integer minor units without floating point", () => {
    expect(wooDecimalToMinor("60.00")).toBe(6000n);
    expect(wooDecimalToMinor("0.01")).toBe(1n);
    expect(wooDecimalToMinor("-12.34")).toBe(-1234n);
    expect(() => wooDecimalToMinor("1.001")).toThrow("WOOCOMMERCE_MONEY_PRECISION_EXCEEDED");
  });

  test("parses a real-shaped order and preserves Genesis attribution metadata", () => {
    const rawBody = JSON.stringify({
      id: 78142,
      currency: "usd",
      date_paid_gmt: "2026-10-06T12:00:00Z",
      meta_data: [
        { key: "_genesis_partner_id", value: "jessica" },
        { key: "_genesis_tracking_identity_id", value: "tracking-jessica" },
      ],
      line_items: [{
        id: 9001,
        product_id: 501,
        variation_id: 0,
        quantity: 1,
        subtotal: "60.00",
        total: "60.00",
        meta_data: lineMeta,
      }],
    });
    const parsed = parseWooCommerceOrderPayload({ rawBody, organizationId: "stoner" });
    expect(parsed.order.orderId).toBe("78142");
    expect(parsed.order.currency).toBe("USD");
    expect(parsed.order.lines[0].grossMerchandiseMinor).toBe(6000n);
    expect(parsed.order.lines[0].cogsMinor).toBe(1800n);
    expect(parsed.orderMeta._genesis_partner_id).toBe("jessica");
  });

  test("fails closed when canonical Genesis cost inputs are missing", () => {
    const rawBody = JSON.stringify({
      id: 1,
      currency: "USD",
      date_created_gmt: "2026-10-06T12:00:00Z",
      line_items: [{ id: 2, product_id: 3, quantity: 1, subtotal: "60.00", total: "60.00", meta_data: [] }],
    });
    expect(() => parseWooCommerceOrderPayload({ rawBody, organizationId: "stoner" }))
      .toThrow("MISSING_WOOCOMMERCE_COST");
  });

  test("parses WooCommerce refund lines as positive refund amounts", () => {
    const rawBody = JSON.stringify({
      id: 700,
      parent_id: 78142,
      date_created_gmt: "2026-10-07T12:00:00Z",
      line_items: [{ id: 9001, total: "-30.00" }],
    });
    const refund = parseWooCommerceRefundPayload(rawBody);
    expect(refund.refundId).toBe("700");
    expect(refund.orderId).toBe("78142");
    expect(refund.lineRefunds[0].refundGrossMinor).toBe(3000n);
  });
});
