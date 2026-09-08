import type {
  GlwCampaignLaunchAdapter,
  GlwCampaignLaunchRequest,
  GlwCampaignLaunchResult,
  GlwCampaignLaunchResultState,
  GlwLaunchUiState,
} from "./campaign-launch-contract";

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
  const campaignId = `campaign-synthetic-${request.launchId}`;
  const base: GlwCampaignLaunchResult = {
    state: "DISPATCH_STARTED",
    launchId: request.launchId,
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
  return {
    available: false,
    mode: "ATOMIC_RUNTIME",
    async launch() {
      throw new Error("Atomic runtime adapter is not connected.");
    },
  };
}