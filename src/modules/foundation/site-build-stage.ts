export type SiteBuildStage = "BUILD_NOT_STARTED" | "BUILD_PLAN" | "BUILD_PLAN_REVIEW" | "DRAFT_GENERATION" | "DRAFT_REVIEW" | "WORDPRESS_DRAFTS" | "PAGE_GENERATION" | "PAGE_REVIEW" | "WORDPRESS_CONTENT_UPDATE" | "WORDPRESS_DRAFT_REVIEW" | "HOME_DESIGN_REVIEW" | "SITE_VISUAL_REVIEW" | "COMPLETE" | "AUTHORITY_REVIEW_REQUIRED";

export function resolveSiteBuildStage(input: {
  sessionStarted: boolean;
  stale: boolean;
  planStatus: "PROPOSED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED" | null;
  draftStatus: "GENERATED" | "APPROVED" | null;
  expectedDraftCount: number;
  wordpressDraftCount: number;
  assemblyPresent: boolean;
  pageReviewComplete: boolean;
  generatedPageCount: number;
  wordpressContentUpdateCount: number;
}): SiteBuildStage {
  if (!input.sessionStarted) return "BUILD_NOT_STARTED";
  if (input.stale) return "AUTHORITY_REVIEW_REQUIRED";
  if (!input.planStatus || input.planStatus === "REJECTED") return "BUILD_PLAN";
  if (input.planStatus === "PROPOSED") return "BUILD_PLAN_REVIEW";
  if (input.planStatus !== "APPROVED" || !input.draftStatus) return "DRAFT_GENERATION";
  if (input.draftStatus === "GENERATED") return "DRAFT_REVIEW";
  if (input.wordpressDraftCount < input.expectedDraftCount) return "WORDPRESS_DRAFTS";
  if (!input.assemblyPresent) return "PAGE_GENERATION";
  if (!input.pageReviewComplete) return "PAGE_REVIEW";
  if (input.wordpressContentUpdateCount < input.generatedPageCount) return "WORDPRESS_CONTENT_UPDATE";
  return "WORDPRESS_DRAFT_REVIEW";
}