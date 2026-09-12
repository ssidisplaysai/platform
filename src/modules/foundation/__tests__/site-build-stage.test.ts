import { resolveSiteBuildStage, resolveSiteBuildVisualContinuation } from "../site-build-stage";

const completeReview = { sessionStarted: true, stale: false, planStatus: "APPROVED" as const, draftStatus: "APPROVED" as const, expectedDraftCount: 2, wordpressDraftCount: 2, assemblyPresent: true, pageReviewComplete: true, generatedPageCount: 2, wordpressContentUpdateCount: 0 };

describe("Site Build stage transition", () => {
  test("keeps incomplete page or image review in owner review", () => {
    expect(resolveSiteBuildStage({ ...completeReview, pageReviewComplete: false })).toBe("PAGE_REVIEW");
  });

  test("advances completed review to explicit WordPress content update", () => {
    expect(resolveSiteBuildStage(completeReview)).toBe("WORDPRESS_CONTENT_UPDATE");
    expect(resolveSiteBuildStage({ ...completeReview, wordpressContentUpdateCount: 2 })).toBe("WORDPRESS_DRAFT_REVIEW");
  });

  test("advances approved Home to the remaining-design review from durable state", () => {
    expect(resolveSiteBuildVisualContinuation({ baseStage: "WORDPRESS_DRAFT_REVIEW", homeStatus: "APPROVED", remaining: { expected: 14, assembled: 14, approved: 0 } })).toEqual({
      stage: "SITE_VISUAL_REVIEW",
      action: "REVIEW_REMAINING_DESIGNS",
      label: "REVIEW REMAINING 14 DESIGNS",
      detail: "Review 14 page-specific visual assemblies before site QA or publication.",
      path: "designs",
    });
  });

  test("advances all approved designs to Site QA without a publication action", () => {
    const result = resolveSiteBuildVisualContinuation({ baseStage: "WORDPRESS_DRAFT_REVIEW", homeStatus: "APPROVED", remaining: { expected: 14, assembled: 14, approved: 14 } });
    expect(result).toMatchObject({ stage: "SITE_QA", action: "REVIEW_SITE_QA", path: "site-qa" });
    expect(JSON.stringify(result)).not.toMatch(/publish_pages|enable_site|publish_navigation/i);
  });
});