import type { GlwCampaignOperatorReadModel, OperatorImageState } from "./campaign-operator-read-model";

export type CampaignAttentionState = "ACTION_REQUIRED" | "BLOCKED" | "RUNNING" | "READY" | "COMPLETE";

export type GlwCampaignListOperatorSummary = {
  campaignId: string;
  name: string;
  organizationId: string;
  siteId: string;
  siteName: string;
  domain: string | null;
  productName: string;
  scope: string;
  lifecycle: string;
  attention: CampaignAttentionState;
  attentionPriority: number;
  nextAction: string;
  nextActionEnabled: boolean;
  nextTarget: string | null;
  blocker: { what: string; why: string; safeNextStep: string } | null;
  counts: GlwCampaignOperatorReadModel["counts"];
  executionReadiness: "READY" | "BLOCKED" | "RUNNING" | "NOT_REQUIRED";
  capabilityDetails: readonly string[];
  policy: "DRAFT ONLY" | "PUBLISH AFTER GATES";
  imagePackage: "READY" | "PARTIAL" | "MISSING";
  productAuthorityImage: OperatorImageState;
  contextualInUseImage: OperatorImageState;
  updatedAt: string;
  href: string;
};

const READY_IMAGE_STATES = new Set<OperatorImageState>(["APPROVED", "READY"]);

function lifecycleLabel(model: GlwCampaignOperatorReadModel): string {
  if (model.counts.failed > 0) return "Blocked";
  if (model.currentStage === "Execution") return "Executing";
  if (model.currentStage === "Reconciliation") return "Reconciliation Required";
  if (model.currentStage === "Draft Ready") return "Draft Review";
  return model.currentStage;
}

function attentionState(model: GlwCampaignOperatorReadModel): CampaignAttentionState {
  if (model.counts.running > 0) return "RUNNING";
  if (model.counts.failed > 0 || (model.canonicalAction.reason && !model.canonicalAction.enabled && model.currentStage !== "Reference")) return "BLOCKED";
  if (model.currentStage === "Complete") return "COMPLETE";
  if (model.currentStage === "Reference") return "ACTION_REQUIRED";
  if (["AUTHORIZE", "ACTIVATE", "DISPATCH", "RECONCILE", "REVIEW_DRAFT", "PUBLISH"].includes(model.canonicalAction.kind)) return "ACTION_REQUIRED";
  return "READY";
}

function blockerSummary(model: GlwCampaignOperatorReadModel): GlwCampaignListOperatorSummary["blocker"] {
  if (model.counts.failed > 0) return { what: `${model.counts.failed} target${model.counts.failed === 1 ? "" : "s"} failed`, why: "Target execution recorded a failure.", safeNextStep: "Open campaign to inspect evidence and reconcile or retry safely." };
  if (model.canonicalAction.reason && !model.canonicalAction.enabled && model.currentStage !== "Reference" && model.counts.running === 0) return { what: `${model.canonicalAction.label} blocked`, why: model.canonicalAction.reason, safeNextStep: "Open campaign to review the governing capability and remediation." };
  return null;
}

function imageSummary(model: GlwCampaignOperatorReadModel): Pick<GlwCampaignListOperatorSummary, "imagePackage" | "productAuthorityImage" | "contextualInUseImage"> {
  const productStates = model.targets.map((target) => target.productAuthorityImage.state);
  const contextualStates = model.targets.map((target) => target.contextualInUseImage.state);
  const productAuthorityImage = productStates.find((state) => READY_IMAGE_STATES.has(state)) ?? productStates[0] ?? "MISSING";
  const contextualInUseImage = contextualStates.find((state) => READY_IMAGE_STATES.has(state)) ?? contextualStates[0] ?? "MISSING";
  const ready = Number(READY_IMAGE_STATES.has(productAuthorityImage)) + Number(READY_IMAGE_STATES.has(contextualInUseImage));
  return { imagePackage: ready === 2 ? "READY" : ready === 0 ? "MISSING" : "PARTIAL", productAuthorityImage, contextualInUseImage };
}

export function deriveGlwCampaignListOperatorSummary(input: {
  model: GlwCampaignOperatorReadModel;
  siteName: string;
  domain: string | null;
  productName: string;
  updatedAt: string;
}): GlwCampaignListOperatorSummary {
  const { model } = input;
  const attention = attentionState(model);
  const blocker = blockerSummary(model);
  const nextAction = model.counts.failed > 0
    ? "Resolve Blocker"
    : model.currentStage === "Reference" && model.canonicalAction.kind === "NONE"
      ? "Review Reference"
      : model.canonicalAction.label;
  const nextTarget = model.canonicalAction.kind === "DISPATCH"
    ? model.targets.find((target) => target.lifecycleState === "queued")?.identity ?? null
    : null;
  const capabilityDetails = [
    `Release ${model.capabilities.release.state}`,
    `MCP ${model.capabilities.mcp.state}`,
    `Scheduler ${model.capabilities.scheduler.state}`,
    `WordPress ${model.targets.some((target) => Boolean(target.wordpressObjectId)) ? "READY" : "NOT REQUIRED"}`,
  ];
  const executionReadiness = model.counts.running > 0
    ? "RUNNING"
    : model.capabilities.scheduler.state === "READY"
      ? "READY"
      : model.capabilities.scheduler.state === "BLOCKED" && model.currentStage === "Dispatch"
        ? "BLOCKED"
        : "NOT_REQUIRED";
  const geographies = [...new Set(model.targets.map((target) => target.identity.split(", ").at(-1)).filter((value): value is string => Boolean(value)))];
  const scope = model.targets.length > 0
    ? `${geographies.join(", ")} · ${model.targets.length} ${model.campaign.pageType === "city_service" ? "city" : "state"} targets`
    : model.campaign.pageType === "city_service" ? "City campaign" : "State campaign";

  return {
    campaignId: model.campaign.campaignId,
    name: model.campaign.name,
    organizationId: model.campaign.organizationId,
    siteId: model.campaign.siteId,
    siteName: input.siteName,
    domain: input.domain,
    productName: input.productName,
    scope,
    lifecycle: lifecycleLabel(model),
    attention,
    attentionPriority: { BLOCKED: 0, ACTION_REQUIRED: 1, RUNNING: 2, READY: 3, COMPLETE: 4 }[attention],
    nextAction,
    nextActionEnabled: model.canonicalAction.enabled || nextAction === "Review Reference",
    nextTarget,
    blocker,
    counts: model.counts,
    executionReadiness,
    capabilityDetails,
    policy: model.campaign.publicationPolicy === "draft_only" ? "DRAFT ONLY" : "PUBLISH AFTER GATES",
    ...imageSummary(model),
    updatedAt: input.updatedAt,
    href: `/glw/campaigns/${model.campaign.campaignId}?organizationId=${encodeURIComponent(model.campaign.organizationId)}&siteId=${encodeURIComponent(model.campaign.siteId)}`,
  };
}

export function orderGlwCampaignListOperatorSummaries(summaries: readonly GlwCampaignListOperatorSummary[]): GlwCampaignListOperatorSummary[] {
  return [...summaries].sort((left, right) => left.attentionPriority - right.attentionPriority || right.updatedAt.localeCompare(left.updatedAt) || left.campaignId.localeCompare(right.campaignId));
}