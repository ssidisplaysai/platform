import { parseWooCommerceOrderEligibilityFacts } from "./woocommerce-payloads";

export interface WooCommerceOrderVerificationInput {
  readonly webhookRawBody: string;
  readonly webhookOrderId: string;
}

export interface WooCommerceOrderVerificationResult {
  readonly authoritativeRawBody: string;
}

export type WooCommerceOrderVerifier = (
  input: WooCommerceOrderVerificationInput,
) => Promise<WooCommerceOrderVerificationResult>;

type WooApiOrderLine = {
  readonly id: number | string;
  readonly product_id?: number | string;
  readonly variation_id?: number | string;
  readonly quantity?: number;
  readonly subtotal?: string;
  readonly total?: string;
  readonly meta_data?: readonly { readonly key?: string; readonly value?: unknown }[];
};

type WooApiOrder = {
  readonly id?: number | string;
  readonly status?: string;
  readonly currency?: string;
  readonly total?: string;
  readonly date_paid_gmt?: string | null;
  readonly date_created_gmt?: string | null;
  readonly date_modified_gmt?: string | null;
  readonly refunds?: readonly { readonly total?: string }[];
  readonly meta_data?: readonly { readonly key?: string; readonly value?: unknown }[];
  readonly line_items?: readonly WooApiOrderLine[];
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE");
  return value;
}

function canonicalRawOrder(order: WooApiOrder): string {
  const canonical = {
    id: order.id,
    status: order.status,
    currency: order.currency,
    total: order.total,
    date_paid_gmt: order.date_paid_gmt ?? null,
    date_created_gmt: order.date_created_gmt ?? null,
    date_modified_gmt: order.date_modified_gmt ?? null,
    refunds: order.refunds ?? [],
    meta_data: order.meta_data ?? [],
    line_items: order.line_items ?? [],
  };
  return JSON.stringify(canonical);
}

function parseCurrency(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { currency?: unknown };
    return typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : null;
  } catch {
    return null;
  }
}

function assertConsistent(input: {
  readonly webhookRawBody: string;
  readonly authoritativeRawBody: string;
  readonly webhookOrderId: string;
}): void {
  const webhookFacts = parseWooCommerceOrderEligibilityFacts(input.webhookRawBody);
  const authoritativeFacts = parseWooCommerceOrderEligibilityFacts(input.authoritativeRawBody);
  if (webhookFacts.orderId !== authoritativeFacts.orderId || webhookFacts.orderId !== input.webhookOrderId) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  }
  if (webhookFacts.status !== authoritativeFacts.status) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  }
  if (webhookFacts.totalMinor !== authoritativeFacts.totalMinor) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  }
  const webhookCurrency = parseCurrency(input.webhookRawBody);
  const authoritativeCurrency = parseCurrency(input.authoritativeRawBody);
  if (webhookCurrency !== authoritativeCurrency) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  }
}

async function fetchAuthoritativeWooOrder(input: {
  readonly orderId: string;
}): Promise<WooCommerceOrderVerificationResult> {
  const baseUrl = readRequiredEnv("GENESIS_WOOCOMMERCE_API_BASE_URL").replace(/\/+$/, "");
  const consumerKey = readRequiredEnv("GENESIS_WOOCOMMERCE_API_CONSUMER_KEY");
  const consumerSecret = readRequiredEnv("GENESIS_WOOCOMMERCE_API_CONSUMER_SECRET");
  const endpoint = `${baseUrl}/wp-json/wc/v3/orders/${encodeURIComponent(input.orderId)}`;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`, "utf8").toString("base64");

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE");
  }

  if (!response.ok) {
    throw new Error("WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_RESPONSE");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_RESPONSE");
  }

  const order = payload as WooApiOrder;
  if (String(order.id ?? "") !== input.orderId) {
    throw new Error("INVALID_WOOCOMMERCE_ORDER_VERIFICATION_MISMATCH");
  }

  return Object.freeze({
    authoritativeRawBody: canonicalRawOrder(order),
  });
}

export async function verifyWooCommerceOrderAuthoritatively(
  input: WooCommerceOrderVerificationInput & {
    readonly verifier?: WooCommerceOrderVerifier;
  },
): Promise<WooCommerceOrderVerificationResult> {
  const result = await (input.verifier
    ? input.verifier(input)
    : fetchAuthoritativeWooOrder({ orderId: input.webhookOrderId }));
  assertConsistent({
    webhookRawBody: input.webhookRawBody,
    authoritativeRawBody: result.authoritativeRawBody,
    webhookOrderId: input.webhookOrderId,
  });
  return result;
}
