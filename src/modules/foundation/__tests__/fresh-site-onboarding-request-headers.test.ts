import { onboardingRequestHeaders } from "../FreshSiteOnboardingFlow";

describe("fresh-site onboarding request headers", () => {
  test("includes operator CSRF header for mutation requests", () => {
    const originalDocument = global.document;
    Object.defineProperty(global, "document", {
      configurable: true,
      value: { cookie: "genesis_operator_csrf=preflight-csrf-token; other=value" },
    });

    const headers = new Headers(onboardingRequestHeaders("pageengines", "site-pageengines-pageengines-staging", true));
    expect(headers.get("x-genesis-csrf-token")).toBe("preflight-csrf-token");
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
    expect(headers.get("x-gcp-site-id")).toBe("site-pageengines-pageengines-staging");

    Object.defineProperty(global, "document", { configurable: true, value: originalDocument });
  });

  test("does not inject CSRF header for read-only requests", () => {
    const headers = new Headers(onboardingRequestHeaders("pageengines"));
    expect(headers.get("x-genesis-csrf-token")).toBeNull();
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
  });
});

