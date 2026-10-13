import { NextRequest, NextResponse } from "next/server";
import { processShopifyWebhookHttp } from "@/modules/share-to-grow/adapters/shopify-webhook-http";

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
    message === "INVALID_SHOPIFY_WEBHOOK_SIGNATURE"
    || message === "MISSING_SHOPIFY_WEBHOOK_SIGNATURE"
  ) {
    return 401;
  }
  if (
    message.startsWith("MISSING_SHOPIFY_")
    || message.startsWith("UNSUPPORTED_SHOPIFY_")
    || message.startsWith("INVALID_SHOPIFY_")
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: NextRequest) {
  const secret = process.env.GENESIS_SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SHOPIFY_WEBHOOK_SECRET_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  try {
    const result = await processShopifyWebhookHttp({
      rawBody,
      headers: {
        "x-shopify-hmac-sha256": request.headers.get("x-shopify-hmac-sha256") ?? undefined,
        "x-shopify-topic": request.headers.get("x-shopify-topic") ?? undefined,
        "x-shopify-webhook-id": request.headers.get("x-shopify-webhook-id") ?? undefined,
      },
      secret,
      receivedAt: new Date().toISOString(),
      recruitedCreatorPartnerIds: recruitedCreatorIds(),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SHOPIFY_WEBHOOK_PROCESSING_FAILED";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
