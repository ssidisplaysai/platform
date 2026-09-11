import type { SitePageImageCandidate } from "./site-page-image-candidate-repository";
import type { SiteGeneratedPageRevision } from "./site-page-generation";

export function areRequiredPageImagesApproved(page: SiteGeneratedPageRevision, candidates: SitePageImageCandidate[]): boolean {
  return page.imageRequirements.every((slot) => {
    if (slot.status === "READY" && slot.publishableAssetId) return true;
    const latest = candidates
      .filter((candidate) => candidate.pageId === page.pageId && candidate.pageRevisionId === page.pageRevisionId && candidate.slotId === slot.slotId)
      .sort((left, right) => left.revision - right.revision)
      .at(-1);
    return latest?.status === "APPROVED";
  });
}