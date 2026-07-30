import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { addQuoteLine, getQuoteById } from "@/modules/foundation/quote-repository";
import type { NewQuoteLineInput } from "@/modules/foundation/quote-types";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:update_lines");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await context.params;
  const quote = getQuoteById(quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (!isRecordInScope({
    recordOrganizationId: quote.organizationId,
    recordSiteId: quote.siteReference,
    scope,
  })) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const body = (await request.json()) as NewQuoteLineInput & { expectedVersion?: number };

  const result = addQuoteLine({
    quoteId,
    line: body,
    actor: actorFromRequest(request),
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote || !result.line) {
    return NextResponse.json({ error: "Unable to add line" }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote, line: result.line }, { status: 201 });
}
