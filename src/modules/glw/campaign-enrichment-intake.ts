import "server-only";

import {
  listGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";

import {
  buildGlwStateServiceResearchPlan,
  type GlwStateServiceResearchPlan,
} from "@/modules/glw/site-enrichment-research-planner";

import {
  getGlwSiteEnrichmentRecord,
  initializeGlwSiteEnrichmentRecord,
  type GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";

import {
  GLW_CAMPAIGN_US_STATES,
} from "@/modules/glw/campaign-geography";

export type GlwDraftEnrichmentIntakeTarget = {
  targetId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  campaignId: string;
  stateCode: string;
  stateName: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
};

export type GlwDraftEnrichmentIntakePreview = {
  campaignId: string;
  eligibleCount: number;
  alreadyInitializedCount: number;
  pendingInitializationCount: number;
  targets: readonly {
    target: GlwDraftEnrichmentIntakeTarget;
    researchPlan: GlwStateServiceResearchPlan;
    alreadyInitialized: boolean;
  }[];
};

export type GlwDraftEnrichmentIntakeResult = {
  campaignId: string;
  initializedCount: number;
  existingCount: number;
  records:
    readonly GlwSiteEnrichmentRecord[];
  wordpressMutationPerformed: false;
  generationPerformed: false;
  publicationPerformed: false;
};

function normalizeDomain(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function stateNameForCode(
  stateCode: string,
): string {
  const normalized =
    stateCode.trim().toUpperCase();

  const state =
    GLW_CAMPAIGN_US_STATES.find(
      (candidate) =>
        candidate.code === normalized,
    );

  if (!state) {
    throw new Error(
      `Unknown campaign state code: ${normalized}`,
    );
  }

  return state.name;
}

function canonicalPathForTarget(
  input: {
    productSlug: string;
    stateCode: string;
  },
): string {
  const state =
    GLW_CAMPAIGN_US_STATES.find(
      (candidate) =>
        candidate.code
        === input.stateCode
          .trim()
          .toUpperCase(),
    );

  if (!state) {
    throw new Error(
      `Unknown campaign state code: ${input.stateCode}`,
    );
  }

  const productSlug =
    input.productSlug
      .trim()
      .replace(/^\/+|\/+$/g, "");

  if (!productSlug) {
    throw new Error(
      "Product slug is required for enrichment intake.",
    );
  }

  return `/${productSlug}/${state.slug}/`;
}

export function buildGlwDraftEnrichmentIntakeTarget(
  input: {
    targetId: string;
    organizationId: string;
    siteId: string;
    productId: string;
    campaignId: string;
    stateCode: string;
    productSlug: string;
    jobId: string | null | undefined;
    wordpressObjectId:
      string | number | null | undefined;
  },
): GlwDraftEnrichmentIntakeTarget {
  const jobId =
    input.jobId?.trim() ?? "";

  const wordpressObjectId =
    String(
      input.wordpressObjectId ?? "",
    ).trim();

  if (!jobId) {
    throw new Error(
      "Draft-ready target is missing its exact generation job ID.",
    );
  }

  if (!wordpressObjectId) {
    throw new Error(
      "Draft-ready target is missing its exact WordPress draft ID.",
    );
  }

  return {
    targetId: input.targetId,
    organizationId:
      input.organizationId,
    siteId: input.siteId,
    productId: input.productId,
    campaignId: input.campaignId,
    stateCode:
      input.stateCode
        .trim()
        .toUpperCase(),
    stateName:
      stateNameForCode(
        input.stateCode,
      ),
    canonicalPath:
      canonicalPathForTarget({
        productSlug:
          input.productSlug,
        stateCode:
          input.stateCode,
      }),
    jobId,
    wordpressObjectId,
  };
}

export function buildGlwDraftEnrichmentResearchPlan(
  input: {
    target:
      GlwDraftEnrichmentIntakeTarget;
    siteDomain: string;
    productTopic: string;
    upstreamAuthorityDomains:
      readonly string[];
  },
): GlwStateServiceResearchPlan {
  return buildGlwStateServiceResearchPlan({
    organizationId:
      input.target.organizationId,
    siteId:
      input.target.siteId,
    siteDomain:
      normalizeDomain(
        input.siteDomain,
      ),
    productId:
      input.target.productId,
    productTopic:
      input.productTopic,
    campaignId:
      input.target.campaignId,
    stateCode:
      input.target.stateCode,
    stateName:
      input.target.stateName,
    canonicalPath:
      input.target.canonicalPath,
    jobId:
      input.target.jobId,
    wordpressObjectId:
      input.target.wordpressObjectId,
    upstreamAuthorityDomains:
      input.upstreamAuthorityDomains,
  });
}

export function previewGlwDraftEnrichmentIntake(
  input: {
    organizationId: string;
    siteId: string;
    campaignId: string;
    productId: string;
    productSlug: string;
    productTopic: string;
    siteDomain: string;
    upstreamAuthorityDomains:
      readonly string[];
  },
): GlwDraftEnrichmentIntakePreview {
  const campaignTargets =
    listGlwCampaignTargets(
      input.campaignId,
    );

  const eligible =
    campaignTargets.filter(
      (target) =>
        target.organizationId
          === input.organizationId
        && target.siteId
          === input.siteId
        && target.productId
          === input.productId
        && target.status
          === "draft_ready",
    );

  const targets =
    eligible.map((target) => {
      const exactTarget =
        listGlwCampaignTargets(
          input.campaignId,
        ).find(
          (candidate) =>
            candidate.stateCode
              === target.stateCode
            && candidate.targetId
              === target.targetId,
        );

      if (
        !exactTarget
        || exactTarget.status
          !== "draft_ready"
        || exactTarget.organizationId
          !== target.organizationId
        || exactTarget.siteId
          !== target.siteId
        || exactTarget.productId
          !== target.productId
        || exactTarget.jobId
          !== target.jobId
        || exactTarget.wordpressObjectId
          !== target.wordpressObjectId
      ) {
        throw new Error(
          `Campaign target identity changed during enrichment intake preview: ${target.stateCode}`,
        );
      }

      const intakeTarget =
        buildGlwDraftEnrichmentIntakeTarget({
          targetId:
            exactTarget.targetId,
          organizationId:
            exactTarget.organizationId,
          siteId:
            exactTarget.siteId,
          productId:
            exactTarget.productId,
          campaignId:
            exactTarget.campaignId,
          stateCode:
            exactTarget.stateCode,
          productSlug:
            input.productSlug,
          jobId:
            exactTarget.jobId,
          wordpressObjectId:
            exactTarget.wordpressObjectId,
        });

      const researchPlan =
        buildGlwDraftEnrichmentResearchPlan({
          target: intakeTarget,
          siteDomain:
            input.siteDomain,
          productTopic:
            input.productTopic,
          upstreamAuthorityDomains:
            input.upstreamAuthorityDomains,
        });

      const existing =
        getGlwSiteEnrichmentRecord({
          siteId:
            intakeTarget.siteId,
          canonicalPath:
            intakeTarget.canonicalPath,
        });

      if (
        existing
        && (
          existing.jobId
            !== intakeTarget.jobId
          || existing.wordpressObjectId
            !== intakeTarget.wordpressObjectId
          || existing.campaignId
            !== intakeTarget.campaignId
          || existing.productId
            !== intakeTarget.productId
        )
      ) {
        throw new Error(
          `Existing enrichment identity does not match draft-ready campaign target: ${intakeTarget.stateCode}`,
        );
      }

      return {
        target: intakeTarget,
        researchPlan,
        alreadyInitialized:
          Boolean(existing),
      };
    });

  return {
    campaignId:
      input.campaignId,
    eligibleCount:
      targets.length,
    alreadyInitializedCount:
      targets.filter(
        (target) =>
          target.alreadyInitialized,
      ).length,
    pendingInitializationCount:
      targets.filter(
        (target) =>
          !target.alreadyInitialized,
      ).length,
    targets,
  };
}

export function initializeGlwDraftEnrichmentIntake(
  input: {
    organizationId: string;
    siteId: string;
    campaignId: string;
    productId: string;
    productSlug: string;
    productTopic: string;
    siteDomain: string;
    upstreamAuthorityDomains:
      readonly string[];
    now?: Date;
  },
): GlwDraftEnrichmentIntakeResult {
  const preview =
    previewGlwDraftEnrichmentIntake(
      input,
    );

  const records:
    GlwSiteEnrichmentRecord[] = [];

  let initializedCount = 0;
  let existingCount = 0;

  for (const candidate of preview.targets) {
    if (candidate.alreadyInitialized) {
      const existing =
        getGlwSiteEnrichmentRecord({
          siteId:
            candidate.target.siteId,
          canonicalPath:
            candidate.target.canonicalPath,
        });

      if (!existing) {
        throw new Error(
          "Enrichment record disappeared during intake.",
        );
      }

      existingCount += 1;
      records.push(existing);
      continue;
    }

    const record =
      initializeGlwSiteEnrichmentRecord({
        enrichmentId:
          candidate.researchPlan.enrichmentId,
        organizationId:
          candidate.researchPlan.organizationId,
        siteId:
          candidate.researchPlan.siteId,
        productId:
          candidate.researchPlan.productId,
        campaignId:
          candidate.researchPlan.campaignId,
        stateCode:
          candidate.researchPlan.stateCode,
        canonicalPath:
          candidate.researchPlan.canonicalPath,
        jobId:
          candidate.researchPlan.jobId,
        wordpressObjectId:
          candidate.researchPlan.wordpressObjectId,
        upstreamAuthorityDomains:
          candidate.researchPlan.upstreamAuthorityDomains,
        researchRequirements:
          candidate.researchPlan.researchRequirements,
        plan:
          candidate.researchPlan.emptyPlan,
        now: input.now,
      });

    initializedCount += 1;
    records.push(record);
  }

  return {
    campaignId:
      input.campaignId,
    initializedCount,
    existingCount,
    records,
    wordpressMutationPerformed:
      false,
    generationPerformed:
      false,
    publicationPerformed:
      false,
  };
}