jest.mock("server-only", () => ({}));

import {
  DALLAS_APPROVED_CONTENT_HASH,
  DALLAS_CAMPAIGN_ID,
  DALLAS_TARGET_ID,
  evaluateDallasDraftPublicDrift,
  evaluateDallasPublicEvidence,
  evaluateDallasPublicationReadiness,
  freezeDallasPublicationIdentity,
  selectExactDallasPublicationTarget,
} from "../dallas-reference-page-publication";

const exactIdentity = {
  organizationId: "ssi", siteId: "site-ssi-projectorenclosure", campaignId: DALLAS_CAMPAIGN_ID, targetId: DALLAS_TARGET_ID,
  jobId: "2ca74016-252b-4587-bf3c-ec9b7eb839c9", pageRevisionIdentity: "revision", wordpressObjectId: "13084",
  localBundleId: "local", localContextId: "context", localLinkGraphId: "links", localThemeProfileId: "theme",
  applicationAuthorityId: "applications", compositionPlanV2Id: "composition", marketBundleId: "market",
  marketIntelligenceId: "intelligence", pageStrategyHash: "a".repeat(64), semanticMediaHash: "b".repeat(64),
  approvedV3PreviewId: "preview", approvedV3PreviewHash: "c".repeat(64), approvedV3VisualEvidenceHash: "c".repeat(64),
};
const receipt = { receiptId: "receipt", exactIdentity, afterHash: DALLAS_APPROVED_CONTENT_HASH, wordpressObjectId: "13084", wordpressStatus: "draft" };
const certification = { certificationId: "certification", receiptId: "receipt", wordpressObjectId: "13084", contentHash: DALLAS_APPROVED_CONTENT_HASH, overallState: "PASS", captures: [], findings: [], createdAt: "now", countsAsPreviewCertification: false, wordpressMutationPerformed: false };
const comparison = { comparisonId: "comparison", receiptId: "receipt", actualCertificationId: "certification", approvedPreviewId: "preview", drift: { classification: "MINOR" }, ownerReviewRequired: true, publicationAuthorized: false, createdAt: "now" };
const readback = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", wordpressObjectId: "13084", status: "draft", parent: 13083, title: "Fan Cooled Projector Enclosures in Dallas", slug: "dallas", contentHash: DALLAS_APPROVED_CONTENT_HASH, seoHash: "01adf755d77249323a55cb652671cda7f6e38431feda5d1e1267c00fbdad2f71", featuredMediaId: 10757, semanticMediaRoles: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] };

describe("Dallas reference-page publication contract", () => {
  test("binds approval to the exact reviewed WordPress authority", () => {
    expect(freezeDallasPublicationIdentity({ receipt: receipt as never, certification: certification as never, comparison: comparison as never, readback })).toMatchObject({ wordpressObjectId: "13084", contentHash: DALLAS_APPROVED_CONTENT_HASH, previewWordPressDrift: "MINOR" });
  });

  test.each([
    ["content", { contentHash: "d".repeat(64) }],
    ["object", { wordpressObjectId: "13085" }],
    ["site", { siteId: "wrong-site" }],
    ["SEO", { seoHash: "e".repeat(64) }],
  ])("rejects stale %s authority", (_label, patch) => {
    expect(() => freezeDallasPublicationIdentity({ receipt: receipt as never, certification: certification as never, comparison: comparison as never, readback: { ...readback, ...patch } })).toThrow("DALLAS_PUBLICATION_APPROVAL_IDENTITY_STALE");
  });

  test("selects Dallas only and prohibits the other Texas cities", () => {
    const dallas = { targetId: DALLAS_TARGET_ID, campaignId: DALLAS_CAMPAIGN_ID, organizationId: "ssi", siteId: "site-ssi-projectorenclosure", stateCode: "TX", citySlug: "dallas", status: "draft_ready", jobId: "2ca74016-252b-4587-bf3c-ec9b7eb839c9", wordpressObjectId: "13084" };
    expect(selectExactDallasPublicationTarget([dallas as never]).targetId).toBe(DALLAS_TARGET_ID);
    for (const citySlug of ["houston", "san-antonio"]) expect(() => selectExactDallasPublicationTarget([{ ...dallas, targetId: DALLAS_TARGET_ID.replace("dallas", citySlug), citySlug } as never])).toThrow("DALLAS_PUBLICATION_TARGET_IDENTITY_STALE");
  });

  test("requires all readiness gates and rejects development leakage and unsafe claims", () => {
    const identity = freezeDallasPublicationIdentity({ receipt: receipt as never, certification: certification as never, comparison: comparison as never, readback });
    expect(evaluateDallasPublicationReadiness({ html: "<h1>Dallas</h1>", identity, h1Count: 1, linksValid: true, mediaValid: true, responsiveValid: true, publicationApproved: true }).failures).toEqual([]);
    expect(evaluateDallasPublicationReadiness({ html: "<h1>Our Dallas office</h1><a href='http://localhost:3003/glw/preview'>x</a>", identity, h1Count: 1, linksValid: true, mediaValid: true, responsiveValid: true, publicationApproved: true }).failures).toEqual(expect.arrayContaining(["CONTENT_READY", "LINKS_READY", "CLAIM_SAFE"]));
  });

  test("persists publication approval and intent append-only and idempotently", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs"); const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
    const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; const root = mkdtempSync(join(tmpdir(), "dallas-publish-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; jest.resetModules();
    const repository = await import("../dallas-reference-page-publication-repository"); const identity = freezeDallasPublicationIdentity({ receipt: receipt as never, certification: certification as never, comparison: comparison as never, readback });
    const first = repository.persistDallasPublicationApprovalAndIntent({ identity, expectedPublicUrl: "https://projectorenclosure.com/fan-cooled-projector-enclosures/texas/dallas/", rollbackArtifactId: "rollback", now: "2026-09-13T00:00:00.000Z" });
    const second = repository.persistDallasPublicationApprovalAndIntent({ identity, expectedPublicUrl: "https://projectorenclosure.com/fan-cooled-projector-enclosures/texas/dallas/", rollbackArtifactId: "rollback", now: "2026-09-13T01:00:00.000Z" });
    expect(second.approval.approvalId).toBe(first.approval.approvalId); expect(repository.getDallasPublicationState()).toMatchObject({ approvals: [{ decision: "APPROVED_FOR_PUBLICATION", ownerStatement: "approved" }], intents: [{ state: "READY" }] });
    if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true });
  });

  test("requires public HTTPS, canonical, indexability, media, links, and no dev leakage", () => {
    const valid = { expectedUrl: "https://projectorenclosure.com/path/", finalUrl: "https://projectorenclosure.com/path/", status: 200, canonical: "https://projectorenclosure.com/path/", title: "Fan Cooled Projector Enclosures in Dallas", expectedTitle: "Fan Cooled Projector Enclosures in Dallas", indexability: "INDEXABLE" as const, h1Count: 1, roles: readback.semanticMediaRoles, links: [{ url: "https://projectorenclosure.com/product/", classification: "INTERNAL_DIRECT" as const, status: 200, finalUrl: "https://projectorenclosure.com/product/" }], devLeak: false, claimSafe: true, mediaValid: true };
    expect(evaluateDallasPublicEvidence(valid).failures).toEqual([]);
    expect(evaluateDallasPublicEvidence({ ...valid, canonical: "https://example.com/wrong", indexability: "NOINDEX", devLeak: true, links: [{ ...valid.links[0], classification: "INTERNAL_BROKEN" }] }).failures).toEqual(expect.arrayContaining(["CANONICAL", "INDEXABILITY", "INTERNAL_LINKS", "DEV_LEAK"]));
  });

  test("allows public theme chrome but rejects changed content, media, links, CTA, application, or localization", () => {
    const valid = { approvedContentHash: DALLAS_APPROVED_CONTENT_HASH, postPublishContentHash: DALLAS_APPROVED_CONTENT_HASH, expectedRoles: readback.semanticMediaRoles, publicRoles: readback.semanticMediaRoles, expectedLinks: ["https://example.com/a"], publicLinks: ["https://example.com/a"], publicHtml: "Dallas North Texas Projection mapping Request project review Discuss your project" };
    expect(evaluateDallasDraftPublicDrift(valid).classification).toBe("MINOR");
    expect(evaluateDallasDraftPublicDrift({ ...valid, postPublishContentHash: "f".repeat(64) }).classification).toBe("CRITICAL");
    expect(evaluateDallasDraftPublicDrift({ ...valid, publicRoles: valid.publicRoles.slice(1) }).classification).toBe("CRITICAL");
    expect(evaluateDallasDraftPublicDrift({ ...valid, publicLinks: [], publicHtml: "Dallas" }).classification).toBe("MATERIAL");
  });
});