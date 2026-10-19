import { onboardingProfileCreateHeaders } from "../OnboardingProfileCreator";

describe("onboarding profile creator mutation headers", () => {
  test("includes operator CSRF header for profile registration", () => {
    const originalDocument = global.document;
    Object.defineProperty(global, "document", {
      configurable: true,
      value: { cookie: "genesis_operator_csrf=profile-csrf-token; other=value" },
    });

    const headers = new Headers(onboardingProfileCreateHeaders("pageengines"));
    expect(headers.get("x-genesis-csrf-token")).toBe("profile-csrf-token");
    expect(headers.get("x-gcp-organization-id")).toBe("pageengines");
    expect(headers.get("x-gcp-roles")).toBe("ops_manager");

    Object.defineProperty(global, "document", { configurable: true, value: originalDocument });
  });
});

