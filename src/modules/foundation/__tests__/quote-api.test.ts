import { NextRequest } from "next/server";
import { GET as listQuotesApi, POST as createQuoteApi } from "@/app/api/quotes/route";
import { GET as quoteSearchApi } from "@/app/api/quotes/search/route";
import { GET as getQuoteApi, PATCH as patchQuoteApi } from "@/app/api/quotes/[quoteId]/route";
import { POST as addLineApi } from "@/app/api/quotes/[quoteId]/lines/route";
import { PATCH as patchLineApi, DELETE as deleteLineApi } from "@/app/api/quotes/[quoteId]/lines/[lineId]/route";
import { GET as revisionsApi, POST as createRevisionApi } from "@/app/api/quotes/[quoteId]/revisions/route";
import { GET as quoteAuditApi } from "@/app/api/quotes/[quoteId]/audit/route";
import { POST as submitApi } from "@/app/api/quotes/[quoteId]/submit/route";
import { POST as approveApi } from "@/app/api/quotes/[quoteId]/approve/route";
import { POST as presentApi } from "@/app/api/quotes/[quoteId]/present/route";
import { POST as acceptApi } from "@/app/api/quotes/[quoteId]/accept/route";
import { POST as convertApi } from "@/app/api/quotes/[quoteId]/convert/route";
import { resetQuoteRepositoryForTests } from "@/modules/foundation/quote-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer";
  organizationId?: string;
  siteId?: string;
  actor?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (input.role) {
    headers["x-gcp-roles"] = input.role;
  }
  if (input.organizationId) {
    headers["x-gcp-organization-id"] = input.organizationId;
  }
  if (input.siteId) {
    headers["x-gcp-site-id"] = input.siteId;
  }
  if (input.actor) {
    headers["x-gcp-actor"] = input.actor;
  }
  return headers;
}

describe("GCP-0002H quote API", () => {
  beforeEach(() => {
    resetQuoteRepositoryForTests();
  });

  test("list/create quote enforce auth", async () => {
    const denied = await listQuotesApi(request("http://localhost/api/quotes", {
      headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
    }));
    expect(denied.status).toBe(403);

    const payload = {
      organizationId: "led-display-warehouse",
      customerReference: "cust-ledw-stadium-group",
      primaryContactReference: null,
      ownerReference: "owner-ledw-commerce",
      salesRepresentativeReference: null,
      siteReference: "site-led-display-warehouse-production",
      currency: "USD",
      effectiveDate: "2026-01-01T00:00:00.000Z",
      expirationDate: "2026-01-31T00:00:00.000Z",
      commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
      internalNotes: null,
      customerNotes: null,
      metadata: {},
    };

    const created = await createQuoteApi(request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }));
    expect(created.status).toBe(201);

    const allowed = await listQuotesApi(request("http://localhost/api/quotes", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));
    expect(allowed.status).toBe(200);
  });

  test("quote detail, draft patch, and line mutation routes work", async () => {
    const createResponse = await createQuoteApi(request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: "led-display-warehouse",
        customerReference: "cust-ledw-stadium-group",
        primaryContactReference: null,
        ownerReference: "owner-ledw-commerce",
        salesRepresentativeReference: null,
        siteReference: "site-led-display-warehouse-production",
        currency: "USD",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        expirationDate: "2026-01-31T00:00:00.000Z",
        commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
        internalNotes: null,
        customerNotes: null,
        metadata: {},
      }),
    }));

    const createPayload = (await createResponse.json()) as { quote: { documentId: string } };
    const quoteId = createPayload.quote.documentId;

    const detail = await getQuoteApi(request(`http://localhost/api/quotes/${quoteId}`, {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(detail.status).toBe(200);

    const patch = await patchQuoteApi(request(`http://localhost/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerNotes: "API-updated", expectedVersion: 1 }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(patch.status).toBe(200);

    const addLine = await addLineApi(request(`http://localhost/api/quotes/${quoteId}/lines`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        productId: "prod-indoor-led-video-wall",
        sku: "LEDW-IN-001",
        productRevision: "rev-1",
        catalogRevision: "cat-1",
        displayName: "Indoor LED Wall",
        description: null,
        quantity: 1,
        unitOfMeasure: "ea",
        unitPrice: 100,
        discount: 0,
        currency: "USD",
        taxClassification: null,
        siteReference: "site-led-display-warehouse-production",
        metadata: {},
      }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(addLine.status).toBe(201);

    const linePayload = (await addLine.json()) as { line: { lineId: string } };
    const lineId = linePayload.line.lineId;

    const patchLine = await patchLineApi(request(`http://localhost/api/quotes/${quoteId}/lines/${lineId}`, {
      method: "PATCH",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ quantity: 2 }),
    }), {
      params: Promise.resolve({ quoteId, lineId }),
    });
    expect(patchLine.status).toBe(200);

    const removeLine = await deleteLineApi(request(`http://localhost/api/quotes/${quoteId}/lines/${lineId}`, {
      method: "DELETE",
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
    }), {
      params: Promise.resolve({ quoteId, lineId }),
    });
    expect(removeLine.status).toBe(200);
  });

  test("revision, audit, and lifecycle transition routes work", async () => {
    const created = await createQuoteApi(request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: "led-display-warehouse",
        customerReference: "cust-ledw-stadium-group",
        primaryContactReference: null,
        ownerReference: "owner-ledw-commerce",
        salesRepresentativeReference: null,
        siteReference: "site-led-display-warehouse-production",
        currency: "USD",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        expirationDate: "2026-01-31T00:00:00.000Z",
        commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
        internalNotes: null,
        customerNotes: null,
        metadata: {},
      }),
    }));

    const quoteId = ((await created.json()) as { quote: { documentId: string } }).quote.documentId;

    await addLineApi(request(`http://localhost/api/quotes/${quoteId}/lines`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        productId: "prod-indoor-led-video-wall",
        sku: "LEDW-IN-001",
        productRevision: "rev-1",
        catalogRevision: "cat-1",
        displayName: "Indoor LED Wall",
        description: null,
        quantity: 1,
        unitOfMeasure: "ea",
        unitPrice: 100,
        discount: 0,
        currency: "USD",
        taxClassification: null,
        siteReference: "site-led-display-warehouse-production",
        metadata: {},
      }),
    }), { params: Promise.resolve({ quoteId }) });

    const revision = await createRevisionApi(request(`http://localhost/api/quotes/${quoteId}/revisions`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "Commercial adjustment", changedFields: ["customerNotes"] }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(revision.status).toBe(201);

    const submit = await submitApi(request(`http://localhost/api/quotes/${quoteId}/submit`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: null }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(submit.status).toBe(200);

    const approve = await approveApi(request(`http://localhost/api/quotes/${quoteId}/approve`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "platform_admin", organizationId: "led-display-warehouse", actor: "approver" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: "approved" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(approve.status).toBe(200);

    const present = await presentApi(request(`http://localhost/api/quotes/${quoteId}/present`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "seller" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: null }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(present.status).toBe(200);

    const accept = await acceptApi(request(`http://localhost/api/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "seller" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: "accepted" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(accept.status).toBe(200);

    const convert = await convertApi(request(`http://localhost/api/quotes/${quoteId}/convert`, {
      method: "POST",
      headers: {
        ...authHeaders({ role: "platform_admin", organizationId: "led-display-warehouse", actor: "seller" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: "convert request" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(convert.status).toBe(200);

    const revisions = await revisionsApi(request(`http://localhost/api/quotes/${quoteId}/revisions`, {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(revisions.status).toBe(200);

    const auditDenied = await quoteAuditApi(request(`http://localhost/api/quotes/${quoteId}/audit`, {
      headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(auditDenied.status).toBe(403);

    const auditAllowed = await quoteAuditApi(request(`http://localhost/api/quotes/${quoteId}/audit`, {
      headers: authHeaders({ role: "analyst", organizationId: "led-display-warehouse" }),
    }), { params: Promise.resolve({ quoteId }) });
    expect(auditAllowed.status).toBe(200);
  });

  test("quote search returns filtered results", async () => {
    await createQuoteApi(request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        ...authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse", actor: "api-test" }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        organizationId: "led-display-warehouse",
        customerReference: "cust-ledw-stadium-group",
        primaryContactReference: null,
        ownerReference: "owner-ledw-commerce",
        salesRepresentativeReference: null,
        siteReference: "site-led-display-warehouse-production",
        currency: "USD",
        effectiveDate: "2026-01-01T00:00:00.000Z",
        expirationDate: "2026-01-31T00:00:00.000Z",
        commercialTerms: { paymentTermsReference: null, freightTermsReference: null, exchangeRate: 1 },
        internalNotes: null,
        customerNotes: null,
        metadata: {},
      }),
    }));

    const response = await quoteSearchApi(request("http://localhost/api/quotes/search?query=Q-", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { results: readonly unknown[] };
    expect(payload.results.length).toBeGreaterThan(0);
  });
});
