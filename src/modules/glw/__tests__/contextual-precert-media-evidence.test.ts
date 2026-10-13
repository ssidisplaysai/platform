import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { resolvePreCaptureContextualAssignment } from "@/modules/glw/contextual-precert-media-evidence";

function assignment(overrides: Partial<SitePageMediaAssignment> = {}): SitePageMediaAssignment {
  return {
    assignmentId: "media-assignment-1",
    organizationId: "org",
    siteId: "site",
    buildSessionId: "contextual-media:target-1",
    pageId: "target-1",
    pageRevisionId: "job:job-1",
    slotId: "contextual-in-use",
    role: "CONTEXTUAL_IN_USE",
    asset: {
      type: "APPROVED_EXISTING",
      authorityReference: "legacy-evidence",
      productId: null,
      wordpressMediaId: 20247,
      url: "https://example.com/media/20247.jpg",
      sha256: "a".repeat(64),
    },
    metadata: {
      altText: "Contextual image",
      caption: null,
      title: "Contextual",
      description: "Contextual image",
    },
    approval: {
      candidateId: "candidate-1",
      approvedBy: "operator-1",
      approvedAt: "2026-09-18T10:00:00.000Z",
    },
    wordpressReceipt: {
      mediaId: 20247,
      url: "https://example.com/media/20247.jpg",
      attachedToObjectId: "31001",
      altTextVerified: true,
      placementVerified: true,
      verifiedAt: "2026-09-18T10:00:00.000Z",
    },
    createdAt: "2026-09-18T10:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePreCaptureContextualAssignment", () => {
  const common = {
    targetId: "target-1",
    pageRevisionIdentity: "job:job-1:2026-09-18T10:00:00.000Z",
    buildSessionId: "contextual-media:target-1",
    featuredMediaId: "20247",
    wordpressObjectId: "31001",
    jobId: "job-1",
    jobUpdatedAt: "2026-09-18T10:00:00.000Z",
  };

  test("accepts exact current-revision verified assignment evidence", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({ pageRevisionId: common.pageRevisionIdentity })],
      ...common,
    });
    expect(resolved?.assignmentId).toBe("media-assignment-1");
  });

  test("accepts compatible legacy job-scoped assignment only when current", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment()],
      ...common,
    });
    expect(resolved?.assignmentId).toBe("media-assignment-1");
  });

  test("rejects stale assignment evidence", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({
        approval: { candidateId: "candidate-1", approvedBy: "operator-1", approvedAt: "2026-09-18T08:00:00.000Z" },
        wordpressReceipt: {
          mediaId: 20247,
          url: "https://example.com/media/20247.jpg",
          attachedToObjectId: "31001",
          altTextVerified: true,
          placementVerified: true,
          verifiedAt: "2026-09-18T08:00:00.000Z",
        },
      })],
      ...common,
    });
    expect(resolved).toBeNull();
  });

  test("rejects mismatched WordPress object", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({ wordpressReceipt: { ...assignment().wordpressReceipt!, attachedToObjectId: "99999" } })],
      ...common,
    });
    expect(resolved).toBeNull();
  });

  test("rejects mismatched featured media", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({
        asset: { ...assignment().asset, type: "APPROVED_EXISTING", wordpressMediaId: 55555 },
        wordpressReceipt: { ...assignment().wordpressReceipt!, mediaId: 55555 },
      })],
      ...common,
    });
    expect(resolved).toBeNull();
  });

  test("rejects mismatched job scope", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({ pageRevisionId: "job:job-2" })],
      ...common,
    });
    expect(resolved).toBeNull();
  });

  test("rejects missing WordPress receipt", () => {
    const resolved = resolvePreCaptureContextualAssignment({
      assignments: [assignment({ wordpressReceipt: null })],
      ...common,
    });
    expect(resolved).toBeNull();
  });
});
