import {
  contentVerification,
  proposedExactJobSeo,
  verifyExactJobPage,
} from "../site-studio-exact-job-publication";
import type { GlwPageExecutionRecord } from "@/modules/glw/page-execution";

describe("Site Studio exact-job publication", () => {
  test("verifies exact id, slug, parent, and status", () => {
    expect(verifyExactJobPage({
      page: { id: 15289, slug: "plano", parent: 15284, status: "draft" },
      expectedObjectId: "15289",
      expectedSlug: "plano",
      expectedParentId: "15284",
      expectedStatus: "draft",
    })).toBe(true);
    expect(verifyExactJobPage({
      page: { id: 15289, slug: "plano", parent: 0, status: "draft" },
      expectedObjectId: "15289",
      expectedSlug: "plano",
      expectedParentId: "15284",
      expectedStatus: "draft",
    })).toBe(false);
  });

  test("fails content readiness on encoding corruption", () => {
    expect(contentVerification("<p>Clean SSI content for Plano.</p>")).toMatchObject({ ready: true, encodingMarkerCount: 0 });
    expect(contentVerification("<p>Broken â€” content.</p>")).toMatchObject({ ready: false, encodingMarkerCount: 1 });
  });

  test("uses persisted job SEO authority without inventing values", () => {
    const job = {
      focusKeyphrase: "accent rear projection film plano texas",
      seoTitle: "Accent Rear Projection Film Plano Texas | SSI Displays",
      metaDescription: "Explore Accent Rear Projection Film solutions in Plano from Screen Solutions International.",
    } as GlwPageExecutionRecord;
    expect(proposedExactJobSeo(job)).toEqual({
      focusKeyphrase: "accent rear projection film plano texas",
      seoTitle: "Accent Rear Projection Film Plano Texas | SSI Displays",
      metaDescription: "Explore Accent Rear Projection Film solutions in Plano from Screen Solutions International.",
    });
  });
});