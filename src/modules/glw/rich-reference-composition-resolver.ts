import "server-only";

import { getLocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { listRenderedVisualCertifications } from "@/modules/foundation/rendered-visual-certification-repository";
import { listSitePageMediaAssignments } from "@/modules/foundation/site-page-media-assignment";
import type { GlwCampaign } from "./campaign-types";
import type { GlwPageExecutionRecord } from "./page-execution";
import { evaluateGlwRichReferenceReadiness } from "./rich-reference-composition";

export function resolveGlwRichReferenceReadiness(input: {
  campaign: GlwCampaign;
  job: GlwPageExecutionRecord;
  approvedProductMediaAvailable: boolean;
}) {
  if (!input.job.generatedDraft) return null;
  const bundle = getLocalPageThemingBundle({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    jobId: input.job.jobId,
  });
  const pageRevisionId = bundle?.context.identity.pageRevisionIdentity
    ?? `job:${input.job.jobId}:${input.job.updatedAt}`;
  const mediaAssignments = bundle
    ? listSitePageMediaAssignments({
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        buildSessionId: bundle.bundleId,
        pageRevisionId,
      })
    : [];
  const visualCertification = listRenderedVisualCertifications({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
  }).filter((certification) => certification.identity.jobId === input.job.jobId
    && certification.identity.pageRevisionIdentity === pageRevisionId
    && certification.identity.contentHash === input.job.canonicalizationReceipt?.canonicalizedArtifactSha256)
    .at(-1) ?? null;
  return evaluateGlwRichReferenceReadiness({
    artifact: input.job.generatedDraft,
    compositionPlan: bundle?.composition ?? null,
    mediaAssignments,
    pageRevisionId,
    approvedProductMediaAvailable: input.approvedProductMediaAvailable,
    comparisonAuthority: { mode: "EVALUATION_FRAMEWORK", authorizedCellTexts: [] },
    visualCertification,
  });
}
