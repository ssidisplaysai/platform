export type SiteBuildStage = "BUILD_NOT_STARTED" | "BUILD_PLAN" | "BUILD_PLAN_REVIEW" | "DRAFT_GENERATION" | "DRAFT_REVIEW" | "WORDPRESS_DRAFTS" | "PAGE_GENERATION" | "PAGE_REVIEW" | "WORDPRESS_CONTENT_UPDATE" | "WORDPRESS_DRAFT_REVIEW" | "HOME_DESIGN_REVIEW" | "SITE_VISUAL_REVIEW" | "SITE_QA" | "COMPLETE" | "AUTHORITY_REVIEW_REQUIRED";

export type SiteBuildVisualContinuation = {
  stage: "HOME_DESIGN_REVIEW" | "SITE_VISUAL_REVIEW" | "SITE_QA";
  action: "REVIEW_DESIGNED_HOME" | "REVIEW_REMAINING_DESIGNS" | "REVIEW_SITE_QA";
  label: string;
  detail: string;
  path: "home-design" | "designs" | "site-qa";
};

export function resolveSiteBuildVisualContinuation(input: {
  baseStage: SiteBuildStage;
  homeStatus: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REVISION_REQUESTED" | null;
  remaining: { expected: number; assembled: number; approved: number };
}): SiteBuildVisualContinuation | null {
  if (input.baseStage !== "WORDPRESS_DRAFT_REVIEW") return null;
  if (input.homeStatus === "READY_FOR_OWNER_REVIEW") return { stage: "HOME_DESIGN_REVIEW", action: "REVIEW_DESIGNED_HOME", label: "REVIEW DESIGNED HOME", detail: "Review the rendered Home visual assembly before any design is propagated to the remaining pages.", path: "home-design" };
  if (input.homeStatus !== "APPROVED" || input.remaining.expected === 0) return null;
  if (input.remaining.approved === input.remaining.expected) return { stage: "SITE_QA", action: "REVIEW_SITE_QA", label: "REVIEW SITE QA", detail: "All page designs are approved. Verify the exact drafts, media, SEO, links, and publication safeguards.", path: "site-qa" };
  if (input.remaining.assembled === input.remaining.expected) return { stage: "SITE_VISUAL_REVIEW", action: "REVIEW_REMAINING_DESIGNS", label: `REVIEW REMAINING ${input.remaining.expected} DESIGNS`, detail: `Review ${input.remaining.assembled} page-specific visual assemblies before site QA or publication.`, path: "designs" };
  return null;
}

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