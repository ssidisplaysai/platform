import { createProductMediaReviewDraft, projectProductMediaReviewControlState } from "../product-media-review-state";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("product media review UI state", () => {
  test("shows actions only where an owner decision is still required", () => {
    expect(projectProductMediaReviewControlState("PENDING_OWNER_APPROVAL")).toEqual({ label: "PENDING OWNER APPROVAL", approvalActionVisible: true, rejectionActionVisible: true, reviewFieldsEditable: true });
    expect(projectProductMediaReviewControlState("APPROVED")).toEqual({ label: "APPROVED", approvalActionVisible: false, rejectionActionVisible: false, reviewFieldsEditable: false });
    expect(projectProductMediaReviewControlState("REJECTED")).toEqual({ label: "REJECTED", approvalActionVisible: true, rejectionActionVisible: false, reviewFieldsEditable: true });
  });

  test("creates isolated card drafts from durable record values", () => {
    const first = createProductMediaReviewDraft({ authorityClass: "PRODUCT_AUTHORITY", proposedUsageScopes: ["PRODUCT_AUTHORITY"], usageScopes: ["PRODUCT_AUTHORITY"], depictsActualProduct: true, heroEligible: true, altTextAuthority: "First", captionAuthority: "First caption" });
    const second = createProductMediaReviewDraft({ authorityClass: "CONTEXTUAL_IN_USE", proposedUsageScopes: ["CONTEXTUAL_IN_USE"], usageScopes: ["CONTEXTUAL_IN_USE"], depictsActualProduct: false, heroEligible: false, altTextAuthority: "Second", captionAuthority: "Second caption" });
    first.usageScopes.push("LOCAL_CONTEXTUAL_ATMOSPHERE");
    expect(first).toMatchObject({ depictsActualProduct: true, heroEligible: true, usageScopes: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"] });
    expect(second).toMatchObject({ depictsActualProduct: false, heroEligible: false, usageScopes: ["CONTEXTUAL_IN_USE"] });
  });

  test("presents hero selection as a separate governed owner action", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/OutdoorSphereMediaAuthorityPanel.tsx"), "utf8");
    expect(source).toContain("Set as Hero");
    expect(source).toContain("window.confirm");
    expect(source).toContain('action: "RUN_HERO_PREFLIGHT"');
    expect(source).toContain('action: "AUTHORIZE_HERO_SELECTION"');
    expect(source).toContain('action: "SELECT_PRODUCT_MEDIA_HERO"');
    expect(source).toContain("Generated Visual Candidates");
    expect(source).toContain('action: "GENERATE_VISUAL_CANDIDATE"');
    expect(source).toContain('action: "REVISE_GENERATED_VISUAL_CANDIDATE"');
    expect(source).not.toContain("/>Hero eligible</label>");
    expect(source).toContain("const resolvedReadiness = campaignMediaPolicy?.readiness ?? payload?.readiness ?? null;");
    expect(source).toContain("NOT USED IN THIS CAMPAIGN");
    expect(source).toContain("Campaign-approved media:");
    expect(source).toContain("Set as Campaign Hero");
    expect(source).toContain("Product Default Hero");
    expect(source).toContain("Campaign Hero: {campaignMediaPolicy.readiness.campaignHeroReady ?? campaignMediaPolicy.readiness.heroAuthorityReady ? \"READY\" : \"NOT READY\"}");
  });
});