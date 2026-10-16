import { siteIntelligenceRequestHeaders } from "../site-intelligence-request-headers";

describe("site intelligence request headers", () => {
  test("includes CSRF for mutation JSON requests", () => {
    const originalDocument = global.document;
    Object.defineProperty(global, "document", {
      configurable: true,
      value: { cookie: "genesis_operator_csrf=intel-csrf-token; other=value" },
    });

    const headers = new Headers(siteIntelligenceRequestHeaders({
      organizationId: "pageengines",
      siteId: "site-pageengines-pageengines-staging",
      mutation: true,
    }));
    expect(headers.get("x-genesis-csrf-token")).toBe("intel-csrf-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
    expect(headers.get("x-gcp-site-id")).toBe("site-pageengines-pageengines-staging");

    Object.defineProperty(global, "document", { configurable: true, value: originalDocument });
  });

  test("keeps multipart boundary handling browser-managed while still adding CSRF", () => {
    const originalDocument = global.document;
    Object.defineProperty(global, "document", {
      configurable: true,
      value: { cookie: "genesis_operator_csrf=upload-csrf-token; other=value" },
    });

    const headers = new Headers(siteIntelligenceRequestHeaders({
      organizationId: "pageengines",
      siteId: "site-pageengines-pageengines-staging",
      mutation: true,
      jsonContentType: false,
    }));
    expect(headers.get("x-genesis-csrf-token")).toBe("upload-csrf-token");
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
    expect(headers.get("x-gcp-site-id")).toBe("site-pageengines-pageengines-staging");

    Object.defineProperty(global, "document", { configurable: true, value: originalDocument });
  });

  test("read-only requests include scope but no CSRF mutation header", () => {
    const headers = new Headers(siteIntelligenceRequestHeaders({
      organizationId: "pageengines",
      siteId: "site-pageengines-pageengines-staging",
      jsonContentType: false,
    }));
    expect(headers.get("x-genesis-csrf-token")).toBeNull();
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
    expect(headers.get("x-gcp-site-id")).toBe("site-pageengines-pageengines-staging");
  });
});

