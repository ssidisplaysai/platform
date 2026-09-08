jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGlwCampaignLaunchId,
  createGlwGlobalCityTargetKey,
  getGlwCampaignLaunchByCampaignId,
  launchGlwCityCampaign,
  listGlwGlobalTargetOwnership,
  normalizeGlwGlobalCityTargetIdentity,
  previewGlwGlobalOwnershipReconciliation,
  reconcileGlwGlobalTargetOwnership,
  recordGlwCampaignLaunchActivated,
  recordGlwCampaignLaunchDispatch,
  recordGlwCampaignLaunchReferenceFailure,
  recordGlwCampaignLaunchReferenceReviewRequired,
  recordGlwCampaignLaunchReferenceStarted,
  resetGlwCampaignLaunchAuthorityForTests,
} from "../campaign-launch-authority";
import type { GlwCampaign, NewGlwCampaignInput } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";

let persistenceDir = "";

beforeEach(() => {
  persistenceDir = mkdtempSync(join(tmpdir(), "glw-launch-authority-"));
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR = persistenceDir;
  resetGlwCampaignLaunchAuthorityForTests();
});

afterEach(() => {
  rmSync(persistenceDir, { recursive: true, force: true });
  delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
});

const cities = [
  { stateCode: "CA", citySlug: "los-angeles", cityName: "Los Angeles" },
  { stateCode: "CA", citySlug: "san-diego", cityName: "San Diego" },
  { stateCode: "CA", citySlug: "san-jose", cityName: "San Jose" },
];

function input(overrides: Partial<NewGlwCampaignInput> = {}): NewGlwCampaignInput {
  return {
    organizationId: "ssi",
    siteId: "site-1",
    productId: "product-1",
    name: "California Cities",
    pageType: "city_service",
    stateCodes: ["CA"],
    cityTargets: cities,
    pagesPerDay: 3,
    publicationPolicy: "draft_only",
    imageRequired: true,
    ...overrides,
  };
}

function campaignFrom(value: NewGlwCampaignInput, campaignId = campaignIdFor(value)): GlwCampaign {
  const timestamp = "2026-09-08T00:00:00.000Z";
  return { ...value, campaignId, status: "draft", completedTargetCount: 0, failedTargetCount: 0, createdAt: timestamp, updatedAt: timestamp };
}

function campaignIdFor(value: NewGlwCampaignInput): string {
  return `campaign-${value.organizationId}-${value.siteId}-${value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function target(campaign: GlwCampaign, citySlug: string, status: GlwCampaignTarget["status"] = "published"): GlwCampaignTarget {
  const city = campaign.cityTargets!.find((entry) => entry.citySlug === citySlug)!;
  return { targetId: `target-${campaign.campaignId}-${citySlug}`, campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, stateCode: city.stateCode, citySlug, cityName: city.cityName, status, jobId: "job", wordpressObjectId: status === "failed" ? null : "100", attemptCount: 1, lastError: status === "failed" ? "quarantined" : null, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" };
}

function dependencies(initialCampaigns: GlwCampaign[] = [], initialTargets: GlwCampaignTarget[] = [], patch: { failCreation?: boolean; afterCampaignCreated?: (campaign: GlwCampaign) => void; beforeReservationFinalized?: (campaign: GlwCampaign) => void } = {}) {
  const campaigns = [...initialCampaigns];
  return {
    campaigns,
    targets: [...initialTargets],
    deps: {
      listCampaigns: () => campaigns,
      listTargets: () => initialTargets,
      createCampaignId: campaignIdFor,
      createCampaign: (value: NewGlwCampaignInput) => {
        if (patch.failCreation) return { campaign: null, errors: ["injected creation failure"] };
        const campaign = campaignFrom(value);
        campaigns.push(campaign);
        return { campaign, errors: [] };
      },
      afterCampaignCreated: patch.afterCampaignCreated,
      beforeReservationFinalized: patch.beforeReservationFinalized,
    },
  };
}

function launch(value: NewGlwCampaignInput, deps: ReturnType<typeof dependencies>["deps"], acknowledgement = value.publicationPolicy) {
  return launchGlwCityCampaign({ campaignInput: value, authoritativePublicationPolicy: value.publicationPolicy, publicationPolicyAcknowledgement: acknowledgement }, deps);
}

describe("GLW atomic campaign launch authority", () => {
  test("normalizes deterministic global city identity independently of campaign name", () => {
    const identity = normalizeGlwGlobalCityTargetIdentity({ organizationId: " SSI ", siteId: "SITE-1", productId: "Product-1", pageType: "city_service", stateCode: "ca", citySlug: " San Jose ", cityName: "San Jose" });
    expect(createGlwGlobalCityTargetKey(identity)).toBe("ssi::site-1::product-1::city_service::CA::san-jose");
    const first = createGlwCampaignLaunchId({ organizationId: "ssi", siteId: "site-1", productId: "product-1", pageType: "city_service", publicationPolicy: "draft_only", targets: [identity] });
    const second = createGlwCampaignLaunchId({ organizationId: "SSI", siteId: "SITE-1", productId: "PRODUCT-1", pageType: "city_service", publicationPolicy: "draft_only", targets: [identity] });
    expect(first).toBe(second);
  });

  test("reconstructs existing city ownership and detects historical duplicates", () => {
    const firstCampaign = campaignFrom(input(), "campaign-existing-a");
    const clean = previewGlwGlobalOwnershipReconciliation({ campaigns: [firstCampaign], targets: [target(firstCampaign, "los-angeles")] });
    expect(clean).toMatchObject({ conflicts: [] });
    expect(reconcileGlwGlobalTargetOwnership({ campaigns: [firstCampaign], targets: [target(firstCampaign, "los-angeles")] }).ownershipCount).toBe(1);
    expect(listGlwGlobalTargetOwnership()[0]).toMatchObject({ campaignId: "campaign-existing-a", state: "OWNED" });

    const secondCampaign = campaignFrom(input({ name: "Other" }), "campaign-existing-b");
    const conflict = previewGlwGlobalOwnershipReconciliation({ campaigns: [firstCampaign, secondCampaign], targets: [target(firstCampaign, "los-angeles"), target(secondCampaign, "los-angeles")] });
    expect(conflict.conflicts).toEqual([{ globalTargetKey: expect.stringContaining("los-angeles"), campaignIds: ["campaign-existing-a", "campaign-existing-b"] }]);
  });

  test("reserves a complete cohort and creates one durable reference-pending campaign", () => {
    const runtime = dependencies();
    const result = launch(input(), runtime.deps);
    expect(result).toMatchObject({ state: "REFERENCE_GENERATION_REQUIRED", campaign: { status: "draft", publicationPolicy: "draft_only" }, launch: { state: "REFERENCE_PENDING" } });
    expect(listGlwGlobalTargetOwnership()).toHaveLength(3);
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.state === "RESERVED" && entry.campaignId === result.campaign!.campaignId)).toBe(true);
    expect(result.launch?.referenceTarget.citySlug).toBe("los-angeles");
  });

  test("one conflict prevents every reservation and campaign creation", () => {
    const existing = campaignFrom(input(), "campaign-existing");
    const runtime = dependencies([existing], [target(existing, "san-jose")]);
    const result = launch(input(), runtime.deps);
    expect(result.state).toBe("TARGET_CONFLICT");
    expect(result.conflicts[0].globalTargetKey).toContain("san-jose");
    expect(runtime.campaigns).toHaveLength(1);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(0);
  });

  test("same geography remains available to a different product or site", () => {
    const runtime = dependencies();
    expect(launch(input(), runtime.deps).state).toBe("REFERENCE_GENERATION_REQUIRED");
    expect(launch(input({ productId: "product-2", name: "Product Two" }), runtime.deps).state).toBe("REFERENCE_GENERATION_REQUIRED");
    expect(launch(input({ siteId: "site-2", name: "Site Two" }), runtime.deps).state).toBe("REFERENCE_GENERATION_REQUIRED");
    expect(listGlwGlobalTargetOwnership()).toHaveLength(9);
  });

  test("failed historical targets retain ownership", () => {
    const existing = campaignFrom(input(), "campaign-existing");
    const runtime = dependencies([existing], [target(existing, "san-jose", "failed")]);
    expect(launch(input(), runtime.deps).state).toBe("TARGET_CONFLICT");
  });

  test("overlapping concurrent launches allow one winner and no loser partial reservations", async () => {
    const runtime = dependencies();
    const launchA = input({ name: "A", cityTargets: cities.slice(0, 2) });
    const launchB = input({ name: "B", cityTargets: cities.slice(1) });
    const [a, b] = await Promise.all([Promise.resolve().then(() => launch(launchA, runtime.deps)), Promise.resolve().then(() => launch(launchB, runtime.deps))]);
    expect([a.state, b.state].sort()).toEqual(["REFERENCE_GENERATION_REQUIRED", "TARGET_CONFLICT"]);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(2);
    const winner = a.state === "REFERENCE_GENERATION_REQUIRED" ? a : b;
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.launchId === winner.launch?.launchId)).toBe(true);
  });

  test("serializes actual concurrent process reservations without partial loser ownership", async () => {
    const fixture = join("src/modules/glw/__tests__/fixtures/campaign-launch-concurrent-worker.mts");
    const run = (name: string, targets: typeof cities) => new Promise<{ state: string; ownership: string[] }>((resolve, reject) => {
      const workerEnvironment = { ...process.env, GCP_FOUNDATION_PERSISTENCE_DIR: persistenceDir, GLW_TEST_LAUNCH_NAME: name, GLW_TEST_CITY_TARGETS: JSON.stringify(targets) };
      const child = process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", `npx --yes tsx ${fixture}`], { env: workerEnvironment, stdio: ["ignore", "pipe", "pipe"] })
        : spawn("npx", ["--yes", "tsx", fixture], { env: workerEnvironment, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve(JSON.parse(stdout.trim())) : reject(new Error(stderr || `worker exited ${code}`)));
    });
    const [a, b] = await Promise.all([run("A", cities.slice(0, 2)), run("B", cities.slice(1))]);
    expect([a.state, b.state].sort()).toEqual(["REFERENCE_GENERATION_REQUIRED", "TARGET_CONFLICT"]);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(2);
  }, 30_000);

  test("identical and renamed retries return the same campaign", () => {
    const runtime = dependencies();
    const first = launch(input(), runtime.deps);
    const retry = launch(input(), runtime.deps);
    const renamed = launch(input({ name: "Renamed by client" }), runtime.deps);
    expect(retry).toMatchObject({ state: "ALREADY_EXISTS", campaign: { campaignId: first.campaign?.campaignId } });
    expect(renamed).toMatchObject({ state: "ALREADY_EXISTS", campaign: { campaignId: first.campaign?.campaignId } });
    expect(runtime.campaigns).toHaveLength(1);
  });

  test("recovers a lost response after campaign persistence without duplication", () => {
    let throwOnce = true;
    const runtime = dependencies([], [], { afterCampaignCreated: () => { if (throwOnce) { throwOnce = false; throw new Error("response lost"); } } });
    const result = launch(input(), runtime.deps);
    expect(result).toMatchObject({ state: "REFERENCE_GENERATION_REQUIRED", launch: { state: "REFERENCE_PENDING" } });
    expect(runtime.campaigns).toHaveLength(1);
    expect(launch(input(), runtime.deps).campaign?.campaignId).toBe(result.campaign?.campaignId);
  });

  test("atomically heals reservations after interruption between campaign persistence and journal finalization", () => {
    let interruptOnce = true;
    const runtime = dependencies([], [], { beforeReservationFinalized: () => { if (interruptOnce) { interruptOnce = false; throw new Error("injected finalization interruption"); } } });
    expect(() => launch(input(), runtime.deps)).toThrow("injected finalization interruption");
    expect(runtime.campaigns).toHaveLength(1);
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.state === "RESERVED" && entry.campaignId === null)).toBe(true);

    const recovered = launch(input({ name: "Renamed retry" }), runtime.deps);
    expect(recovered).toMatchObject({ state: "REFERENCE_GENERATION_REQUIRED", launch: { state: "REFERENCE_PENDING" } });
    expect(runtime.campaigns).toHaveLength(1);
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.campaignId === recovered.campaign?.campaignId)).toBe(true);
  });

  test("compensates reservations when campaign creation fails and permits exact retry", () => {
    const failedRuntime = dependencies([], [], { failCreation: true });
    expect(launch(input(), failedRuntime.deps).state).toBe("COMPENSATED");
    expect(listGlwGlobalTargetOwnership()).toHaveLength(0);
    const recoveredRuntime = dependencies();
    expect(launch(input(), recoveredRuntime.deps).state).toBe("REFERENCE_GENERATION_REQUIRED");
    expect(listGlwGlobalTargetOwnership()).toHaveLength(3);
  });

  test("rejects publication policy escalation", () => {
    const runtime = dependencies();
    expect(() => launch(input(), runtime.deps, "publish_after_gates")).toThrow("GLW_LAUNCH_PUBLICATION_POLICY_ESCALATION");
    expect(runtime.campaigns).toHaveLength(0);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(0);
  });

  test("preserves reference review and recoverable reference failure on the same campaign", () => {
    const runtime = dependencies();
    const created = launch(input(), runtime.deps);
    const campaignId = created.campaign!.campaignId;
    expect(recordGlwCampaignLaunchReferenceStarted(campaignId, "job-reference")?.state).toBe("REFERENCE_GENERATION_STARTED");
    expect(recordGlwCampaignLaunchReferenceReviewRequired(campaignId, "job-reference")?.state).toBe("REFERENCE_REVIEW_REQUIRED");
    expect(recordGlwCampaignLaunchReferenceFailure(campaignId, "QA failed")?.state).toBe("REFERENCE_FAILED_RECOVERABLE");
    expect(getGlwCampaignLaunchByCampaignId(campaignId)?.campaignId).toBe(campaignId);
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.campaignId === campaignId)).toBe(true);
  });

  test("requires exact initialized ownership before activation and retains reservations on mismatch", () => {
    const runtime = dependencies();
    const created = launch(input(), runtime.deps);
    const campaign = { ...created.campaign!, status: "active" as const };
    const initialized = cities.map((city, index): GlwCampaignTarget => ({ targetId: `target-${index}`, campaignId: campaign.campaignId, organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId, stateCode: city.stateCode, citySlug: city.citySlug, cityName: city.cityName, status: index === 0 ? "reference_complete" : "queued", jobId: index === 0 ? "reference-job" : null, wordpressObjectId: index === 0 ? "100" : null, attemptCount: index === 0 ? 1 : 0, lastError: null, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:00:00.000Z" }));
    expect(() => recordGlwCampaignLaunchActivated(campaign, initialized.slice(1))).toThrow("GLW_LAUNCH_TARGET_INITIALIZATION_MISMATCH");
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.state === "RESERVED")).toBe(true);
    expect(recordGlwCampaignLaunchActivated(campaign, initialized)?.state).toBe("ACTIVE");
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.state === "OWNED")).toBe(true);
    expect(recordGlwCampaignLaunchActivated(campaign, initialized)?.state).toBe("ACTIVE");
    expect(listGlwGlobalTargetOwnership().every((entry) => entry.state === "OWNED")).toBe(true);
  });

  test("dispatch failure retains campaign and ownership for recovery", () => {
    const runtime = dependencies();
    const created = launch(input(), runtime.deps);
    const campaignId = created.campaign!.campaignId;
    expect(recordGlwCampaignLaunchDispatch(campaignId, 2)).toMatchObject({ state: "DISPATCH_RECOVERY_REQUIRED", dispatchState: "RECOVERY_REQUIRED" });
    expect(getGlwCampaignLaunchByCampaignId(campaignId)?.campaignId).toBe(campaignId);
    expect(listGlwGlobalTargetOwnership()).toHaveLength(3);
  });
});