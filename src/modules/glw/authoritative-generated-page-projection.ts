import { renderedVisualPublicationEligible, type RenderedVisualCertification, type RenderedVisualOwnerDecision } from "@/modules/foundation/rendered-visual-certification";
import type { GlwCampaignTarget } from "./campaign-target-repository";
import type { GlwPageExecutionRecord } from "./page-execution";

export type AuthoritativeGeneratedPageProjection = {
  target: GlwCampaignTarget;
  certification: RenderedVisualCertification | null;
  pageRevisionIdentity: string;
  contextualBuildSessionId: string;
  productAuthorityRendered: boolean;
  contextualMedia: readonly {
    assignmentId: string | null;
    role: string;
    semanticRole: string;
    mediaId: string;
    rendered: boolean;
  }[];
};

export function projectAuthoritativeGeneratedPage(input: {
  target: GlwCampaignTarget;
  job: GlwPageExecutionRecord;
  certifications: readonly RenderedVisualCertification[];
  ownerDecisions: readonly RenderedVisualOwnerDecision[];
}): AuthoritativeGeneratedPageProjection {
  const certification = input.certifications.filter((candidate) =>
    candidate.identity.organizationId === input.target.organizationId
    && candidate.identity.siteId === input.target.siteId
    && candidate.identity.targetId === input.target.targetId
    && (candidate.identity.wordpressStatus === "publish" || (candidate.identity.jobId === input.job.jobId && candidate.identity.externalExecutionId === input.job.externalExecutionId))
    && candidate.identity.wordpressObjectId
    && candidate.overallState === "PASS"
  ).sort((left, right) => left.capturedAt.localeCompare(right.capturedAt)).at(-1) ?? null;
  const ownerDecision = certification ? input.ownerDecisions.filter((candidate) => candidate.certificationId === certification.certificationId).at(-1) ?? null : null;
  const draftReady = certification?.identity.wordpressStatus === "draft" && renderedVisualPublicationEligible({ certification, decision: ownerDecision, currentIdentity: certification.identity });
  const target = certification && input.target.status !== "published" && (certification.identity.wordpressStatus === "publish" || draftReady)
    ? { ...input.target, status: certification.identity.wordpressStatus === "publish" ? "published" as const : "draft_ready" as const, wordpressObjectId: certification.identity.wordpressObjectId }
    : input.target;
  const productAuthorityMediaIds = certification?.captures[0]?.media
    .filter((media) => media.semanticRole === "PRODUCT_AUTHORITY" && media.mediaId)
    .map((media) => media.mediaId!) ?? [];
  const productAuthorityRendered = productAuthorityMediaIds.some((mediaId) =>
    certification?.captures.every((capture) => capture.media.some((candidate) => candidate.mediaId === mediaId && candidate.rendered)) === true);
  const contextualMedia = certification?.captures[0]?.media
    .filter((media) => media.mediaId && media.semanticRole !== "PRODUCT_AUTHORITY")
    .map((media) => ({
      assignmentId: media.assignmentId,
      role: media.contextId ?? media.semanticRole,
      semanticRole: media.semanticRole,
      mediaId: media.mediaId!,
      rendered: certification.captures.every((capture) => capture.media.some((candidate) => candidate.mediaId === media.mediaId && candidate.rendered)),
    })) ?? [];
  return {
    target,
    certification,
    pageRevisionIdentity: certification?.identity.pageRevisionIdentity ?? `job:${input.job.jobId}:${input.job.updatedAt}`,
    contextualBuildSessionId: certification ? `contextual-media:${input.target.targetId}` : `glw-job:${input.job.jobId}`,
    productAuthorityRendered,
    contextualMedia,
  };
}
