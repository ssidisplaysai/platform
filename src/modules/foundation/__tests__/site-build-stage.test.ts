import { resolveSiteBuildStage } from "../site-build-stage";

const completeReview = { sessionStarted: true, stale: false, planStatus: "APPROVED" as const, draftStatus: "APPROVED" as const, expectedDraftCount: 2, wordpressDraftCount: 2, assemblyPresent: true, pageReviewComplete: true, generatedPageCount: 2, wordpressContentUpdateCount: 0 };

describe("Site Build stage transition", () => {
  test("keeps incomplete page or image review in owner review", () => {
    expect(resolveSiteBuildStage({ ...completeReview, pageReviewComplete: false })).toBe("PAGE_REVIEW");
  });

  test("advances completed review to explicit WordPress content update", () => {
    expect(resolveSiteBuildStage(completeReview)).toBe("WORDPRESS_CONTENT_UPDATE");
    expect(resolveSiteBuildStage({ ...completeReview, wordpressContentUpdateCount: 2 })).toBe("COMPLETE");
  });
});