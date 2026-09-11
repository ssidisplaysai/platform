import { areRequiredPageImagesApproved } from "../site-page-image-review";

const page = { pageId: "home", pageRevisionId: "home-r5", imageRequirements: [{ slotId: "hero", status: "GENERATED_CANDIDATE_NEEDED", publishableAssetId: null }] } as never;
function candidate(revision: number, status: "READY_FOR_OWNER_REVIEW" | "APPROVED" | "REJECTED", pageRevisionId = "home-r5") { return { pageId: "home", pageRevisionId, slotId: "hero", revision, status } as never; }

describe("required page image review", () => {
  test("fails closed until the latest candidate is approved", () => {
    expect(areRequiredPageImagesApproved(page, [])).toBe(false);
    expect(areRequiredPageImagesApproved(page, [candidate(1, "APPROVED", "home-r4")])).toBe(false);
    expect(areRequiredPageImagesApproved(page, [candidate(1, "APPROVED"), candidate(2, "REJECTED")])).toBe(false);
    expect(areRequiredPageImagesApproved(page, [candidate(1, "REJECTED"), candidate(2, "APPROVED")])).toBe(true);
  });

  test("accepts an existing approved publishable asset without a candidate", () => {
    expect(areRequiredPageImagesApproved({ ...page, imageRequirements: [{ slotId: "hero", status: "READY", publishableAssetId: "asset-1" }] } as never, [])).toBe(true);
  });
});