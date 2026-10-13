import "server-only";

import { candidateMediaDataUrls, getIndianaRichReferenceCandidate, renderIndianaRichReferenceWordPressContent } from "./indiana-rich-reference-candidate";

export function resolveApprovedRichReferenceSource(candidateId: string) {
  const candidate = getIndianaRichReferenceCandidate(candidateId);
  if (!candidate || candidate.status !== "READY_FOR_VISUAL_CERTIFICATION") return null;
  return {
    productId: candidate.productId,
    contentHtml: renderIndianaRichReferenceWordPressContent(candidate),
    mediaAssignments: candidate.plan.mediaAssignments.map((assignment) => {
      const media = candidateMediaDataUrls(candidate).find((item) => item.assignmentId === assignment.assignmentId);
      if (!media || assignment.asset.type !== "APPROVED_EXISTING") throw new Error("APPROVED_RICH_REFERENCE_MEDIA_STALE");
      return { ...assignment, asset: { ...assignment.asset, url: media.dataUrl } };
    }),
  };
}
