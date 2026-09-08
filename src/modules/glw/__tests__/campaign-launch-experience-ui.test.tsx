import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignLaunchConfirmation, CampaignLaunchOutcome, CampaignLaunchProgress, CampaignStatusPanel } from "../CampaignLaunchExperience";
import type { GlwCampaignLaunchRequest, GlwCampaignLaunchResult, GlwCampaignLaunchResultState } from "../campaign-launch-contract";

const target = { canonicalPath: "widget/texas/dallas", stateCode: "TX", citySlug: "dallas", cityName: "Dallas" };
const request: GlwCampaignLaunchRequest = { siteId: "site-1", productId: "product-1", campaignName: "Widget Texas Cities", pagesPerDay: 1, targetClass: "CITY", reach: "STATE", preflightInput: { reach: "STATE", productUrl: "https://example.test/widget", stateCodes: ["TX"] }, selectedBatchSize: 1, selectedTargets: [target], acknowledgedPublicationPolicy: "draft_only" };

function result(state: GlwCampaignLaunchResultState, overrides: Partial<GlwCampaignLaunchResult> = {}): GlwCampaignLaunchResult {
  return { state, launchId: "launch-1", campaignId: state === "AUTHORITY_CHANGED" || state === "TARGET_CONFLICT" ? null : "campaign-1", campaignState: "active", publicationPolicy: "draft_only", selectedTargetCount: 1, targets: [target], referenceTarget: target, referenceState: "reference_complete", dispatchState: "started", recoveryState: null, blockers: [], createdAt: "2030-01-01", ...overrides };
}

describe("Campaign launch experience UI", () => {
  test("renders concise confirmation details and actions", () => {
    const html = renderToStaticMarkup(<CampaignLaunchConfirmation request={request} siteName="Example" productName="Widget" maximumSafeReach={4} onCancel={jest.fn()} onConfirm={jest.fn()} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Launch 1 pages for Widget?");
    expect(html).toContain("Maximum safe reach");
    expect(html).toContain("draft_only");
    expect(html).toContain("Cancel");
    expect(html).toContain("Launch Campaign");
  });

  test.each([
    ["REVALIDATING", "Revalidating campaign..."],
    ["CREATING_CAMPAIGN", "Creating campaign..."],
    ["RESERVING_TARGETS", "Reserving targets..."],
    ["REFERENCE_BOOTSTRAP", "Preparing reference page..."],
    ["STARTING", "Starting campaign..."],
  ] as const)("renders %s progress", (state, copy) => {
    expect(renderToStaticMarkup(<CampaignLaunchProgress state={state} />)).toContain(copy);
  });

  test.each([
    ["DISPATCH_STARTED", "Campaign Started"],
    ["ALREADY_EXISTS", "Existing campaign found"],
    ["REFERENCE_REVIEW_REQUIRED", "Reference page requires review"],
    ["RECOVERY_REQUIRED", "attention required"],
  ] as const)("renders durable %s outcome", (state, copy) => {
    const html = renderToStaticMarkup(<CampaignLaunchOutcome result={result(state)} productName="Widget" reach="STATE" onAnalyzeAgain={jest.fn()} onStartAnother={jest.fn()} />);
    expect(html).toContain(copy);
    expect(html).toContain("campaign-1");
    expect(html).toContain("Start Another Campaign");
  });

  test("renders stale preflight with Analyze Again and no durable campaign", () => {
    const stale = result("AUTHORITY_CHANGED", { blockers: [{ target, code: "AUTHORITY_CHANGED", message: "Dallas is no longer certified safe.", owningCampaignId: null, targetState: null }] });
    const html = renderToStaticMarkup(<CampaignLaunchOutcome result={stale} productName="Widget" reach="STATE" onAnalyzeAgain={jest.fn()} onStartAnother={jest.fn()} />);
    expect(html).toContain("Campaign not launched");
    expect(html).toContain("Preflight changed since analysis");
    expect(html).toContain("Analyze Again");
  });

  test("renders target conflict owner and state without raw persistence", () => {
    const conflict = result("TARGET_CONFLICT", { blockers: [{ target, code: "TARGET_CONFLICT", message: "Dallas is now unavailable.", owningCampaignId: "campaign-owner", targetState: "running" }] });
    const html = renderToStaticMarkup(<CampaignLaunchOutcome result={conflict} productName="Widget" reach="STATE" onAnalyzeAgain={jest.fn()} onStartAnother={jest.fn()} />);
    expect(html).toContain("campaign-owner");
    expect(html).toContain("running");
    expect(html).not.toContain("persistenceIdentity");
  });

  test("renders all compact monitoring slots", () => {
    const html = renderToStaticMarkup(<CampaignStatusPanel counts={{ researching: 2, failed: 1 }} />);
    for (const label of ["researching", "generating", "qa", "draft", "review", "published", "failed"]) expect(html).toContain(label);
  });
});