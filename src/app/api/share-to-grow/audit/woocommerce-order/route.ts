import { NextRequest, NextResponse } from "next/server";
import {
  auditWooCommerceOrder,
  WooCommerceAuditReceiptNotFoundError,
} from "@/modules/share-to-grow/woocommerce-order-audit";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, private" };
const ALB_COGNITO_IDENTITY_HEADER = "x-amzn-oidc-identity";
const ALLOWED_QUERY_PARAMETERS = new Set(["orderId", "receiptId"]);

function invalidRequest(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: NextRequest) {
  if (process.env.GENESIS_ENVIRONMENT !== "staging") {
    return invalidRequest("NOT_FOUND", 404);
  }

  if (!request.headers.get(ALB_COGNITO_IDENTITY_HEADER)?.trim()) {
    return invalidRequest("AUTHENTICATION_REQUIRED", 401);
  }

  const parameters = request.nextUrl.searchParams;
  if ([...parameters.keys()].some((key) => !ALLOWED_QUERY_PARAMETERS.has(key))) {
    return invalidRequest("UNSUPPORTED_QUERY_PARAMETER", 400);
  }

  const orderIds = parameters.getAll("orderId");
  const receiptIds = parameters.getAll("receiptId");
  if (orderIds.length !== 1 || receiptIds.length > 1) {
    return invalidRequest("AUDIT_QUERY_INVALID", 400);
  }

  const orderIdValue = orderIds[0];
  if (!/^[1-9]\d*$/.test(orderIdValue)) {
    return invalidRequest("ORDER_ID_INVALID", 400);
  }
  const orderId = Number(orderIdValue);
  if (!Number.isSafeInteger(orderId)) {
    return invalidRequest("ORDER_ID_INVALID", 400);
  }

  const receiptId = receiptIds[0];
  if (receiptId !== undefined && (
    receiptId.length < 1
    || receiptId.length > 256
    || /[\u0000-\u001f\u007f]/.test(receiptId)
  )) {
    return invalidRequest("RECEIPT_ID_INVALID", 400);
  }

  try {
    return NextResponse.json(await auditWooCommerceOrder(orderId, receiptId), { headers: noStore });
  } catch (error) {
    if (error instanceof WooCommerceAuditReceiptNotFoundError) {
      return invalidRequest("RECEIPT_NOT_FOUND", 404);
    }
    throw error;
  }
}
