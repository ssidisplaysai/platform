import type { GlwCampaignReach, GlwLaunchpadBlocker } from "./campaign-launchpad";

export type GlwLaunchUiState =
  | "IDLE"
  | "CONFIRMING"
  | "REVALIDATING"
  | "CREATING_CAMPAIGN"
  | "RESERVING_TARGETS"
  | "REFERENCE_BOOTSTRAP"
  | "STARTING"
  | "SUCCESS"
  | "REVIEW_REQUIRED"
  | "RECOVERY_REQUIRED"
  | "FAILED";

export type GlwCertifiedLaunchTarget = {
  canonicalPath: string;
  stateCode: string;
  citySlug: string;
  cityName: string;
};

export type GlwCampaignLaunchRequest = {
  launchId: string;
  siteId: string;
  productId: string;
  reach: GlwCampaignReach;
  productUrl: string;
  selectedBatchSize: number;
  selectedTargets: readonly GlwCertifiedLaunchTarget[];
  acknowledgedPublicationPolicy: string;
};

export type GlwLaunchConflict = {
  target: GlwCertifiedLaunchTarget;
  code: "TARGET_CONFLICT" | "AUTHORITY_CHANGED" | "TARGET_UNRECONCILED";
  message: string;
  owningCampaignId: string | null;
  targetState: string | null;
};

export type GlwCampaignLaunchResultState =
  | "CAMPAIGN_CREATED"
  | "REFERENCE_GENERATION_STARTED"
  | "REFERENCE_REVIEW_REQUIRED"
  | "CAMPAIGN_ACTIVE"
  | "DISPATCH_STARTED"
  | "ALREADY_EXISTS"
  | "TARGET_CONFLICT"
  | "AUTHORITY_CHANGED"
  | "RECOVERY_REQUIRED"
  | "FAILED";

export type GlwCampaignLaunchResult = {
  state: GlwCampaignLaunchResultState;
  launchId: string;
  campaignId: string | null;
  campaignState: string | null;
  publicationPolicy: string;
  selectedTargetCount: number;
  targets: readonly GlwCertifiedLaunchTarget[];
  referenceTarget: GlwCertifiedLaunchTarget | null;
  referenceState: string | null;
  dispatchState: string | null;
  recoveryState: string | null;
  blockers: readonly GlwLaunchConflict[];
  createdAt: string | null;
};

export type GlwCampaignLaunchAdapter = {
  available: boolean;
  mode: "DISABLED" | "SYNTHETIC" | "ATOMIC_RUNTIME";
  launch(
    request: GlwCampaignLaunchRequest,
    onProgress: (state: GlwLaunchUiState) => void,
  ): Promise<GlwCampaignLaunchResult>;
};

export type GlwLaunchPresentation = {
  uiState: GlwLaunchUiState;
  heading: string;
  message: string;
  durable: boolean;
};

export function presentGlwLaunchResult(result: GlwCampaignLaunchResult): GlwLaunchPresentation {
  if (result.state === "REFERENCE_REVIEW_REQUIRED") return { uiState: "REVIEW_REQUIRED", heading: "Campaign created", message: "Reference page requires review.", durable: true };
  if (result.state === "RECOVERY_REQUIRED") return { uiState: "RECOVERY_REQUIRED", heading: "Campaign created - attention required", message: "The campaign is durable and requires recovery. Launching again will not create another campaign.", durable: true };
  if (result.state === "ALREADY_EXISTS") return { uiState: "SUCCESS", heading: "Existing campaign found", message: "The existing campaign was returned for this launch request.", durable: true };
  if (result.state === "CAMPAIGN_ACTIVE" || result.state === "DISPATCH_STARTED") return { uiState: "SUCCESS", heading: "Campaign Started", message: "Genesis accepted the certified target cohort.", durable: true };
  if (result.state === "AUTHORITY_CHANGED" || result.state === "TARGET_CONFLICT") return { uiState: "FAILED", heading: "Campaign not launched", message: result.state === "AUTHORITY_CHANGED" ? "Preflight changed since analysis." : "One or more targets became unavailable.", durable: false };
  if (result.state === "CAMPAIGN_CREATED" || result.state === "REFERENCE_GENERATION_STARTED") return { uiState: "REVIEW_REQUIRED", heading: "Campaign created", message: "Genesis is preparing the reference page.", durable: true };
  return { uiState: "FAILED", heading: "Campaign not launched", message: "The launch request could not be completed.", durable: Boolean(result.campaignId) };
}

export type GlwLaunchStatusCounts = Record<"researching" | "generating" | "qa" | "draft" | "review" | "published" | "failed", number>;

export function launchBlockersAsReadiness(result: GlwCampaignLaunchResult): readonly GlwLaunchpadBlocker[] {
  return result.blockers.map((blocker) => ({ code: blocker.code, scope: "TARGET", severity: "BLOCKING", message: blocker.message, authoritySource: "ATOMIC_LAUNCH_REVALIDATION", repairableByExistingWorkflow: null }));
}