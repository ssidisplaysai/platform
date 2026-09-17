import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RenderedVisualCertification, RenderedVisualOwnerDecision } from "@/modules/foundation/rendered-visual-certification";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import type { GlwPageExecutionRecord } from "../page-execution";
import { projectAuthoritativeGeneratedPage } from "../authoritative-generated-page-projection";

const target = { targetId: "target", campaignId: "campaign", organizationId: "org", siteId: "site", productId: "product", stateCode: "EX", status: "content_ready", jobId: "job", wordpressObjectId: null, attemptCount: 1, lastError: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as GlwCampaignTarget;
const job = { jobId: "job", organizationId: "org", siteId: "site", externalExecutionId: "execution", updatedAt: "2026-01-01T00:00:00.000Z" } as GlwPageExecutionRecord;
const certification = { certificationId: "certification", overallState: "PASS", capturedAt: "2026-01-02T00:00:00.000Z", identity: { organizationId: "org", siteId: "site", pageId: "target", pageRevisionIdentity: "contextual-media:42:hash", canonicalPath: "/example/", contentHash: "a".repeat(64), renderedContentHash: "b".repeat(64), campaignId: "campaign", targetId: "target", jobId: "job", externalExecutionId: "execution", wordpressObjectId: "42", wordpressStatus: "draft" }, captures: [{ media: ["HERO", "PUBLIC", "EVENT", "CAMPUS"].map((contextId, index) => ({ contextId, semanticRole: index === 0 ? "CONTEXTUAL_IN_USE" : "APPLICATION_EXPERIENCE", mediaId: String(100 + index), rendered: true })) }, { media: ["HERO", "PUBLIC", "EVENT", "CAMPUS"].map((contextId, index) => ({ contextId, semanticRole: index === 0 ? "CONTEXTUAL_IN_USE" : "APPLICATION_EXPERIENCE", mediaId: String(100 + index), rendered: true })) }] } as RenderedVisualCertification;
const approved = { certificationId: certification.certificationId, captureSetId: certification.captureSetId, pageRevisionIdentity: certification.identity.pageRevisionIdentity, contentHash: certification.identity.contentHash, renderedContentHash: certification.identity.renderedContentHash, decision: "APPROVED" } as RenderedVisualOwnerDecision;

describe("authoritative generated-page projection", () => {
  test("newer certified WordPress and contextual evidence supersedes stale legacy target fields", () => {
    const result = projectAuthoritativeGeneratedPage({ target, job, certifications: [certification], ownerDecisions: [approved] });
    expect(result.target).toMatchObject({ status: "draft_ready", wordpressObjectId: "42", attemptCount: 1 });
    expect(result.certification?.certificationId).toBe("certification");
    expect(result.pageRevisionIdentity).toBe("contextual-media:42:hash");
    expect(result.contextualBuildSessionId).toBe("contextual-media:target");
    expect(result.contextualMedia).toHaveLength(4);
    expect(result.contextualMedia.every((media) => media.rendered)).toBe(true);
  });

  test("keeps an unapproved or needs-fix draft out of draft-ready projection", () => {
    expect(projectAuthoritativeGeneratedPage({ target, job, certifications: [certification], ownerDecisions: [] }).target.status).toBe("content_ready");
    expect(projectAuthoritativeGeneratedPage({ target, job, certifications: [certification], ownerDecisions: [{ ...approved, decision: "NEEDS_FIX" }] }).target.status).toBe("content_ready");
  });

  test("does not downgrade durable published lifecycle", () => {
    const result = projectAuthoritativeGeneratedPage({ target: { ...target, status: "published", wordpressObjectId: "42" }, job, certifications: [certification], ownerDecisions: [approved] });
    expect(result.target.status).toBe("published");
  });

  test("projects a newer public certification for the same target without legacy job identity", () => {
    const publicCertification = { ...certification, capturedAt: "2026-01-03T00:00:00.000Z", identity: { ...certification.identity, pageId: "target-public", jobId: null, externalExecutionId: null, wordpressStatus: "publish" } } as RenderedVisualCertification;
    const result = projectAuthoritativeGeneratedPage({ target, job, certifications: [certification, publicCertification], ownerDecisions: [] });
    expect(result.target).toMatchObject({ status: "published", wordpressObjectId: "42" });
    expect(result.certification?.identity.pageId).toBe("target-public");
  });

  test("contains no target-specific identity literals", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/authoritative-generated-page-projection.ts"), "utf8");
    expect(source).not.toMatch(/California|20139|668610|outdoor-digital-sphere|led-display-warehouse/);
  });
});
