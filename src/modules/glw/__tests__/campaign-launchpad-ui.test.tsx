import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignLaunchpad, CampaignPreflight } from "../CampaignLaunchpad";
import type { GlwCampaignLaunchpadPreflight } from "../campaign-launchpad";

const preflight: GlwCampaignLaunchpadPreflight = {
  site: { id: "site-1", name: "Example.com" }, product: { id: "product-1", name: "Widget" },
  canonicalProductUrl: "https://example.com/widget", productAuthorityState: "READY", sourceAuthorityState: "READY",
  desiredReach: "NATIONWIDE", existingCoverage: 42, existingCampaignConflicts: 0, duplicateTargetsExcluded: 42,
  cannibalizationConflicts: "UNAVAILABLE", availableEligibleTargets: 58, authorityBlockedTargets: 0,
  potentialReach: 100, recommendedInitialBatch: 25, maximumSafeReach: 58, publicationPolicy: "Draft Only",
  readiness: "READY", blockers: [], targets: [], technicalDetails: { targetAuthority: "AUTHORITATIVE", sourceMode: "PRODUCT_CANONICAL" },
};

describe("Campaign Launchpad UI", () => {
  test("renders the reach-first workflow with nationwide selected and analyze disabled", () => {
    const html = renderToStaticMarkup(<CampaignLaunchpad organizationId="org-1" requestRoles={["operator"]} existingProducts={[{ name: "Widget - Example", url: "https://example.com/widget" }]} />);
    expect(html.indexOf("Desired Reach")).toBeLessThan(html.indexOf("Product"));
    expect(html).toMatch(/checked="" value="NATIONWIDE"|value="NATIONWIDE" checked=""/);
    expect(html).toContain("Analyze Campaign");
    expect(html).toContain("Select existing Genesis product");
    expect(html).toContain("disabled");
  });

  test("renders successful preflight, conflicts, safe reach, policy, and disabled launch", () => {
    const html = renderToStaticMarkup(<CampaignPreflight preflight={preflight} />);
    expect(html).toContain("Maximum safe reach");
    expect(html).toContain("Duplicates excluded");
    expect(html).toContain("Draft Only");
    expect(html).toContain("Launch Campaign");
    expect(html).toContain("disabled");
  });

  test("renders blocked authority and blocker detail", () => {
    const html = renderToStaticMarkup(<CampaignPreflight preflight={{ ...preflight, readiness: "AUTHORITY_REQUIRED", productAuthorityState: "REQUIRES_AUTHORITY", blockers: ["Product authority requires review."] }} />);
    expect(html).toContain("AUTHORITY REQUIRED");
    expect(html).toContain("Product authority requires review.");
  });
});