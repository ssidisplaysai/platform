import {
  createAtomicRuntimeCampaignLaunchAdapter,
  createConfiguredAtomicRuntimeCampaignLaunchAdapter,
  createDisabledCampaignLaunchAdapter,
  createSyntheticCampaignLaunchAdapter,
  mapAtomicRuntimeLaunchResult,
} from "../campaign-launch-adapter";
import { resolveGlwAtomicLaunchExecutionCapability, resolveGlwCampaignLaunchPromotion, resolveGlwLaunchExecutionCapability } from "../campaign-launch-capability";
import { presentGlwLaunchResult, type GlwCampaignLaunchRequest } from "../campaign-launch-contract";
import type { GlwCampaignLaunchpadPreflight } from "../campaign-launchpad";

const target = { canonicalPath: "widget/texas/dallas", stateCode: "TX", citySlug: "dallas", cityName: "Dallas" };
const request: GlwCampaignLaunchRequest = {
  siteId: "site-1", productId: "product-1", campaignName: "Widget Texas Cities", pagesPerDay: 1, targetClass: "CITY", reach: "STATE",
  preflightInput: { reach: "STATE", productUrl: "https://example.test/widget", stateCodes: ["TX"] }, selectedBatchSize: 1,
  selectedTargets: [target], acknowledgedPublicationPolicy: "draft_only",
};

function currentPreflight(overrides: Partial<GlwCampaignLaunchpadPreflight> = {}): GlwCampaignLaunchpadPreflight {
  return {
    site: { id: "site-1", name: "Example" }, product: { id: "product-1", name: "Widget" }, canonicalProductUrl: "https://example.test/widget",
    productAuthorityState: "READY", sourceAuthorityState: "READY", desiredReach: "STATE", existingCoverage: 0, existingCampaignConflicts: 0,
    duplicateTargetsExcluded: 0, cannibalizationConflicts: 0, availableEligibleTargets: 1, authorityBlockedTargets: 0, potentialReach: 1,
    recommendedInitialBatch: 1, maximumSafeReach: 1, publicationPolicy: "draft_only", readiness: "READY", blockers: [], readinessBlockers: [],
    targets: [target], targetAssessments: [{ ...target, stateName: "Texas", canonicalState: "AVAILABLE", siteReadiness: "READY", productReadiness: "READY", sourceReadiness: "READY", executionOwnership: {} as never, campaignOwnership: {} as never, cannibalization: {} as never, primaryDisposition: "SAFE", blockers: [], safe: true }],
    excludedTargets: [], counts: { potentialCount: 1, existingCoverageCount: 0, executionOwnedCount: 0, campaignOwnedCount: 0, cannibalizationConflictCount: 0, authorityBlockedCount: 0, unreconciledCount: 0, unsupportedCount: 0, maximumSafeReachCount: 1 },
    diagnostics: { exactCanonicalConflictCount: 0, campaignAuthorityAvailable: true, broaderIntentAuthorityAvailable: true }, technicalDetails: { targetAuthority: "AUTHORITATIVE", sourceMode: "PRODUCT_CANONICAL" },
    ...overrides,
  };
}

function response(value: unknown, ok = true) { return { ok, json: async () => value }; }

const created = {
  state: "REFERENCE_GENERATION_REQUIRED",
  launch: { launchId: "launch-runtime", campaignId: "campaign-runtime", state: "REFERENCE_PENDING", publicationPolicy: "draft_only", dispatchState: "NOT_STARTED", recoveryReason: null, createdAt: "2030-01-01" },
  campaign: { campaignId: "campaign-runtime", status: "draft", publicationPolicy: "draft_only" },
  referenceBootstrap: { target: { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" }, state: "REFERENCE_PENDING", approvalRequired: true },
  conflicts: [], publicationPerformed: false, dispatchPerformed: false,
};

describe("Campaign Launchpad launch adapters", () => {
  test("production cannot enable synthetic or atomic execution", () => {
    expect(resolveGlwLaunchExecutionCapability({ nodeEnvironment: "production", syntheticFlag: "true" })).toBe(false);
    expect(resolveGlwAtomicLaunchExecutionCapability({ nodeEnvironment: "production", atomicFlag: "true" })).toBe(false);
    expect(resolveGlwAtomicLaunchExecutionCapability({ nodeEnvironment: "development", atomicFlag: "true" })).toBe(true);
  });

  test.each([
    [{}, "DISABLED"],
    [{ productionEnabled: "false" }, "DISABLED"],
    [{ productionEnabled: "yes" }, "CONFIGURATION_INVALID"],
    [{ productionEnabled: "true" }, "CONFIGURATION_INVALID"],
    [{ productionEnabled: "true", certifiedRelease: "latest", runningRelease: "a".repeat(40) }, "CONFIGURATION_INVALID"],
    [{ productionEnabled: "true", certifiedRelease: "a".repeat(40) }, "UNAVAILABLE"],
    [{ productionEnabled: "true", certifiedRelease: "a".repeat(40), runningRelease: "b".repeat(40) }, "RELEASE_MISMATCH"],
  ])("fails closed for production promotion %#", (values, state) => {
    expect(resolveGlwCampaignLaunchPromotion({ nodeEnvironment: "production", ...values })).toMatchObject({ available: false, state });
  });

  test("enables only an exact certified production release", () => {
    const release = "4".repeat(40);
    expect(resolveGlwCampaignLaunchPromotion({ nodeEnvironment: "production", productionEnabled: "true", certifiedRelease: release, runningRelease: release })).toEqual({
      available: true,
      state: "ENABLED_CERTIFIED_RELEASE",
      reason: "Campaign Launch is available for this certified production release.",
      runningRelease: release,
      certifiedRelease: release,
    });
  });

  test("disabled adapters perform no fetch", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    await expect(createDisabledCampaignLaunchAdapter().launch(request, jest.fn())).rejects.toThrow("unavailable");
    await expect(createAtomicRuntimeCampaignLaunchAdapter().launch(request, jest.fn())).rejects.toThrow("not connected");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("revalidates then sends only the certified atomic request shape", async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(response({ preflight: currentPreflight() })).mockResolvedValueOnce(response(created));
    const progress: string[] = [];
    const result = await createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-1", requestRoles: ["admin"], fetchImpl }).launch(request, (state) => progress.push(state));
    expect(progress).toEqual(["REVALIDATING", "RESERVING_TARGETS", "REFERENCE_BOOTSTRAP"]);
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual(["/api/glw/campaign-launchpad/preflight", "/api/glw/campaign-launch"]);
    const launchBody = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    expect(launchBody).toEqual({ operation: "LAUNCH_CITY_CAMPAIGN", siteId: "site-1", productId: "product-1", name: "Widget Texas Cities", pagesPerDay: 1, publicationPolicyAcknowledgement: "draft_only", targets: [{ stateCode: "TX", citySlug: "dallas", cityName: "Dallas" }] });
    expect(launchBody).not.toHaveProperty("launchId");
    expect(launchBody).not.toHaveProperty("safe");
    expect(launchBody).not.toHaveProperty("campaignId");
    expect(result).toMatchObject({ state: "CAMPAIGN_CREATED", launchId: "launch-runtime", campaignId: "campaign-runtime", referenceState: "REFERENCE_PENDING", publicationPolicy: "draft_only" });
  });

  test("stale revalidation returns authority changed without calling launch", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ preflight: currentPreflight({ readiness: "TARGET_CONFLICTS", maximumSafeReach: 0, targetAssessments: [] }) }));
    const result = await createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-1", requestRoles: ["admin"], fetchImpl }).launch(request, jest.fn());
    expect(result.state).toBe("AUTHORITY_CHANGED");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("maps all-or-nothing target conflict with owning campaign", () => {
    const result = mapAtomicRuntimeLaunchResult(request, { state: "TARGET_CONFLICT", conflicts: [{ globalTargetKey: "org::site-1::product-1::city_service::TX::dallas", campaignId: "campaign-owner", state: "OWNED" }] });
    expect(result).toMatchObject({ state: "TARGET_CONFLICT", campaignId: null, blockers: [{ owningCampaignId: "campaign-owner", targetState: "OWNED" }] });
    expect(presentGlwLaunchResult(result).message).toContain("No new cohort was partially reserved");
  });

  test.each([
    [{ ...created, state: "ALREADY_EXISTS" }, "ALREADY_EXISTS", "campaign-runtime"],
    [{ ...created, state: "ALREADY_EXISTS", launch: { ...created.launch, state: "REFERENCE_REVIEW_REQUIRED" } }, "ALREADY_EXISTS", "campaign-runtime"],
    [{ ...created, state: "RECOVERY_REQUIRED", launch: { ...created.launch, state: "REFERENCE_FAILED_RECOVERABLE", recoveryReason: "QA failed" } }, "RECOVERY_REQUIRED", "campaign-runtime"],
    [{ error: "Existing campaign policy authority is missing or conflicted.", code: "AUTHORITY_CHANGED" }, "AUTHORITY_CHANGED", null],
  ])("maps durable runtime response %#", (runtime, state, campaignId) => {
    expect(mapAtomicRuntimeLaunchResult(request, runtime)).toMatchObject({ state, campaignId });
  });

  test("does not claim reference bootstrap for an idempotent existing campaign", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(response({ preflight: currentPreflight() }))
      .mockResolvedValueOnce(response({ ...created, state: "ALREADY_EXISTS" }));
    const progress: string[] = [];
    const result = await createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-1", requestRoles: ["admin"], fetchImpl })
      .launch(request, (state) => progress.push(state));
    expect(result.state).toBe("ALREADY_EXISTS");
    expect(progress).toEqual(["REVALIDATING", "RESERVING_TARGETS"]);
  });

  test("rejects unsupported target classes before any request", async () => {
    const fetchImpl = jest.fn();
    const adapter = createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-1", requestRoles: ["admin"], fetchImpl });
    await expect(adapter.launch({ ...request, targetClass: "STATE" }, jest.fn())).rejects.toThrow("CITY targets only");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("suppresses a concurrent duplicate submission", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    const fetchImpl = jest.fn(() => new Promise<ReturnType<typeof response>>((resolve) => { release = resolve; }));
    const adapter = createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "org-1", requestRoles: ["admin"], fetchImpl });
    const first = adapter.launch(request, jest.fn());
    await expect(adapter.launch(request, jest.fn())).rejects.toThrow("already in progress");
    release(response({ preflight: currentPreflight({ readiness: "TARGET_CONFLICTS" }) }));
    await first;
  });

  test("synthetic fixtures remain isolated from client launch identity", async () => {
    const result = await createSyntheticCampaignLaunchAdapter({ scenario: "SUCCESS" }).launch(request, jest.fn());
    expect(result).toMatchObject({ state: "DISPATCH_STARTED", campaignId: "campaign-synthetic-fixture", publicationPolicy: "draft_only" });
  });
});
