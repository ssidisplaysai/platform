import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createQuote, listQuotes } from "@/modules/foundation/quote-repository";
import type { NewQuoteInput, QuoteCommercialStatus } from "@/modules/foundation/quote-types";

function parseStatus(value: string | null): QuoteCommercialStatus | undefined {
  if (!value) {
    return undefined;
  }

  const values: readonly QuoteCommercialStatus[] = [
    "draft",
    "pricing",
    "pending_approval",
    "approved",
    "presented",
    "negotiating",
    "accepted",
    "rejected",
    "expired",
    "cancelled",
    "converted",
  ];

  return values.includes(value as QuoteCommercialStatus)
    ? (value as QuoteCommercialStatus)
    : undefined;
}

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "quotes:read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const requestedOrganizationId = params.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedSiteId = params.get("siteReference") ?? params.get("siteId");
  if (scope.siteId && requestedSiteId && requestedSiteId !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quotes = listQuotes({
    organizationId: scope.organizationId ?? undefined,
    siteReference: scope.siteId ?? requestedSiteId ?? undefined,
    customerReference: params.get("customerReference") ?? undefined,
    commercialStatus: parseStatus(params.get("commercialStatus")),
    ownerReference: params.get("ownerReference") ?? undefined,
    query: params.get("query") ?? undefined,
  }).filter((quote) =>
    isRecordInScope({
      recordOrganizationId: quote.organizationId,
      recordSiteId: quote.siteReference,
      scope,
    })
  );

  return NextResponse.json({ quotes });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "quotes:create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as NewQuoteInput;
  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (scope.siteId && body.siteReference && body.siteReference !== scope.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = createQuote({
    ...body,
    actor: actorFromRequest(request),
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote) {
    return NextResponse.json({ error: "Unable to create quote." }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote }, { status: 201 });
}
