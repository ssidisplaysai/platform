import type { SitePageImageCandidate } from "./site-page-image-candidate-repository";
import type { SiteAssemblyProposal, SiteGeneratedPageRevision } from "./site-page-generation";

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

export function summarizeSitePageReview(assembly: SiteAssemblyProposal | null, candidates: SitePageImageCandidate[]) {
  const pages = assembly?.pages ?? [];
  const ownerApprovedPageCount = pages.filter((page) => page.status === "APPROVED").length;
  const blockedPageCount = pages.filter((page) => !page.quality.ready).length;
  const requiredImageApprovalComplete = pages.every((page) => areRequiredPageImagesApproved(page, candidates));
  return {
    generatedPageCount: pages.length,
    ownerApprovedPageCount,
    blockedPageCount,
    requiredImageApprovalComplete,
    complete: pages.length > 0 && ownerApprovedPageCount === pages.length && blockedPageCount === 0 && requiredImageApprovalComplete,
  };
}