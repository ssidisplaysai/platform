import {
  classifyPublicVerificationRead,
  convergePublicVerification,
  executeRetainOrRollbackTransaction,
  verifyRenderedWhitespace,
  verifyWordPressTemplateStructure,
  type PublicVerificationRead,
  type RenderedRect,
} from "../wordpress-post-content-publication-verifier";

const header = '<header class="wp-block-template-part"><nav>Global navigation</nav></header>';
const footer = '<footer class="wp-block-template-part">Global footer</footer>';
const validBody = '<main><div class="wr-page"><section><h1>Request a Quote</h1></section></div></main>';
const html = (body: string, beforeMain = "", afterMain = "") => `<!doctype html><html><body>${header}${beforeMain}${body}${afterMain}${footer}</body></html>`;
const rect = (top: number, height: number, width = 1200): RenderedRect => ({ top, bottom: top + height, left: 0, right: width, width, height });

function read(overrides: Partial<PublicVerificationRead> = {}): PublicVerificationRead {
  const predicateMatrix = { globalHeaderCount: true, globalFooterCount: true, bodyNavigationCountZero: true, duplicateBodyHeaderFalse: true, h1CountValid: true, pageIdentityValid: true, http200: true, storedContentHashValid: true, semanticIdentityValid: true, renderedGeometryValid: null };
  return { timestamp: "2026-09-14T00:00:00.000Z", url: "https://example.test/page/", httpStatus: 200, responseHeaders: { age: null, cacheControl: null, etag: null, lastModified: null, cfCacheStatus: null, xCache: null, xCacheStatus: null, server: "Apache" }, responseBodyHash: "expected", responseBodyHtml: "<html></html>", expectedStoredContentHash: "stored", actualStoredContentHash: "stored", semanticIdentity: "wr-page", predicateMatrix, failedPredicates: [], cacheClassification: "FRESH_EXPECTED", visualCertificationReference: null, ...overrides };
}

describe("reusable WordPress post-content publication verifier", () => {
  test("uses template-part authority and ignores a legacy body footer", () => {
    const result = verifyWordPressTemplateStructure({ html: html('<main><div class="wr-page"><h1>Request a Quote</h1><footer>Legacy body footer</footer></div></main>'), expectedH1Count: 1, expectedIdentityClass: "wr-page" });
    expect(result.pass).toBe(true);
    expect(result.globalHeaderCount).toBe(1);
    expect(result.globalFooterCount).toBe(1);
    expect(result.bodyFooterArtifactCount).toBe(1);
  });

  test.each([
    ["duplicate global header", `${header}${html(validBody)}`, "globalHeaderCount"],
    ["body navigation", html('<main><div class="wr-page"><h1>Request a Quote</h1><nav>Duplicate</nav></div></main>'), "bodyNavigationCountZero"],
    ["missing footer", `<!doctype html><html><body>${header}${validBody}</body></html>`, "globalFooterCount"],
    ["duplicate body header", html('<main><div class="wr-page"><header>Duplicate</header><h1>Request a Quote</h1></div></main>'), "duplicateBodyHeaderFalse"],
    ["wrong H1", html('<main><div class="wr-page"><h2>Request a Quote</h2></div></main>'), "h1CountValid"],
    ["wrong identity", html('<main><div class="wrong-page"><h1>Request a Quote</h1></div></main>'), "pageIdentityValid"],
  ])("rejects %s", (_name, document, predicate) => {
    const result = verifyWordPressTemplateStructure({ html: document, expectedH1Count: 1, expectedIdentityClass: "wr-page" });
    expect(result.pass).toBe(false);
    expect(result.failedPredicates).toContain(predicate);
  });

  test("passes a populated 610px hero and a larger intentional visual hero", () => {
    for (const height of [610, 900]) {
      const result = verifyRenderedWhitespace({ viewport: { width: 1440, height: 900 }, regions: [{ regionId: `hero-${height}`, role: "HERO", rect: rect(0, height), visible: true, textRects: [rect(80, 180, 680)], mediaRects: [rect(0, height, 1440)], ctaRects: [rect(300, 52, 220)] }] });
      expect(result.pass).toBe(true);
    }
  });

  test.each([["empty-610", 610], ["blank-spacer", 1000]])("rejects true empty region %s", (regionId, height) => {
    const result = verifyRenderedWhitespace({ viewport: { width: 1440, height: 900 }, regions: [{ regionId, role: "SPACER", rect: rect(0, height), visible: true, textRects: [], mediaRects: [], ctaRects: [] }] });
    expect(result.pass).toBe(false);
    expect(result.emptyRegionIds).toContain(regionId);
  });

  test("classifies expected, stale, and indeterminate cache reads", () => {
    expect(classifyPublicVerificationRead({ httpStatus: 200, responseBodyHash: "new", priorPublicBodyHash: "old", predicatesPass: true })).toBe("FRESH_EXPECTED");
    expect(classifyPublicVerificationRead({ httpStatus: 200, responseBodyHash: "old", priorPublicBodyHash: "old", predicatesPass: false })).toBe("STALE_PRIOR");
    expect(classifyPublicVerificationRead({ httpStatus: 500, responseBodyHash: "", priorPublicBodyHash: "old", predicatesPass: false })).toBe("INDETERMINATE");
  });

  test("requires two consecutive stable expected public reads and persists each attempt", async () => {
    const values = [read({ responseBodyHash: "old", cacheClassification: "STALE_PRIOR" }), read(), read()];
    const persisted: PublicVerificationRead[] = [];
    const result = await convergePublicVerification({ read: async () => values.shift()!, persistAttempt: (attempt) => { persisted.push(attempt); }, wait: async () => undefined });
    expect(result.converged).toBe(true);
    expect(result.consecutiveExpectedReads).toBe(2);
    expect(persisted).toHaveLength(3);
    expect(persisted[0]).toMatchObject({ responseBodyHtml: "<html></html>", responseHeaders: { server: "Apache" }, predicateMatrix: expect.any(Object), expectedStoredContentHash: "stored", actualStoredContentHash: "stored" });
  });

  test("fails closed when stale content never converges", async () => {
    const result = await convergePublicVerification({ read: async () => read({ responseBodyHash: "old", cacheClassification: "STALE_PRIOR", failedPredicates: ["semanticIdentityValid"] }), persistAttempt: () => undefined, wait: async () => undefined, maxAttempts: 3 });
    expect(result.converged).toBe(false);
    expect(result.attempts).toHaveLength(3);
  });

  test.each([
    ["wrong autosave", "APPROVED_AUTOSAVE_IDENTITY_FAILED"],
    ["payload hash mismatch", "PROMOTION_PAYLOAD_IDENTITY_FAILED"],
    ["stored hash mismatch", "STORED_POST_CONTENT_IDENTITY_FAILED"],
    ["public semantic failure", "PUBLIC_READ_CONVERGENCE_FAILED"],
    ["responsive failure", "PUBLIC_RESPONSIVE_VISUAL_CERTIFICATION_FAILED"],
  ])("persists %s before rollback", async (_name, expectedGate) => {
    const order: string[] = [];
    const result = await executeRetainOrRollbackTransaction({
      captureRollbackAuthority: async () => ({ contentHash: "before" }),
      verifyApprovedAutosave: async () => expectedGate !== "APPROVED_AUTOSAVE_IDENTITY_FAILED",
      verifyPromotionPayload: async () => expectedGate !== "PROMOTION_PAYLOAD_IDENTITY_FAILED",
      promoteExactContent: async () => { order.push("promote"); },
      verifyStoredContent: async () => expectedGate !== "STORED_POST_CONTENT_IDENTITY_FAILED",
      verifyPublicConvergence: async () => ({ converged: expectedGate !== "PUBLIC_READ_CONVERGENCE_FAILED", classification: "INDETERMINATE", attempts: [], consecutiveExpectedReads: 0, timeoutMs: 10_000 }),
      verifyResponsiveVisuals: async () => expectedGate !== "PUBLIC_RESPONSIVE_VISUAL_CERTIFICATION_FAILED",
      persistFailureEvidence: async ({ failedGate }) => { order.push(`persist:${failedGate}`); },
      rollbackExactAuthority: async () => { order.push("rollback"); },
      verifyRollbackIdentity: async (hash) => hash === "before",
    });
    expect(result.failedGate).toBe(expectedGate);
    expect(result.rollbackVerified).toBe(true);
    expect(order.findIndex((item) => item.startsWith("persist:"))).toBeLessThan(order.indexOf("rollback"));
  });

  test("reports rollback identity mismatch", async () => {
    const result = await executeRetainOrRollbackTransaction({ captureRollbackAuthority: async () => ({ contentHash: "before" }), verifyApprovedAutosave: async () => false, verifyPromotionPayload: async () => true, promoteExactContent: async () => undefined, verifyStoredContent: async () => true, verifyPublicConvergence: async () => ({ converged: false, classification: "INDETERMINATE", attempts: [], consecutiveExpectedReads: 0, timeoutMs: 10_000 }), verifyResponsiveVisuals: async () => true, persistFailureEvidence: async () => undefined, rollbackExactAuthority: async () => undefined, verifyRollbackIdentity: async () => false });
    expect(result.rollbackVerified).toBe(false);
  });
});