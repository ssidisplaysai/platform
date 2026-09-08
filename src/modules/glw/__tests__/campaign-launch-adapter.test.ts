import {
  createAtomicRuntimeCampaignLaunchAdapter,
  createDisabledCampaignLaunchAdapter,
  createSyntheticCampaignLaunchAdapter,
} from "../campaign-launch-adapter";
import { resolveGlwLaunchExecutionCapability } from "../campaign-launch-capability";
import { presentGlwLaunchResult, type GlwCampaignLaunchRequest } from "../campaign-launch-contract";

const request: GlwCampaignLaunchRequest = {
  launchId: "launch-1",
  siteId: "site-1",
  productId: "product-1",
  reach: "STATE",
  productUrl: "https://example.test/widget",
  selectedBatchSize: 1,
  selectedTargets: [{ canonicalPath: "widget/texas/dallas", stateCode: "TX", citySlug: "dallas", cityName: "Dallas" }],
  acknowledgedPublicationPolicy: "Draft Only",
};

describe("Campaign Launchpad launch adapters", () => {
  test("production cannot enable the synthetic launch capability", () => {
    expect(resolveGlwLaunchExecutionCapability({ nodeEnvironment: "production", syntheticFlag: "true" })).toBe(false);
    expect(resolveGlwLaunchExecutionCapability({ nodeEnvironment: "development", syntheticFlag: undefined })).toBe(false);
    expect(resolveGlwLaunchExecutionCapability({ nodeEnvironment: "development", syntheticFlag: "true" })).toBe(true);
  });

  test("production and future runtime adapters remain disabled and perform no fetch", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    await expect(createDisabledCampaignLaunchAdapter().launch(request, jest.fn())).rejects.toThrow("unavailable");
    await expect(createAtomicRuntimeCampaignLaunchAdapter().launch(request, jest.fn())).rejects.toThrow("not connected");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("synthetic success emits the complete ordered progress sequence", async () => {
    const progress: string[] = [];
    const result = await createSyntheticCampaignLaunchAdapter({ scenario: "SUCCESS" }).launch(request, (state) => progress.push(state));
    expect(progress).toEqual(["REVALIDATING", "CREATING_CAMPAIGN", "RESERVING_TARGETS", "REFERENCE_BOOTSTRAP", "STARTING"]);
    expect(result).toMatchObject({ state: "DISPATCH_STARTED", campaignId: "campaign-synthetic-launch-1", selectedTargetCount: 1, publicationPolicy: "Draft Only" });
    expect(presentGlwLaunchResult(result)).toMatchObject({ uiState: "SUCCESS", heading: "Campaign Started", durable: true });
  });

  test.each([
    ["STALE_PREFLIGHT", "AUTHORITY_CHANGED", "Preflight changed since analysis.", false],
    ["TARGET_CONFLICT", "TARGET_CONFLICT", "One or more targets became unavailable.", false],
    ["ALREADY_EXISTS", "ALREADY_EXISTS", "The existing campaign was returned", true],
    ["REFERENCE_REVIEW_REQUIRED", "REFERENCE_REVIEW_REQUIRED", "Reference page requires review.", true],
    ["RECOVERY_REQUIRED", "RECOVERY_REQUIRED", "requires recovery", true],
    ["DISPATCH_FAILED", "RECOVERY_REQUIRED", "requires recovery", true],
  ] as const)("maps %s to durable result semantics", async (scenario, state, message, durable) => {
    const result = await createSyntheticCampaignLaunchAdapter({ scenario }).launch(request, jest.fn());
    expect(result.state).toBe(state);
    expect(presentGlwLaunchResult(result)).toMatchObject({ message: expect.stringContaining(message), durable });
  });

  test("does not allow publication-policy escalation inside the adapter", async () => {
    const result = await createSyntheticCampaignLaunchAdapter({ scenario: "SUCCESS" }).launch(request, jest.fn());
    expect(result.publicationPolicy).toBe(request.acknowledgedPublicationPolicy);
  });

  test("suppresses a concurrent second launch", async () => {
    let release!: () => void;
    const adapter = createSyntheticCampaignLaunchAdapter({ scenario: "SUCCESS", delay: () => new Promise<void>((resolve) => { release = resolve; }) });
    const first = adapter.launch(request, jest.fn());
    await expect(adapter.launch(request, jest.fn())).rejects.toThrow("already in progress");
    for (let index = 0; index < 5; index += 1) {
      release();
      await Promise.resolve();
    }
    await first;
  });
});