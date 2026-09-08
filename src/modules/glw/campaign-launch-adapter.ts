import type {
  GlwCampaignLaunchAdapter,
  GlwCampaignLaunchRequest,
  GlwCampaignLaunchResult,
  GlwCampaignLaunchResultState,
  GlwLaunchUiState,
} from "./campaign-launch-contract";
import type { GlwCampaignLaunchpadPreflight } from "./campaign-launchpad";

type FetchImplementation = (input: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type AtomicRuntimeResponse = {
  state?: string;
  error?: string;
  code?: string;
  launch?: {
    launchId?: string;
    campaignId?: string | null;
    state?: string;
    publicationPolicy?: "draft_only" | "publish_after_gates";
    dispatchState?: string | null;
    recoveryReason?: string | null;
    createdAt?: string | null;
  } | null;
  campaign?: { campaignId?: string; status?: string; publicationPolicy?: "draft_only" | "publish_after_gates" } | null;
  conflicts?: Array<{ globalTargetKey?: string; campaignId?: string | null; state?: string | null }>;
  referenceBootstrap?: { target?: { stateCode?: string; citySlug?: string; cityName?: string }; state?: string } | null;
};

export type GlwSyntheticLaunchScenario =
  | "SUCCESS"
  | "STALE_PREFLIGHT"
  | "TARGET_CONFLICT"
  | "ALREADY_EXISTS"
  | "REFERENCE_REVIEW_REQUIRED"
  | "RECOVERY_REQUIRED"
  | "DISPATCH_FAILED";

export function createDisabledCampaignLaunchAdapter(): GlwCampaignLaunchAdapter {
  return {
    available: false,
    mode: "DISABLED",
    async launch() {
      throw new Error("Campaign launch execution is unavailable until the atomic runtime is certified.");
    },
  };
}

function resultFor(request: GlwCampaignLaunchRequest, scenario: GlwSyntheticLaunchScenario): GlwCampaignLaunchResult {
  const campaignId = "campaign-synthetic-fixture";
  const base: GlwCampaignLaunchResult = {
    state: "DISPATCH_STARTED",
    launchId: "launch-synthetic-fixture",
    campaignId,
    campaignState: "active",
    publicationPolicy: request.acknowledgedPublicationPolicy,
    selectedTargetCount: request.selectedTargets.length,
    targets: request.selectedTargets,
    referenceTarget: request.selectedTargets[0] ?? null,
    referenceState: "reference_complete",
    dispatchState: "started",
    recoveryState: null,
    blockers: [],
    createdAt: "2030-01-01T00:00:00.000Z",
  };
  if (scenario === "STALE_PREFLIGHT" || scenario === "TARGET_CONFLICT") {
    const state: GlwCampaignLaunchResultState = scenario === "STALE_PREFLIGHT" ? "AUTHORITY_CHANGED" : "TARGET_CONFLICT";
    return { ...base, state, campaignId: null, campaignState: null, dispatchState: null, createdAt: null, blockers: [{ target: request.selectedTargets[0], code: state === "AUTHORITY_CHANGED" ? "AUTHORITY_CHANGED" : "TARGET_CONFLICT", message: state === "AUTHORITY_CHANGED" ? "Dallas is no longer certified safe." : "Dallas is now owned by another campaign.", owningCampaignId: state === "TARGET_CONFLICT" ? "campaign-authoritative-owner" : null, targetState: state === "TARGET_CONFLICT" ? "running" : null }] };
  }
  if (scenario === "ALREADY_EXISTS") return { ...base, state: "ALREADY_EXISTS", campaignState: "active", dispatchState: "existing" };
  if (scenario === "REFERENCE_REVIEW_REQUIRED") return { ...base, state: "REFERENCE_REVIEW_REQUIRED", campaignState: "draft", referenceState: "review_required", dispatchState: null };
  if (scenario === "RECOVERY_REQUIRED" || scenario === "DISPATCH_FAILED") return { ...base, state: "RECOVERY_REQUIRED", campaignState: "active", dispatchState: scenario === "DISPATCH_FAILED" ? "failed" : "paused", recoveryState: scenario === "DISPATCH_FAILED" ? "dispatch_reconciliation_required" : "reference_recovery_required" };
  return base;
}

export function createSyntheticCampaignLaunchAdapter(input: {
  scenario: GlwSyntheticLaunchScenario;
  delay?: () => Promise<void>;
}): GlwCampaignLaunchAdapter {
  let active = false;
  const delay = input.delay ?? (() => Promise.resolve());
  return {
    available: true,
    mode: "SYNTHETIC",
    async launch(request, onProgress) {
      if (active) throw new Error("A launch request is already in progress.");
      active = true;
      try {
        for (const state of ["REVALIDATING", "CREATING_CAMPAIGN", "RESERVING_TARGETS", "REFERENCE_BOOTSTRAP", "STARTING"] satisfies GlwLaunchUiState[]) {
          onProgress(state);
          await delay();
        }
        return resultFor(request, input.scenario);
      } finally {
        active = false;
      }
    },
  };
}

export function createAtomicRuntimeCampaignLaunchAdapter(): GlwCampaignLaunchAdapter {
  return createConfiguredAtomicRuntimeCampaignLaunchAdapter({ organizationId: "", requestRoles: [], available: false });
}

function targetKey(target: { stateCode: string; citySlug: string }): string {
  return `${target.stateCode.trim().toUpperCase()}::${target.citySlug.trim().toLowerCase()}`;
}

function conflictTarget(request: GlwCampaignLaunchRequest, globalTargetKey?: string) {
  if (!globalTargetKey) return request.selectedTargets[0];
  return request.selectedTargets.find((target) => globalTargetKey.endsWith(`::${targetKey(target)}`)) ?? request.selectedTargets[0];
}

function authorityChangedResult(request: GlwCampaignLaunchRequest, message: string): GlwCampaignLaunchResult {
  return {
    state: "AUTHORITY_CHANGED", launchId: "", campaignId: null, campaignState: null,
    publicationPolicy: request.acknowledgedPublicationPolicy, selectedTargetCount: request.selectedTargets.length,
    targets: request.selectedTargets, referenceTarget: null, referenceState: null, dispatchState: null,
    recoveryState: null, blockers: request.selectedTargets.slice(0, 1).map((target) => ({ target, code: "AUTHORITY_CHANGED", message, owningCampaignId: null, targetState: null })), createdAt: null,
  };
}

export function mapAtomicRuntimeLaunchResult(request: GlwCampaignLaunchRequest, value: unknown): GlwCampaignLaunchResult {
  const response = (value && typeof value === "object" ? value : {}) as AtomicRuntimeResponse;
  if (response.code === "AUTHORITY_CHANGED") return authorityChangedResult(request, response.error ?? "Campaign authority changed.");
  const runtimeState = response.state ?? "FAILED";
  const launchState = response.launch?.state ?? null;
  let state: GlwCampaignLaunchResultState = "FAILED";
  if (runtimeState === "TARGET_CONFLICT" || runtimeState === "HISTORICAL_OWNERSHIP_CONFLICT") state = "TARGET_CONFLICT";
  else if (runtimeState === "RECOVERY_REQUIRED" || launchState === "DISPATCH_RECOVERY_REQUIRED" || launchState === "REFERENCE_FAILED_RECOVERABLE") state = "RECOVERY_REQUIRED";
  else if (runtimeState === "ALREADY_EXISTS") state = "ALREADY_EXISTS";
  else if (launchState === "REFERENCE_GENERATION_STARTED") state = "REFERENCE_GENERATION_STARTED";
  else if (launchState === "REFERENCE_REVIEW_REQUIRED" || launchState === "REFERENCE_APPROVED") state = "REFERENCE_REVIEW_REQUIRED";
  else if (launchState === "ACTIVE") state = "CAMPAIGN_ACTIVE";
  else if (launchState === "DISPATCH_STARTED") state = "DISPATCH_STARTED";
  else if (runtimeState === "REFERENCE_GENERATION_REQUIRED" && launchState === "REFERENCE_PENDING") state = "CAMPAIGN_CREATED";
  const referenceIdentity = response.referenceBootstrap?.target;
  const referenceTarget = referenceIdentity
    ? request.selectedTargets.find((target) => targetKey(target) === targetKey({ stateCode: referenceIdentity.stateCode ?? "", citySlug: referenceIdentity.citySlug ?? "" })) ?? null
    : null;
  const conflicts = response.conflicts ?? [];
  return {
    state,
    launchId: response.launch?.launchId ?? "",
    campaignId: response.campaign?.campaignId ?? response.launch?.campaignId ?? null,
    campaignState: response.campaign?.status ?? launchState,
    publicationPolicy: response.launch?.publicationPolicy ?? response.campaign?.publicationPolicy ?? request.acknowledgedPublicationPolicy,
    selectedTargetCount: request.selectedTargets.length,
    targets: request.selectedTargets,
    referenceTarget,
    referenceState: response.referenceBootstrap?.state ?? launchState,
    dispatchState: response.launch?.dispatchState ?? null,
    recoveryState: response.launch?.recoveryReason ?? null,
    blockers: conflicts.map((conflict) => ({ target: conflictTarget(request, conflict.globalTargetKey), code: "TARGET_CONFLICT" as const, message: "This exact city target is already reserved or owned.", owningCampaignId: conflict.campaignId ?? null, targetState: conflict.state ?? null })),
    createdAt: response.launch?.createdAt ?? null,
  };
}

export function createConfiguredAtomicRuntimeCampaignLaunchAdapter(input: {
  organizationId: string;
  requestRoles: readonly string[];
  available?: boolean;
  fetchImpl?: FetchImplementation;
}): GlwCampaignLaunchAdapter {
  let active = false;
  const fetchImpl = input.fetchImpl ?? ((url, init) => fetch(url, init));
  const headers = { "Content-Type": "application/json", "x-gcp-roles": input.requestRoles.join(","), "x-gcp-organization-id": input.organizationId };
  return {
    available: input.available ?? true,
    mode: "ATOMIC_RUNTIME",
    async launch(request, onProgress) {
      if (!(input.available ?? true)) throw new Error("Atomic runtime adapter is not connected.");
      if (request.targetClass !== "CITY") throw new Error("The certified atomic runtime supports CITY targets only.");
      if (active) throw new Error("A launch request is already in progress.");
      active = true;
      try {
        onProgress("REVALIDATING");
        const revalidationResponse = await fetchImpl("/api/glw/campaign-launchpad/preflight", { method: "POST", headers, body: JSON.stringify(request.preflightInput) });
        const revalidationBody = await revalidationResponse.json() as { preflight?: GlwCampaignLaunchpadPreflight; error?: string };
        if (!revalidationResponse.ok || !revalidationBody.preflight) return authorityChangedResult(request, revalidationBody.error ?? "Campaign preflight could not be revalidated.");
        const current = revalidationBody.preflight;
        const currentSafeKeys = new Set(current.targetAssessments.filter((target) => target.safe && target.primaryDisposition === "SAFE").map(targetKey));
        const exactCohortStillSafe = request.selectedTargets.length === request.selectedBatchSize && request.selectedTargets.every((target) => currentSafeKeys.has(targetKey(target)));
        if (current.readiness !== "READY" || current.site.id !== request.siteId || current.product?.id !== request.productId || current.publicationPolicy !== request.acknowledgedPublicationPolicy || !exactCohortStillSafe) return authorityChangedResult(request, "Target or publication authority changed. Analyze again before launching.");
        onProgress("RESERVING_TARGETS");
        const launchResponse = await fetchImpl("/api/glw/campaign-launch", {
          method: "POST",
          headers,
          body: JSON.stringify({
            operation: "LAUNCH_CITY_CAMPAIGN",
            siteId: request.siteId,
            productId: request.productId,
            name: request.campaignName,
            pagesPerDay: request.pagesPerDay,
            publicationPolicyAcknowledgement: request.acknowledgedPublicationPolicy,
            targets: request.selectedTargets.map(({ stateCode, citySlug, cityName }) => ({ stateCode, citySlug, cityName })),
          }),
        });
        const launchBody = await launchResponse.json();
        const result = mapAtomicRuntimeLaunchResult(request, launchBody);
        if (!launchResponse.ok && result.state === "FAILED") throw new Error((launchBody as AtomicRuntimeResponse).error ?? "Atomic campaign launch failed.");
        if (["CAMPAIGN_CREATED", "REFERENCE_GENERATION_STARTED", "REFERENCE_REVIEW_REQUIRED"].includes(result.state)) {
          onProgress("REFERENCE_BOOTSTRAP");
        }
        return result;
      } finally {
        active = false;
      }
    },
  };
}