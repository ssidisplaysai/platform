import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createQuoteRevision, getQuoteById, listQuoteRevisions } from "@/modules/foundation/quote-repository";

type RouteContext = {
  params: Promise<{ quoteId: string }>;
};

function actorFromRequest(request: NextRequest): string {
  return request.headers.get("x-gcp-actor") ?? "api";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:read");
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

  return NextResponse.json({ revisions: listQuoteRevisions(quoteId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "quotes:create_revision");
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

  const body = (await request.json()) as {
    reason: string;
    changedFields?: string[];
    expectedVersion?: number;
  };

  const result = createQuoteRevision({
    quoteId,
    actor: actorFromRequest(request),
    reason: body.reason,
    changedFields: body.changedFields ?? [],
    expectedVersion: body.expectedVersion,
  });

  if (!result.validation.valid) {
    return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
  }

  if (!result.quote || !result.revision) {
    return NextResponse.json({ error: "Unable to create revision" }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote, revision: result.revision }, { status: 201 });
}
