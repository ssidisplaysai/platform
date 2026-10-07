import { NextRequest, NextResponse } from "next/server";
import { processWooCommerceWebhookHttp } from "@/modules/share-to-grow/adapters/woocommerce-webhook-http";

function recruitedCreatorIds(): readonly string[] {
  return Object.freeze(
    (process.env.GENESIS_STONER_GYM_RECRUITED_CREATORS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function statusForError(message: string): number {
  if (
    message === "INVALID_WOOCOMMERCE_WEBHOOK_SIGNATURE" ||
    message === "MISSING_WOOCOMMERCE_WEBHOOK_SIGNATURE"
  ) {
    return 401;
  }
  if (
    message.startsWith("MISSING_WOOCOMMERCE_") ||
    message.startsWith("UNSUPPORTED_WOOCOMMERCE_") ||
    message.startsWith("INVALID_WOOCOMMERCE_") ||
    message === "WOOCOMMERCE_EVENT_HANDLER_NOT_IMPLEMENTED"
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: NextRequest) {
  const secret = process.env.GENESIS_WOOCOMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "WOOCOMMERCE_WEBHOOK_SECRET_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  try {
    const result = processWooCommerceWebhookHttp({
      rawBody,
      headers: {
        "x-wc-webhook-signature": request.headers.get("x-wc-webhook-signature") ?? undefined,
        "x-wc-webhook-topic": request.headers.get("x-wc-webhook-topic") ?? undefined,
        "x-wc-webhook-delivery-id": request.headers.get("x-wc-webhook-delivery-id") ?? undefined,
        "x-wc-webhook-id": request.headers.get("x-wc-webhook-id") ?? undefined,
      },
      secret,
      receivedAt: new Date().toISOString(),
      recruitedCreatorPartnerIds: recruitedCreatorIds(),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WOOCOMMERCE_WEBHOOK_PROCESSING_FAILED";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
