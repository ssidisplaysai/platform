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
  readinessBlockers: [], targetAssessments: [], excludedTargets: [],
  counts: { potentialCount: 100, existingCoverageCount: 42, executionOwnedCount: 0, campaignOwnedCount: 0, cannibalizationConflictCount: 0, authorityBlockedCount: 0, unreconciledCount: 0, unsupportedCount: 0, maximumSafeReachCount: 58 },
  diagnostics: { exactCanonicalConflictCount: 42, campaignAuthorityAvailable: true, broaderIntentAuthorityAvailable: false },
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
    expect(html).toContain("Execution ownership");
    expect(html).toContain("Campaign ownership");
    expect(html).toContain("Cannibalization conflicts");
    expect(html).toContain("Duplicates excluded");
    expect(html).toContain("Draft Only");
    expect(html).toContain("Excluded Targets (0)");
    expect(html).toContain("Launch Campaign");
    expect(html).toContain("disabled");
  });

  test("enables Launch only when the guarded synthetic capability and batch are present", () => {
    const html = renderToStaticMarkup(<CampaignPreflight preflight={preflight} selectedBatchSize={25} launchAvailable onLaunch={jest.fn()} />);
    expect(html).toMatch(/<button[^>]*>Launch Campaign<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Launch Campaign<\/button>/);
  });

  test("renders blocked authority and blocker detail", () => {
    const html = renderToStaticMarkup(<CampaignPreflight preflight={{ ...preflight, readiness: "AUTHORITY_REQUIRED", productAuthorityState: "REQUIRES_AUTHORITY", blockers: ["Product authority requires review."], readinessBlockers: [
      { code: "PRODUCT_DISABLED", scope: "PRODUCT", severity: "BLOCKING", message: "Product authority requires review.", authoritySource: "PRODUCT_READINESS", repairableByExistingWorkflow: true },
      { code: "CAMPAIGN_AUTHORITY_MISSING", scope: "CAMPAIGN", severity: "BLOCKING", message: "Campaign authority unavailable.", authoritySource: "CAMPAIGN_PERSISTENCE", repairableByExistingWorkflow: null },
      { code: "TARGET_EXECUTION_UNRECONCILED", scope: "TARGET", severity: "BLOCKING", message: "Target execution unreconciled.", authoritySource: "GLW_PAGE_EXECUTION_JOURNAL", repairableByExistingWorkflow: null },
      { code: "CANNIBALIZATION_AUTHORITY_UNAVAILABLE", scope: "CANNIBALIZATION", severity: "BLOCKING", message: "Cannibalization authority unavailable.", authoritySource: "GLW_CANONICAL_PLANNING", repairableByExistingWorkflow: null },
    ] }} />);
    expect(html).toContain("AUTHORITY REQUIRED");
    expect(html).toContain("Product authority requires review.");
    expect(html).toContain("Campaign authority unavailable.");
    expect(html).toContain("Target execution unreconciled.");
    expect(html).toContain("Cannibalization authority unavailable.");
  });

  test("renders grouped exclusions and disables all sizes for zero safe reach", () => {
    const html = renderToStaticMarkup(<CampaignPreflight preflight={{
      ...preflight,
      maximumSafeReach: 0,
      recommendedInitialBatch: 0,
      excludedTargets: [{ target: "Dallas, Texas", canonicalPath: "widget/texas/dallas", group: "EXECUTION_OWNED", reason: "Active execution owns target.", existingOwner: null, jobId: "job-1", executionId: "execution-1", campaignId: null }],
      counts: { ...preflight.counts, executionOwnedCount: 1, maximumSafeReachCount: 0 },
    }} />);
    expect(html).toContain("Excluded Targets (1)");
    expect(html).toContain("Owned by Execution (1)");
    expect(html).toContain("Job: job-1");
    expect(html).not.toContain("Campaign: job-1");
    expect(html).toContain("Recommended Launch (0)");
    expect(html).toContain('aria-label="Custom campaign size"');
    expect(html).toContain("disabled");
  });
});