import type { SitePageImageCandidate } from "./site-page-image-candidate-repository";
import type { SiteAssemblyProposal, SiteGeneratedPageRevision } from "./site-page-generation";
export function selectApprovedSitePageImageCandidate(input: {
  page: Pick<SiteGeneratedPageRevision, "pageId" | "pageRevisionId">;
  slotId: string;
  candidates: readonly SitePageImageCandidate[];
}): SitePageImageCandidate | null {
  const latest = input.candidates
    .filter((candidate) =>
      candidate.pageId === input.page.pageId
      && candidate.pageRevisionId === input.page.pageRevisionId
      && candidate.slotId === input.slotId)
    .sort((left, right) => left.revision - right.revision)
    .at(-1) ?? null;
  return latest?.status === "APPROVED" ? latest : null;
}

export function areRequiredPageImagesApproved(page: SiteGeneratedPageRevision, candidates: SitePageImageCandidate[]): boolean {
  return page.imageRequirements.every((slot) => {
    if (slot.status === "READY" && slot.publishableAssetId) return true;
    return Boolean(selectApprovedSitePageImageCandidate({ page, slotId: slot.slotId, candidates }));
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