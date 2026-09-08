jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfiguredAtomicRuntimeCampaignLaunchAdapter } from "../campaign-launch-adapter";
import { launchGlwCityCampaign, listGlwGlobalTargetOwnership, resetGlwCampaignLaunchAuthorityForTests } from "../campaign-launch-authority";
import type { GlwCampaignLaunchRequest } from "../campaign-launch-contract";
import type { GlwCampaignLaunchpadPreflight } from "../campaign-launchpad";
import type { GlwCampaign, NewGlwCampaignInput } from "../campaign-types";

const dallas = { canonicalPath: "widget/texas/dallas", stateCode: "TX", citySlug: "dallas", cityName: "Dallas" };
const austin = { canonicalPath: "widget/texas/austin", stateCode: "TX", citySlug: "austin", cityName: "Austin" };
const houston = { canonicalPath: "widget/texas/houston", stateCode: "TX", citySlug: "houston", cityName: "Houston" };
let persistenceDirectory = "";

beforeEach(() => {
  persistenceDirectory = mkdtempSync(join(tmpdir(), "glw-launchpad-canary-"));
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR = persistenceDirectory;
  resetGlwCampaignLaunchAuthorityForTests();
});

afterEach(() => {
  rmSync(persistenceDirectory, { recursive: true, force: true });
  delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
});

function request(name: string, targets = [dallas, austin]): GlwCampaignLaunchRequest {
  return {
    siteId: "site-canary", productId: "product-canary", campaignName: name, pagesPerDay: targets.length, targetClass: "CITY", reach: "STATE",
    preflightInput: { reach: "STATE", productUrl: "https://canary.example/widget", stateCodes: ["TX"] }, selectedBatchSize: targets.length,
    selectedTargets: targets, acknowledgedPublicationPolicy: "draft_only",
  };
}

function preflight(targets: GlwCampaignLaunchRequest["selectedTargets"]): GlwCampaignLaunchpadPreflight {
  return {
    site: { id: "site-canary", name: "Canary" }, product: { id: "product-canary", name: "Widget" }, canonicalProductUrl: "https://canary.example/widget",
    productAuthorityState: "READY", sourceAuthorityState: "READY", desiredReach: "STATE", existingCoverage: 0, existingCampaignConflicts: 0,
    duplicateTargetsExcluded: 0, cannibalizationConflicts: 0, availableEligibleTargets: targets.length, authorityBlockedTargets: 0, potentialReach: targets.length,
    recommendedInitialBatch: targets.length, maximumSafeReach: targets.length, publicationPolicy: "draft_only", readiness: "READY", blockers: [], readinessBlockers: [], targets,
    targetAssessments: targets.map((target) => ({ ...target, stateName: "Texas", canonicalState: "ABSENT", siteReadiness: "READY" as const, productReadiness: "READY" as const, sourceReadiness: "READY" as const, executionOwnership: {} as never, campaignOwnership: {} as never, cannibalization: {} as never, primaryDisposition: "SAFE" as const, blockers: [], safe: true })),
    excludedTargets: [], counts: { potentialCount: targets.length, existingCoverageCount: 0, executionOwnedCount: 0, campaignOwnedCount: 0, cannibalizationConflictCount: 0, authorityBlockedCount: 0, unreconciledCount: 0, unsupportedCount: 0, maximumSafeReachCount: targets.length },
    diagnostics: { exactCanonicalConflictCount: 0, campaignAuthorityAvailable: true, broaderIntentAuthorityAvailable: true }, technicalDetails: { targetAuthority: "AUTHORITATIVE", sourceMode: "PRODUCT_CANONICAL" },
  };
}

function campaignId(input: NewGlwCampaignInput): string {
  return `campaign-${input.organizationId}-${input.siteId}-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

describe("Launchpad V3 isolated atomic canary", () => {
  test("creates one exact durable cohort, resolves retry idempotently, and rejects overlapping launch without partial ownership", async () => {
    const campaigns: GlwCampaign[] = [];
    const observedUrls: string[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      observedUrls.push(url);
      const body = JSON.parse(String(init.body));
      if (url.endsWith("/preflight")) {
        const selected = body.productUrl.includes("overlap") ? [austin, houston] : [dallas, austin];
        return { ok: true, json: async () => ({ preflight: preflight(selected) }) };
      }
      const campaignInput: NewGlwCampaignInput = {
        organizationId: "org-canary", siteId: body.siteId, productId: body.productId, name: body.name, pageType: "city_service",
        stateCodes: [...new Set<string>(body.targets.map((target: { stateCode: string }) => target.stateCode))], cityTargets: body.targets,
        pagesPerDay: body.pagesPerDay, publicationPolicy: "draft_only", imageRequired: true,
      };
      const runtime = launchGlwCityCampaign({ campaignInput, authoritativePublicationPolicy: "draft_only", publicationPolicyAcknowledgement: body.publicationPolicyAcknowledgement }, {
        listCampaigns: () => campaigns,
        listTargets: () => [],
        createCampaignId: campaignId,
        createCampaign: (value) => {
          const timestamp = "2030-01-01T00:00:00.000Z";
          const campaign: GlwCampaign = { ...value, campaignId: campaignId(value), status: "draft", completedTargetCount: 0, failedTargetCount: 0, createdAt: timestamp, updatedAt: timestamp };
          campaigns.push(campaign);
          return { campaign, errors: [] };
        },
      });
      return { ok: !["TARGET_CONFLICT", "HISTORICAL_OWNERSHIP_CONFLICT"].includes(runtime.state), json: async () => ({ ...runtime, referenceBootstrap: runtime.launch ? { target: runtime.launch.referenceTarget, state: runtime.launch.state, approvalRequired: true } : null, publicationPerformed: false, dispatchPerformed: false }) };
    };
    const adapter = createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-canary", requestRoles: ["admin"], fetchImpl });

    const first = await adapter.launch(request("Canary A"), jest.fn());
    expect(first).toMatchObject({ state: "CAMPAIGN_CREATED", campaignState: "draft", referenceState: "REFERENCE_PENDING", selectedTargetCount: 2 });
    expect(campaigns).toHaveLength(1);
    expect(listGlwGlobalTargetOwnership().map((entry) => `${entry.identity.stateCode}::${entry.identity.citySlug}`).sort()).toEqual(["TX::austin", "TX::dallas"]);

    const retry = await adapter.launch(request("Renamed retry"), jest.fn());
    expect(retry).toMatchObject({ state: "ALREADY_EXISTS", campaignId: first.campaignId, launchId: first.launchId });
    expect(campaigns).toHaveLength(1);

    const overlappingRequest = { ...request("Canary B", [austin, houston]), preflightInput: { reach: "STATE" as const, productUrl: "https://canary.example/widget-overlap", stateCodes: ["TX"] } };
    const conflict = await adapter.launch(overlappingRequest, jest.fn());
    expect(conflict).toMatchObject({ state: "TARGET_CONFLICT", campaignId: null });
    expect(campaigns).toHaveLength(1);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(2);
    expect(listGlwGlobalTargetOwnership().some((entry) => entry.identity.citySlug === "houston")).toBe(false);
    expect(observedUrls.filter((url) => url === "/api/glw/campaign-launch")).toHaveLength(3);
    expect(persistenceDirectory).toContain("glw-launchpad-canary-");
  });
});
