import "server-only";

import { createHash } from "node:crypto";

import { synthesizeCreativeDirection } from "./site-creative-direction-synthesizer";
import {
  certifyGenerationReadiness,
  recordSystemContinuationEvent,
  startSiteBuild,
} from "./site-generation-readiness-repository";
import { getSiteGenerationReadiness } from "./site-generation-readiness-service";
import {
  addCreativeProposal,
  decideCreativeProposal,
  getSiteIntelligenceWorkspace,
  refreshApprovedCreativeProposal,
} from "./site-intelligence-repository";
import type { CreativeDirectionProposal } from "./site-intelligence";
import type { SiteBuildPlanProposal } from "./site-build-plan";
import {
  approveBuildDrafts,
  approveBuildPlan,
  createBuildWordPressDrafts,
  generateBuildDrafts,
  generateBuildPlan,
  generateFullSiteAssembly,
  getSiteBuildWorkspace,
} from "./site-build-service";
import type { SiteBuildStage } from "./site-build-stage";
import type { SiteConfiguration } from "./types";

const SYSTEM_ACTOR = "SYSTEM_CONTINUATION";

export const GENESIS_THREE_GATE_OPERATOR_RULE = {
  authority: "Human judgment establishes or materially changes what the organization sells, provides, claims, targets, or authorizes.",
  build: "BUILD SITE / CONTINUE BUILD authorizes Genesis to autonomously perform deterministic governed work to produce reviewable drafts.",
  publish: "Publication remains explicitly human-authorized.",
  ownerInterruptionTest: "Before blocking owner action, identify the net-new decision that cannot be derived from approved authority.",
} as const;

export type ContinuationStopReason =
  | "OWNER_ACTION_REQUIRED"
  | "CREATIVE_REVIEW_REQUIRED"
  | "BUILD_PLAN_REVIEW_REQUIRED"
  | "PAGE_REVIEW_REQUIRED"
  | "REVIEW_OUTPUT_READY"
  | "BUILD_IN_PROGRESS"
  | "PUBLICATION_BOUNDARY"
  | "HARD_SAFETY_STOP";

export type ContinuationResult = {
  stopReason: ContinuationStopReason;
  stage: SiteBuildStage;
  ownerInterruptionQuestion: string;
  detail: string;
  ownerReviewRequired: boolean;
};

export type ThreeGateOwnerActionState =
  | "READY_TO_CONTINUE"
  | "OWNER_ACTION_REQUIRED"
  | "PAGE_REVIEW_REQUIRED"
  | "PUBLICATION_BOUNDARY"
  | "BUILD_IN_PROGRESS";

export type ThreeGateOwnerActionProjection = {
  ownerActionState: ThreeGateOwnerActionState;
  detail: string;
  primaryActionLabel: "BUILD SITE" | "CONTINUE BUILD" | "REVIEW REQUIRED";
  routeHint: "BUILD" | "CREATIVE_REVIEW" | "GENERATION_READINESS" | "PAGE_REVIEW" | "PUBLICATION";
};

export type MaterialDiff = {
  material: boolean;
  changedFields: string[];
  summary: string;
};

export type CreativeReviewHandoffProjection = {
  lineageStale: boolean;
  materialDiffEvaluated: boolean;
  requiresOwnerReview: boolean;
  detail: string;
  materialDiff: MaterialDiff | null;
  proposedCandidate: CreativeDirectionProposal | null;
  proposedCandidateFingerprint: string | null;
  currentApprovedRevision: number | null;
  currentApprovedStrategyRevision: number | null;
  proposedStrategyRevision: number | null;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableSort(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function sameList(left: string[], right: string[]): boolean {
  return JSON.stringify(stableSort(left)) === JSON.stringify(stableSort(right));
}

function sameScalar(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}

export function compareCreativeDirectionMateriality(
  baseline: CreativeDirectionProposal | null,
  candidate: CreativeDirectionProposal,
): MaterialDiff {
  if (!baseline) {
    return {
      material: true,
      changedFields: ["creative_baseline_missing"],
      summary: "No previously approved Creative Direction baseline exists.",
    };
  }

  const changed: string[] = [];
  const checks: Array<[string, boolean]> = [
    ["overallDirection", sameScalar(baseline.overallDirection, candidate.overallDirection)],
    ["brandInterpretation", sameScalar(baseline.brandInterpretation, candidate.brandInterpretation)],
    ["colorDirection", sameScalar(baseline.colorDirection, candidate.colorDirection)],
    ["typographyDirection", sameScalar(baseline.typographyDirection, candidate.typographyDirection)],
    ["spacingLayoutDirection", sameScalar(baseline.spacingLayoutDirection, candidate.spacingLayoutDirection)],
    ["photographyStyle", sameScalar(baseline.photographyStyle, candidate.photographyStyle)],
    ["generatedImageStyle", sameScalar(baseline.generatedImageStyle, candidate.generatedImageStyle)],
    ["heroTreatment", sameScalar(baseline.heroTreatment, candidate.heroTreatment)],
    ["ctaTreatment", sameScalar(baseline.ctaTreatment, candidate.ctaTreatment)],
    ["trustProofPresentation", sameScalar(baseline.trustProofPresentation, candidate.trustProofPresentation)],
    ["productPresentation", sameScalar(baseline.productPresentation, candidate.productPresentation)],
    ["verticalPresentation", sameScalar(baseline.verticalPresentation, candidate.verticalPresentation)],
    ["mobileConsiderations", sameScalar(baseline.mobileConsiderations, candidate.mobileConsiderations)],
    ["visualDos", sameList(baseline.visualDos, candidate.visualDos)],
    ["visualDonts", sameList(baseline.visualDonts, candidate.visualDonts)],
    ["homepageBlueprint", sameList(baseline.homepageBlueprint, candidate.homepageBlueprint)],
  ];

  for (const [field, same] of checks) {
    if (!same) changed.push(field);
  }

  return {
    material: changed.length > 0,
    changedFields: changed,
    summary: changed.length ? `Material creative differences in: ${changed.join(", ")}.` : "Creative direction is materially equivalent.",
  };
}

function pageSignature(plan: SiteBuildPlanProposal): Array<{ pageType: string; slug: string; name: string; launchPhase: string; audience: string; purpose: string; authority: string[] }> {
  return plan.pages
    .map((page) => ({
      pageType: page.pageType,
      slug: page.slug,
      name: normalize(page.name),
      launchPhase: page.launchPhase,
      audience: normalize(page.primaryAudience),
      purpose: normalize(page.purpose),
      authority: stableSort(
        page.authority
          .filter((item) => item.kind !== "STRATEGY" && item.kind !== "CREATIVE")
          .map((item) => `${item.kind}:${item.referenceId}`),
      ),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug) || left.pageType.localeCompare(right.pageType));
}

export function compareBuildPlanMateriality(
  baseline: SiteBuildPlanProposal | null,
  candidate: SiteBuildPlanProposal,
): MaterialDiff {
  if (!baseline) {
    return {
      material: false,
      changedFields: [],
      summary: "No prior build plan baseline; derived directly from approved authority.",
    };
  }

  const left = pageSignature(baseline);
  const right = pageSignature(candidate);
  const same = JSON.stringify(left) === JSON.stringify(right);
  return {
    material: !same,
    changedFields: same ? [] : ["page_structure_or_scope"],
    summary: same
      ? "Build plan is materially equivalent after dependency refresh."
      : "Build plan materially changed page structure, scope, or conversion intent.",
  };
}

function ownerInterruptionQuestion(detail: string): string {
  return `What new decision does the owner need to make that Genesis cannot derive from already-approved authority? ${detail}`;
}

function projectedCreativeFingerprint(candidate: CreativeDirectionProposal): string {
  return createHash("sha256").update(JSON.stringify({
    strategyRevision: candidate.strategyRevision,
    overallDirection: candidate.overallDirection,
    brandInterpretation: candidate.brandInterpretation,
    colorDirection: candidate.colorDirection,
    typographyDirection: candidate.typographyDirection,
    spacingLayoutDirection: candidate.spacingLayoutDirection,
    photographyStyle: candidate.photographyStyle,
    generatedImageStyle: candidate.generatedImageStyle,
    heroTreatment: candidate.heroTreatment,
    ctaTreatment: candidate.ctaTreatment,
    trustProofPresentation: candidate.trustProofPresentation,
    productPresentation: candidate.productPresentation,
    verticalPresentation: candidate.verticalPresentation,
    mobileConsiderations: candidate.mobileConsiderations,
    visualDos: candidate.visualDos,
    visualDonts: candidate.visualDonts,
    homepageBlueprint: candidate.homepageBlueprint,
    imagePlan: candidate.imagePlan,
    reason: candidate.reason,
  })).digest("hex");
}

export function projectCreativeReviewHandoff(site: SiteConfiguration): CreativeReviewHandoffProjection {
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
  const currentApproved = [...(intelligence?.creativeRevisions ?? [])].filter((item) => item.status === "APPROVED").at(-1) ?? null;
  const creative = intelligence?.creativeRevisions.at(-1) ?? null;
  const lineageStale = Boolean(strategy && creative && creative.status === "APPROVED" && creative.strategyRevision !== strategy.revision);

  if (!lineageStale || !intelligence || !strategy || strategy.status !== "APPROVED") {
    return {
      lineageStale,
      materialDiffEvaluated: false,
      requiresOwnerReview: false,
      detail: "No stale creative lineage requiring owner review projection.",
      materialDiff: null,
      proposedCandidate: null,
      proposedCandidateFingerprint: null,
      currentApprovedRevision: currentApproved?.revision ?? null,
      currentApprovedStrategyRevision: currentApproved?.strategyRevision ?? null,
      proposedStrategyRevision: strategy?.revision ?? null,
    };
  }

  const synthesized = synthesizeCreativeDirection(intelligence);
  const projectedCandidate: CreativeDirectionProposal = {
    ...synthesized,
    revision: (intelligence.creativeRevisions.at(-1)?.revision ?? 0) + 1,
    status: "PROPOSED",
    createdBy: SYSTEM_ACTOR,
    createdAt: "PROJECTED_CANDIDATE",
    decidedBy: null,
    decidedAt: null,
  };
  const diff = compareCreativeDirectionMateriality(currentApproved, projectedCandidate);
  return {
    lineageStale: true,
    materialDiffEvaluated: true,
    requiresOwnerReview: diff.material,
    detail: diff.summary,
    materialDiff: diff,
    proposedCandidate: projectedCandidate,
    proposedCandidateFingerprint: projectedCreativeFingerprint(projectedCandidate),
    currentApprovedRevision: currentApproved?.revision ?? null,
    currentApprovedStrategyRevision: currentApproved?.strategyRevision ?? null,
    proposedStrategyRevision: strategy.revision,
  };
}

export function ensurePersistedProjectedCreativeCandidate(input: {
  site: SiteConfiguration;
  actor: string;
  reason: string;
}): { projection: CreativeReviewHandoffProjection; workspaceRevision: number; proposalRevision: number } {
  const projection = projectCreativeReviewHandoff(input.site);
  if (!projection.lineageStale || !projection.materialDiffEvaluated || !projection.proposedCandidate) {
    throw new Error("CREATIVE_REVIEW_NOT_REQUIRED");
  }

  const current = getSiteIntelligenceWorkspace(input.site.siteId);
  if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  const latest = current.creativeRevisions.at(-1);

  if (latest?.status === "PROPOSED" && latest.strategyRevision === projection.proposedStrategyRevision) {
    return { projection, workspaceRevision: current.revision, proposalRevision: latest.revision };
  }

  const create = latest?.status === "APPROVED" ? refreshApprovedCreativeProposal : addCreativeProposal;
  const refreshed = create({
    siteId: input.site.siteId,
    organizationId: input.site.organizationId,
    expectedRevision: current.revision,
    actor: input.actor,
    reason: input.reason,
    proposal: {
      strategyRevision: projection.proposedCandidate.strategyRevision,
      overallDirection: projection.proposedCandidate.overallDirection,
      brandInterpretation: projection.proposedCandidate.brandInterpretation,
      colorDirection: projection.proposedCandidate.colorDirection,
      typographyDirection: projection.proposedCandidate.typographyDirection,
      spacingLayoutDirection: projection.proposedCandidate.spacingLayoutDirection,
      photographyStyle: projection.proposedCandidate.photographyStyle,
      generatedImageStyle: projection.proposedCandidate.generatedImageStyle,
      heroTreatment: projection.proposedCandidate.heroTreatment,
      ctaTreatment: projection.proposedCandidate.ctaTreatment,
      trustProofPresentation: projection.proposedCandidate.trustProofPresentation,
      productPresentation: projection.proposedCandidate.productPresentation,
      verticalPresentation: projection.proposedCandidate.verticalPresentation,
      mobileConsiderations: projection.proposedCandidate.mobileConsiderations,
      visualDos: projection.proposedCandidate.visualDos,
      visualDonts: projection.proposedCandidate.visualDonts,
      homepageBlueprint: projection.proposedCandidate.homepageBlueprint,
      imagePlan: projection.proposedCandidate.imagePlan,
      reason: projection.proposedCandidate.reason,
    },
  });
  const proposed = refreshed.creativeRevisions.at(-1);
  if (!proposed || proposed.status !== "PROPOSED") throw new Error("CREATIVE_PROPOSAL_NOT_PERSISTED");
  return { projection, workspaceRevision: refreshed.revision, proposalRevision: proposed.revision };
}

function stop(result: Omit<ContinuationResult, "ownerInterruptionQuestion">): ContinuationResult {
  return {
    ...result,
    ownerInterruptionQuestion: ownerInterruptionQuestion(result.detail),
  };
}

export function projectThreeGateOwnerAction(site: SiteConfiguration): ThreeGateOwnerActionProjection {
  const generation = getSiteGenerationReadiness(site);
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
  const creative = intelligence?.creativeRevisions.at(-1) ?? null;
  const workspace = getSiteBuildWorkspace(site);
  const productAuthorityCheck = generation.readiness.checks.find((check) => check.key === "product_service_authority");
  const strategyCheck = generation.readiness.checks.find((check) => check.key === "strategy");

  if (!productAuthorityCheck?.passed) {
    return {
      ownerActionState: "OWNER_ACTION_REQUIRED",
      detail: productAuthorityCheck?.detail ?? "Product/service authority must be completed.",
      primaryActionLabel: "REVIEW REQUIRED",
      routeHint: "GENERATION_READINESS",
    };
  }

  if (!strategyCheck?.passed || !strategy || strategy.status !== "APPROVED") {
    return {
      ownerActionState: "OWNER_ACTION_REQUIRED",
      detail: strategyCheck?.detail ?? "Strategy approval is required.",
      primaryActionLabel: "REVIEW REQUIRED",
      routeHint: "CREATIVE_REVIEW",
    };
  }

  const creativeLineageCurrent = Boolean(creative && creative.status === "APPROVED" && creative.strategyRevision === strategy.revision);
  if (!creativeLineageCurrent) {
    const handoff = projectCreativeReviewHandoff(site);
    if (handoff.requiresOwnerReview) {
      return {
        ownerActionState: "OWNER_ACTION_REQUIRED",
        detail: handoff.detail,
        primaryActionLabel: "REVIEW REQUIRED",
        routeHint: "CREATIVE_REVIEW",
      };
    }
  }

  if (!generation.readiness.readyToCertify) {
    const unresolvedReadinessCheck = generation.readiness.checks.find((check) => !check.passed && check.key !== "creative_direction");
    if (unresolvedReadinessCheck) {
      return {
        ownerActionState: "OWNER_ACTION_REQUIRED",
        detail: unresolvedReadinessCheck.detail || generation.readiness.blockers[0] || "Generation readiness has unresolved blockers.",
        primaryActionLabel: "REVIEW REQUIRED",
        routeHint: "GENERATION_READINESS",
      };
    }
  }

  if (
    workspace.stage === "PAGE_REVIEW"
    || workspace.stage === "WORDPRESS_CONTENT_UPDATE"
    || workspace.stage === "WORDPRESS_DRAFT_REVIEW"
    || workspace.stage === "HOME_DESIGN_REVIEW"
    || workspace.stage === "SITE_VISUAL_REVIEW"
    || workspace.stage === "SITE_QA"
  ) {
    return {
      ownerActionState: "PAGE_REVIEW_REQUIRED",
      detail: "Draft output is ready for owner review.",
      primaryActionLabel: "REVIEW REQUIRED",
      routeHint: "PAGE_REVIEW",
    };
  }

  if (
    workspace.stage === "PUBLICATION_READINESS"
    || workspace.stage === "PUBLICATION_AUTHORIZATION"
    || workspace.stage === "PUBLICATION_EXECUTION_REVIEW"
    || workspace.stage === "PUBLICATION_EXECUTING"
    || workspace.stage === "PUBLICATION_VERIFICATION"
    || workspace.stage === "COMPLETE"
    || workspace.stage === "WORDPRESS_MENU_SYNC"
    || workspace.stage === "NAVIGATION_REVIEW"
  ) {
    return {
      ownerActionState: "PUBLICATION_BOUNDARY",
      detail: "Explicit owner publication boundaries apply.",
      primaryActionLabel: "REVIEW REQUIRED",
      routeHint: "PUBLICATION",
    };
  }

  return {
    ownerActionState: "READY_TO_CONTINUE",
    detail: "Genesis can deterministically continue from approved authority without new owner judgment.",
    primaryActionLabel: workspace.session ? "CONTINUE BUILD" : "BUILD SITE",
    routeHint: "BUILD",
  };
}

export async function continueSiteBuild(site: SiteConfiguration): Promise<ContinuationResult> {
  for (let step = 0; step < 25; step += 1) {
    const generation = getSiteGenerationReadiness(site);
    const intelligence = getSiteIntelligenceWorkspace(site.siteId);
    const strategy = intelligence?.strategyRevisions.at(-1) ?? null;
    const creative = intelligence?.creativeRevisions.at(-1) ?? null;
    const productAuthorityCheck = generation.readiness.checks.find((check) => check.key === "product_service_authority");
    const strategyCheck = generation.readiness.checks.find((check) => check.key === "strategy");

    if (!productAuthorityCheck?.passed) {
      return stop({
        stopReason: "OWNER_ACTION_REQUIRED",
        stage: getSiteBuildWorkspace(site).stage,
        detail: productAuthorityCheck?.detail ?? "Product/service authority is not fully approved.",
        ownerReviewRequired: true,
      });
    }

    if (!strategyCheck?.passed || !strategy || strategy.status !== "APPROVED") {
      return stop({
        stopReason: "OWNER_ACTION_REQUIRED",
        stage: getSiteBuildWorkspace(site).stage,
        detail: strategyCheck?.detail ?? "Strategy is not approved.",
        ownerReviewRequired: true,
      });
    }

    const creativeLineageCurrent = Boolean(creative && creative.status === "APPROVED" && creative.strategyRevision === strategy.revision);
    if (!creativeLineageCurrent) {
      if (!intelligence) {
        return stop({
          stopReason: "OWNER_ACTION_REQUIRED",
          stage: getSiteBuildWorkspace(site).stage,
          detail: "Site intelligence workspace is unavailable.",
          ownerReviewRequired: true,
        });
      }

      const handoff = projectCreativeReviewHandoff(site);
      if (!handoff.materialDiffEvaluated || !handoff.materialDiff || !handoff.proposedCandidate) {
        return stop({
          stopReason: "HARD_SAFETY_STOP",
          stage: getSiteBuildWorkspace(site).stage,
          detail: "Creative synthesis did not produce a reviewable candidate.",
          ownerReviewRequired: true,
        });
      }

      const diff = handoff.materialDiff;
      const ownerReviewRequired = diff.material;

      let proposalRevision: number | null = null;
      let workspaceRevision: number | null = null;
      if (ownerReviewRequired) {
        const persisted = ensurePersistedProjectedCreativeCandidate({
          site,
          actor: SYSTEM_ACTOR,
          reason: "System continuation persisted material Creative Direction review candidate.",
        });
        proposalRevision = persisted.proposalRevision;
        workspaceRevision = persisted.workspaceRevision;
      }

      recordSystemContinuationEvent({
        organizationId: site.organizationId,
        siteId: site.siteId,
        stage: "creative_direction",
        action: ownerReviewRequired ? "REVIEW_REQUIRED" : "CARRY_FORWARD_APPROVAL",
        priorRevision: handoff.currentApprovedRevision,
        newRevision: ownerReviewRequired ? proposalRevision : handoff.currentApprovedRevision,
        reason: ownerReviewRequired
          ? "Creative changed materially after strategy lineage rebase."
          : "Creative is materially equivalent after lineage rebase.",
        materialDiff: diff,
        authorityFingerprint: generation.readiness.snapshot,
        ownerReviewRequired,
        actor: SYSTEM_ACTOR,
      });

      if (ownerReviewRequired) {
        return stop({
          stopReason: "CREATIVE_REVIEW_REQUIRED",
          stage: getSiteBuildWorkspace(site).stage,
          detail: diff.summary,
          ownerReviewRequired: true,
        });
      }

      const persisted = ensurePersistedProjectedCreativeCandidate({
        site,
        actor: SYSTEM_ACTOR,
        reason: "System continuation persisted equivalent Creative Direction lineage refresh.",
      });

      decideCreativeProposal({
        siteId: site.siteId,
        organizationId: site.organizationId,
        expectedRevision: persisted.workspaceRevision,
        actor: SYSTEM_ACTOR,
        reason: "System continuation carried forward equivalent Creative Direction approval.",
        decision: "APPROVED",
      });
      continue;
    }

    if (!generation.readiness.readyToCertify) {
      return stop({
        stopReason: "OWNER_ACTION_REQUIRED",
        stage: getSiteBuildWorkspace(site).stage,
        detail: generation.readiness.blockers[0] ?? "Generation Readiness is blocked.",
        ownerReviewRequired: true,
      });
    }

    if (generation.certification.status !== "CURRENT" || !generation.certification.certification) {
      const priorRevision = generation.certification.certification?.revision ?? null;
      const certification = certifyGenerationReadiness({
        organizationId: site.organizationId,
        siteId: site.siteId,
        actor: SYSTEM_ACTOR,
        readiness: generation.readiness,
      });
      recordSystemContinuationEvent({
        organizationId: site.organizationId,
        siteId: site.siteId,
        stage: "generation_readiness",
        action: "AUTO_CERTIFY",
        priorRevision,
        newRevision: certification.revision,
        reason: "All readiness predicates pass for current approved authority.",
        materialDiff: { material: false, changedFields: [], summary: "Deterministic certification refresh." },
        authorityFingerprint: generation.readiness.snapshot,
        ownerReviewRequired: false,
        actor: SYSTEM_ACTOR,
      });
      continue;
    }

    const workspace = getSiteBuildWorkspace(site);

    if (!workspace.session) {
      startSiteBuild({
        organizationId: site.organizationId,
        siteId: site.siteId,
        actor: SYSTEM_ACTOR,
        certification: generation.certification.certification,
      });
      recordSystemContinuationEvent({
        organizationId: site.organizationId,
        siteId: site.siteId,
        stage: "site_build",
        action: "START_SESSION",
        priorRevision: null,
        newRevision: null,
        reason: "Build gate authorized deterministic continuation.",
        materialDiff: { material: false, changedFields: [], summary: "Build session bootstrap." },
        authorityFingerprint: generation.readiness.snapshot,
        ownerReviewRequired: false,
        actor: SYSTEM_ACTOR,
      });
      continue;
    }

    if (workspace.stage === "BUILD_PLAN" || workspace.stage === "BUILD_PLAN_STALE" || workspace.stage === "BUILD_PLAN_REVIEW") {
      const baseline =
        workspace.plans
          .filter((item) => item.status === "APPROVED")
          .sort((left, right) => left.revision - right.revision)
          .at(-1)
        ?? workspace.currentPlan
        ?? null;

      if (workspace.stage === "BUILD_PLAN" || workspace.stage === "BUILD_PLAN_STALE") {
        generateBuildPlan(site, SYSTEM_ACTOR);
      }

      const refreshed = getSiteBuildWorkspace(site);
      const proposed = refreshed.currentPlan;
      if (!proposed || proposed.status !== "PROPOSED") {
        continue;
      }

      const diff = compareBuildPlanMateriality(baseline, proposed);
      const ownerReviewRequired = diff.material;

      recordSystemContinuationEvent({
        organizationId: site.organizationId,
        siteId: site.siteId,
        stage: "build_plan",
        action: ownerReviewRequired ? "REVIEW_REQUIRED" : "CARRY_FORWARD_APPROVAL",
        priorRevision: baseline?.revision ?? null,
        newRevision: proposed.revision,
        reason: ownerReviewRequired
          ? "Build plan materially changed."
          : "Build plan is equivalent or dependency-only refresh.",
        materialDiff: diff,
        authorityFingerprint: generation.readiness.snapshot,
        ownerReviewRequired,
        actor: SYSTEM_ACTOR,
      });

      if (ownerReviewRequired) {
        return stop({
          stopReason: "BUILD_PLAN_REVIEW_REQUIRED",
          stage: refreshed.stage,
          detail: diff.summary,
          ownerReviewRequired: true,
        });
      }

      approveBuildPlan(site, SYSTEM_ACTOR, "System continuation auto-approved an equivalent deterministic build plan.");
      continue;
    }

    if (workspace.stage === "DRAFT_GENERATION") {
      generateBuildDrafts(site, SYSTEM_ACTOR);
      continue;
    }

    if (workspace.stage === "DRAFT_REVIEW") {
      approveBuildDrafts(site, SYSTEM_ACTOR);
      continue;
    }

    if (workspace.stage === "WORDPRESS_DRAFTS") {
      await createBuildWordPressDrafts(site);
      continue;
    }

    if (workspace.stage === "PAGE_GENERATION") {
      generateFullSiteAssembly(site, SYSTEM_ACTOR);
      continue;
    }

    if (workspace.stage === "PAGE_REVIEW") {
      return stop({
        stopReason: "PAGE_REVIEW_REQUIRED",
        stage: workspace.stage,
        detail: "Draft pages are generated and ready for owner review.",
        ownerReviewRequired: true,
      });
    }

    if (
      workspace.stage === "WORDPRESS_CONTENT_UPDATE"
      || workspace.stage === "WORDPRESS_DRAFT_REVIEW"
      || workspace.stage === "HOME_DESIGN_REVIEW"
      || workspace.stage === "SITE_VISUAL_REVIEW"
      || workspace.stage === "SITE_QA"
    ) {
      return stop({
        stopReason: "REVIEW_OUTPUT_READY",
        stage: workspace.stage,
        detail: "Generated draft output is ready for owner inspection.",
        ownerReviewRequired: true,
      });
    }

    if (
      workspace.stage === "PUBLICATION_READINESS"
      || workspace.stage === "PUBLICATION_AUTHORIZATION"
      || workspace.stage === "PUBLICATION_EXECUTION_REVIEW"
      || workspace.stage === "PUBLICATION_EXECUTING"
      || workspace.stage === "PUBLICATION_VERIFICATION"
      || workspace.stage === "COMPLETE"
      || workspace.stage === "WORDPRESS_MENU_SYNC"
      || workspace.stage === "NAVIGATION_REVIEW"
    ) {
      return stop({
        stopReason: "PUBLICATION_BOUNDARY",
        stage: workspace.stage,
        detail: "Explicit owner publication and final-governance boundaries remain required.",
        ownerReviewRequired: true,
      });
    }

    if (workspace.stage === "AUTHORITY_REVIEW_REQUIRED") {
      return stop({
        stopReason: "OWNER_ACTION_REQUIRED",
        stage: workspace.stage,
        detail: "Generation authority state requires owner resolution.",
        ownerReviewRequired: true,
      });
    }

    return stop({
      stopReason: "HARD_SAFETY_STOP",
      stage: workspace.stage,
      detail: `Unhandled site build stage: ${workspace.stage}`,
      ownerReviewRequired: true,
    });
  }

  return stop({
    stopReason: "HARD_SAFETY_STOP",
    stage: getSiteBuildWorkspace(site).stage,
    detail: "Continuation iteration limit reached.",
    ownerReviewRequired: true,
  });
}
