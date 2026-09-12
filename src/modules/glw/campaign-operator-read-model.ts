import "server-only";

import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";
import type { GlwPageExecutionRecord } from "./page-execution";
import type { GlwCampaignActivationGrant } from "./campaign-activation-authorization";
import type { GlwCampaignActivationReleaseCapabilityState } from "./campaign-release-capability";
import type { GlwReferenceImageCandidate } from "./campaign-reference-image-candidate-repository";
import { listGlwCampaigns } from "./campaign-repository";
import { listGlwCampaignTargets } from "./campaign-target-repository";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { listGlwCampaignActivationGrants } from "./campaign-activation-authorization";
import { resolveGlwCampaignActivationReleaseCapability } from "./campaign-release-capability";
import { getGlwN8nMcpConfigurationStatus } from "./n8n-mcp-adapter";
import { getGlwLocalReferenceDraft } from "./campaign-local-reference-repository";
import { getLatestGlwReferenceImageCandidate } from "./campaign-reference-image-candidate-repository";

export type OperatorStageState = "COMPLETE" | "CURRENT" | "PARTIAL" | "BLOCKED" | "UPCOMING" | "NOT_REQUIRED";
export type OperatorImageState = "APPROVED" | "READY" | "GENERATING" | "MISSING" | "DEGRADED" | "NOT_WIRED";

export type GlwCampaignOperatorTarget = {
  targetId: string;
  identity: string;
  lifecycleState: string;
  jobId: string | null;
  executionId: string | null;
  executionState: string | null;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
  wordpressUrl: string | null;
  productAuthorityImage: { state: OperatorImageState; detail: string };
  contextualInUseImage: { state: OperatorImageState; detail: string };
  lastActivity: string;
  issue: string | null;
};

export type GlwCampaignOperatorReadModel = {
  campaign: Pick<GlwCampaign, "campaignId" | "organizationId" | "siteId" | "name" | "status" | "publicationPolicy" | "pagesPerDay" | "pageType">;
  counts: { referenceComplete: number; queued: number; running: number; contentReady: number; draftReady: number; published: number; failed: number };
  lifecycle: readonly { key: string; label: string; state: OperatorStageState; detail: string }[];
  currentStage: string;
  nextStage: string;
  canonicalAction: { kind: "AUTHORIZE" | "ACTIVATE" | "DISPATCH" | "RECONCILE" | "REVIEW_DRAFT" | "PUBLISH" | "NONE"; label: string; href: string; enabled: boolean; reason: string | null };
  capabilities: {
    release: { state: "READY" | "BLOCKED" | "NOT_REQUIRED"; detail: string };
    mcp: { state: "READY" | "BLOCKED" | "NOT_REQUIRED"; detail: string };
    scheduler: { state: "READY" | "BLOCKED" | "NOT_REQUIRED"; detail: string };
    publication: { state: "READY" | "BLOCKED" | "DRAFT_ONLY"; detail: string };
  };
  targets: readonly GlwCampaignOperatorTarget[];
};

function targetIdentity(target: GlwCampaignTarget): string {
  return target.cityName ? `${target.cityName}, ${target.stateCode}` : target.stateCode;
}

function latestTimestamp(target: GlwCampaignTarget, job: GlwPageExecutionRecord | null): string {
  return [target.updatedAt, job?.updatedAt, job?.completedAt].filter((value): value is string => Boolean(value)).sort().at(-1) ?? target.createdAt;
}

function referenceImageState(candidate: GlwReferenceImageCandidate | null): GlwCampaignOperatorTarget["contextualInUseImage"] {
  if (!candidate) return { state: "MISSING", detail: "No contextual image evidence is attached." };
  if (candidate.status === "APPROVED") return { state: "APPROVED", detail: `Approved campaign application visual, revision ${candidate.revision}.` };
  if (candidate.status === "READY_FOR_OWNER_REVIEW") return { state: "READY", detail: `Campaign application visual revision ${candidate.revision} awaits review.` };
  return { state: "DEGRADED", detail: `Latest campaign application visual is ${candidate.status.toLowerCase().replaceAll("_", " ")}.` };
}

export function deriveGlwCampaignOperatorReadModel(input: {
  campaign: GlwCampaign;
  targets: readonly GlwCampaignTarget[];
  jobs: readonly GlwPageExecutionRecord[];
  latestGrant: GlwCampaignActivationGrant | null;
  releaseCapability: GlwCampaignActivationReleaseCapabilityState;
  mcpConfigured: boolean;
  referenceImage: GlwReferenceImageCandidate | null;
}): GlwCampaignOperatorReadModel {
  const jobs = new Map(input.jobs.map((job) => [job.jobId, job]));
  const referenceComplete = input.targets.filter((target) => target.status === "reference_complete").length;
  const queued = input.targets.filter((target) => target.status === "queued").length;
  const running = input.targets.filter((target) => target.status === "running").length;
  const draftReady = input.targets.filter((target) => target.status === "draft_ready").length;
  const published = input.targets.filter((target) => target.status === "published").length;
  const failed = input.targets.filter((target) => target.status === "failed").length;
  const contentReady = input.targets.filter((target) => {
    const job = target.jobId ? jobs.get(target.jobId) : null;
    return target.status === "running" && job?.status === "CONTENT_READY";
  }).length;
  const authorized = Boolean(input.latestGrant?.consumedAt || input.latestGrant?.claimedAt || (input.latestGrant && !input.latestGrant.consumedAt && new Date(input.latestGrant.expiresAt) > new Date()));
  const active = input.campaign.status === "active" || input.campaign.status === "complete";
  const dispatched = input.targets.some((target) => Boolean(target.dispatchDate));
  const executionStarted = input.targets.some((target) => Boolean(target.jobId));
  const reconciliationComplete = draftReady + published > 0;
  const draftOnly = input.campaign.publicationPolicy === "draft_only";
  const reconcilable = input.targets.some((target) => {
    const job = target.jobId ? jobs.get(target.jobId) : null;
    return Boolean(job && (target.status === "running" || target.status === "failed") && ["CONTENT_READY", "COMPLETE", "FAILED"].includes(job.status));
  });

  let currentStage = "Reference";
  let nextStage = "Reference approval";
  let canonicalAction: GlwCampaignOperatorReadModel["canonicalAction"] = { kind: "NONE", label: "No safe owner action", href: "#campaign-actions", enabled: false, reason: "Campaign state is not ready for an owner mutation." };
  if (!active) {
    if (!referenceComplete) {
      currentStage = "Reference";
      nextStage = "Approve the canonical reference";
    } else if (!authorized) {
      currentStage = "Authorization";
      nextStage = "Authorize campaign activation";
      canonicalAction = { kind: "AUTHORIZE", label: "Authorize Campaign", href: "/glw/campaigns", enabled: true, reason: null };
    } else {
      currentStage = "Activation";
      nextStage = "Activate campaign";
      canonicalAction = { kind: "ACTIVATE", label: "Activate Campaign", href: "/glw/campaigns", enabled: input.releaseCapability.ready, reason: input.releaseCapability.reason };
    }
  } else if (reconcilable) {
    currentStage = "Reconciliation";
    nextStage = "Reconcile the exact execution";
    canonicalAction = { kind: "RECONCILE", label: "Reconcile Campaign", href: "#campaign-actions", enabled: true, reason: null };
  } else if (running > 0) {
    currentStage = "Execution";
    nextStage = "Wait for the running execution, then reconcile";
    canonicalAction = { kind: "NONE", label: "Execution In Progress", href: "#campaign-actions", enabled: false, reason: "A target is running. Refresh until the exact execution reaches a reconcilable state." };
  } else if (queued > 0) {
    currentStage = "Dispatch";
    nextStage = "Dispatch the next deterministic target";
    const ready = input.mcpConfigured;
    canonicalAction = { kind: "DISPATCH", label: "Run Next Draft Batch", href: "#campaign-actions", enabled: ready, reason: ready ? null : "MCP execution capability is unavailable." };
  } else if (draftReady > 0) {
    currentStage = "Draft Ready";
    nextStage = draftOnly ? "Review the persisted WordPress drafts" : "Review publication eligibility";
    canonicalAction = { kind: draftOnly ? "REVIEW_DRAFT" : "PUBLISH", label: draftOnly ? "Review Draft" : "Publish Approved Pages", href: "#target-workspace", enabled: true, reason: null };
  } else {
    currentStage = "Complete";
    nextStage = "No further owner action required";
    canonicalAction = { kind: "NONE", label: "No Further Owner Action Required", href: "#target-workspace", enabled: false, reason: null };
  }

  const lifecycle: GlwCampaignOperatorReadModel["lifecycle"] = [
    { key: "reference", label: "Reference", state: referenceComplete ? "COMPLETE" : currentStage === "Reference" ? "CURRENT" : "UPCOMING", detail: referenceComplete ? `${referenceComplete} reference target complete` : "Canonical reference required" },
    { key: "authorization", label: "Authorized", state: authorized ? "COMPLETE" : currentStage === "Authorization" ? "CURRENT" : active ? "COMPLETE" : "UPCOMING", detail: input.latestGrant?.consumedAt ? "Single-use grant consumed" : authorized ? "Activation grant ready" : "Owner grant required" },
    { key: "activation", label: "Activated", state: active ? "COMPLETE" : currentStage === "Activation" ? "CURRENT" : "UPCOMING", detail: active ? "Campaign active" : "Activation remains explicit" },
    { key: "dispatch", label: "Dispatch", state: currentStage === "Dispatch" ? "CURRENT" : queued > 0 || dispatched ? "PARTIAL" : active ? "COMPLETE" : "UPCOMING", detail: queued > 0 ? `${queued} queued` : dispatched ? "All eligible targets dispatched" : "Not started" },
    { key: "execution", label: "Execution", state: currentStage === "Execution" ? "CURRENT" : running > 0 || executionStarted ? "PARTIAL" : queued > 0 ? "UPCOMING" : "COMPLETE", detail: running > 0 ? `${running} running` : executionStarted ? "Execution evidence recorded" : "Not started" },
    { key: "reconciliation", label: "Reconciliation", state: currentStage === "Reconciliation" ? "CURRENT" : reconciliationComplete ? "PARTIAL" : executionStarted ? "UPCOMING" : "UPCOMING", detail: reconciliationComplete ? `${draftReady + published} reconciled` : "Exact job readback required" },
    { key: "draft", label: "Draft Ready", state: currentStage === "Draft Ready" ? "CURRENT" : draftReady > 0 ? "PARTIAL" : published > 0 ? "COMPLETE" : "UPCOMING", detail: `${draftReady} WordPress draft${draftReady === 1 ? "" : "s"}` },
    { key: "publication", label: "Publication", state: draftOnly ? "BLOCKED" : published > 0 ? "PARTIAL" : "UPCOMING", detail: draftOnly ? "Blocked by campaign policy" : `${published} published` },
  ];

  const targets = [...input.targets]
    .sort((left, right) => targetIdentity(left).localeCompare(targetIdentity(right)))
    .map((target): GlwCampaignOperatorTarget => {
      const job = target.jobId ? jobs.get(target.jobId) ?? null : null;
      const isReference = target.status === "reference_complete";
      const contextual = isReference
        ? referenceImageState(input.referenceImage)
        : job?.featuredImagePresent === true
          ? { state: "READY" as const, detail: "Execution verified a featured image; certified contextual role assignment is not yet wired." }
          : job?.status === "RUNNING" || job?.status === "DISPATCHED"
            ? { state: "GENERATING" as const, detail: "Image evidence is pending with the execution." }
            : { state: "MISSING" as const, detail: "No contextual in-use image evidence is available yet." };
      return {
        targetId: target.targetId,
        identity: targetIdentity(target),
        lifecycleState: target.status,
        jobId: target.jobId,
        executionId: job?.externalExecutionId ?? null,
        executionState: job?.status ?? null,
        wordpressObjectId: target.wordpressObjectId ?? job?.wordpressObjectId ?? null,
        wordpressStatus: job?.wordpressStatus ?? (target.status === "published" ? "publish" : target.status === "draft_ready" ? "draft" : null),
        wordpressUrl: job?.wordpressUrl ?? null,
        productAuthorityImage: { state: "NOT_WIRED", detail: "Target-level PRODUCT_AUTHORITY assignment is not exposed by the campaign backend." },
        contextualInUseImage: contextual,
        lastActivity: latestTimestamp(target, job),
        issue: target.lastError ?? job?.errorMessage ?? null,
      };
    });

  return {
    campaign: { campaignId: input.campaign.campaignId, organizationId: input.campaign.organizationId, siteId: input.campaign.siteId, name: input.campaign.name, status: input.campaign.status, publicationPolicy: input.campaign.publicationPolicy, pagesPerDay: input.campaign.pagesPerDay, pageType: input.campaign.pageType },
    counts: { referenceComplete, queued, running, contentReady, draftReady, published, failed },
    lifecycle,
    currentStage,
    nextStage,
    canonicalAction,
    capabilities: {
      release: active ? { state: input.releaseCapability.ready ? "READY" : "BLOCKED", detail: input.releaseCapability.reason ?? `Exact release ${input.releaseCapability.capability?.releaseSha.slice(0, 8) ?? "unknown"}` } : { state: input.releaseCapability.ready ? "READY" : "BLOCKED", detail: input.releaseCapability.reason ?? "Exact-release activation capability available" },
      mcp: active ? { state: input.mcpConfigured ? "READY" : "BLOCKED", detail: input.mcpConfigured ? "Configured; live tool preflight runs before every lease" : "Execution configuration unavailable" } : { state: "NOT_REQUIRED", detail: "Required only for dispatch" },
      scheduler: active ? { state: input.mcpConfigured && running === 0 && queued > 0 ? "READY" : queued === 0 ? "NOT_REQUIRED" : "BLOCKED", detail: running > 0 ? "Running target occupies the execution slot" : queued > 0 ? `${queued} queued; one target per invocation` : "No queued targets" } : { state: "NOT_REQUIRED", detail: "Campaign must be active" },
      publication: { state: draftOnly ? "DRAFT_ONLY" : "READY", detail: draftOnly ? "Publication blocked by campaign policy" : "Publication still requires exact eligible drafts and owner confirmation" },
    },
    targets,
  };
}

export async function buildGlwCampaignOperatorReadModel(campaignId: string): Promise<GlwCampaignOperatorReadModel | null> {
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === campaignId) ?? null;
  if (!campaign) return null;
  const targets = listGlwCampaignTargets(campaignId);
  const allJobs = await glwPageExecutionRepository.list();
  const targetJobIds = new Set(targets.map((target) => target.jobId).filter((jobId): jobId is string => Boolean(jobId)));
  const jobs = allJobs.filter((job) => targetJobIds.has(job.jobId));
  const latestGrant = listGlwCampaignActivationGrants(campaignId).at(-1) ?? null;
  const runningReleaseSha = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const releaseCapability = resolveGlwCampaignActivationReleaseCapability({ organizationId: campaign.organizationId, siteId: campaign.siteId, runningReleaseSha });
  const mcpConfigured = getGlwN8nMcpConfigurationStatus().configured;
  const referenceTarget = targets.find((target) => target.status === "reference_complete" && target.citySlug && target.cityName) ?? null;
  const referenceDraft = referenceTarget?.citySlug ? getGlwLocalReferenceDraft(campaignId, referenceTarget.stateCode, referenceTarget.citySlug) : null;
  const referenceImage = referenceDraft ? getLatestGlwReferenceImageCandidate({ organizationId: campaign.organizationId, siteId: campaign.siteId, campaignId, referenceDraftId: referenceDraft.referenceDraftId }) : null;
  return deriveGlwCampaignOperatorReadModel({ campaign, targets, jobs, latestGrant, releaseCapability, mcpConfigured, referenceImage });
}
