jest.mock("server-only", () => ({}));

import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveGeneratedPageReviewModel, deriveGeneratedPageVisualQaReview } from "../generated-page-review-read-model";
import { GlwGeneratedPageReviewWorkspace } from "../GlwGeneratedPageReviewWorkspace";
import type { RenderedVisualCertification } from "../../foundation/rendered-visual-certification";
import type { SitePageMediaAssignment } from "../../foundation/site-page-media-assignment";
import type { GlwCampaign } from "../campaign-types";
import type { GlwCampaignTarget } from "../campaign-target-repository";
import type { GlwPageExecutionRecord } from "../page-execution";

const campaign = {
  campaignId: "campaign-texas", organizationId: "ssi", siteId: "site-projector", productId: "product-enclosure", name: "Fan Cooled Projector Enclosures Texas Cities", pageType: "city_service", stateCodes: ["TX"], cityTargets: [{ stateCode: "TX", citySlug: "dallas", cityName: "Dallas" }], pagesPerDay: 10, publicationPolicy: "draft_only", imageRequired: true, status: "active", completedTargetCount: 1, failedTargetCount: 0, createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T02:00:00.000Z",
} as GlwCampaign;

const target = {
  targetId: "target-dallas", campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", productId: "product-enclosure", pageType: "city_service", stateCode: "TX", citySlug: "dallas", cityName: "Dallas", canonicalPath: "fan-cooled-projector-enclosures/texas/dallas", applicationPath: "fan-cooled-projector-enclosures/texas/dallas", status: "draft_ready", jobId: "job-dallas", wordpressObjectId: "13084", attemptCount: 2, lastError: null, createdAt: "2026-09-12T00:00:00.000Z", updatedAt: "2026-09-12T02:00:00.000Z",
} as GlwCampaignTarget;

const contentHtml = `<main><h1>Fan Cooled Projector Enclosures in Dallas</h1><p>Commercial projector protection for Dallas venues.</p><h2>Plan for Dallas Conditions</h2><p>Choose the correct enclosure and service plan.</p><h2>Installation Support</h2><p>Coordinate mounting, airflow, and access.</p><a href="https://projectorenclosure.com/fan-cooled-projector-enclosures/">Fan Cooled Projector Enclosures</a></main>`;
const job = {
  jobId: "job-dallas", correlationId: "corr", executionTransport: "N8N_MCP", organizationId: "ssi", siteId: "site-projector", productId: "product-enclosure", productTopic: "Fan Cooled Projector Enclosures", state: "Texas", city: "Dallas", slug: target.canonicalPath, title: "Fan Cooled Projector Enclosures in Dallas", seoTitle: "Fan Cooled Projector Enclosures Dallas Texas | ProjectorEnclosure.com", metaDescription: "Discover fan cooled projector enclosures Dallas Texas for commercial AV, classrooms, and venues.", publicationIntent: "draft", status: "COMPLETE", externalExecutionId: "579510", wordpressObjectId: "13084", wordpressUrl: "https://projectorenclosure.com/?page_id=13084", wordpressStatus: "draft", generatedDraft: { title: "Fan Cooled Projector Enclosures in Dallas", contentHtml, slug: target.canonicalPath, excerpt: "Commercial projector enclosure planning for Dallas.", seoTitle: "Fan Cooled Projector Enclosures Dallas Texas | ProjectorEnclosure.com", metaDescription: "Discover fan cooled projector enclosures Dallas Texas for commercial AV, classrooms, and venues.", focusKeyphrase: "fan cooled projector enclosures dallas texas" }, errorCode: null, errorMessage: null, requestedPublicationMode: "draft", disposition: "DRAFT_READY", qaStatus: "COMPLETE", qaChecks: { contentPresent: { ok: true, message: "Generated content is present." }, expectedCity: { ok: true, message: "Expected city is present." }, productAuthority: { exactProductMatch: true }, internalLinks: { linksRendered: 1 }, mediaAuthority: { selectedMediaId: 10757, selectedProvenance: "PRODUCT_INTELLIGENCE" } }, qaFailureReasons: {}, focusKeyphrase: "fan cooled projector enclosures dallas texas", wordCount: 2208, featuredImagePresent: true, createdAt: "2026-09-12T00:00:00.000Z", dispatchedAt: "2026-09-12T01:00:00.000Z", updatedAt: "2026-09-12T02:00:00.000Z", completedAt: "2026-09-12T02:00:00.000Z",
} as GlwPageExecutionRecord;

function model(overrides: { wordpressDraft?: object | null; wordpressMedia?: object | null; readState?: string; mediaAssignments?: readonly SitePageMediaAssignment[]; approvedProductMedia?: SitePageMediaAssignment | null; referenceLocations?: readonly { label: string; authority: string }[]; targetStatus?: GlwCampaignTarget["status"] } = {}) {
  return deriveGeneratedPageReviewModel({
    campaign, target: { ...target, status: overrides.targetStatus ?? target.status }, job, siteName: "ProjectorEnclosure.com", domain: "projectorenclosure.com", productName: "Fan Cooled Projector Enclosures", productAuthorityReference: "wordpress-media:10757", productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
    knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
    wordpressDraft: overrides.wordpressDraft === undefined ? { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } : overrides.wordpressDraft as never,
    wordpressMedia: overrides.wordpressMedia === undefined ? { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } : overrides.wordpressMedia as never,
    wordpressReadState: overrides.readState ?? "AUTHENTICATED_EXACT_DRAFT_READ", wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit", mediaAssignments: overrides.mediaAssignments, approvedProductMedia: overrides.approvedProductMedia, referenceLocations: overrides.referenceLocations,
  });
}

describe("Genesis generated page review workspace", () => {
  test("derives the exact Dallas identity, WordPress draft, SEO, trace, and draft-only action", () => {
    const result = model();
    expect(result.identity).toMatchObject({ title: job.title, target: "Dallas, TX", canonicalPath: target.canonicalPath, lifecycleState: "draft_ready", publicationPolicy: "draft_only" });
    expect(result.wordpress).toMatchObject({ objectId: "13084", status: "draft", verified: true, titleMatchesSource: true, contentMatchesSource: true, readState: "AUTHENTICATED_EXACT_DRAFT_READ" });
    expect(result.seo).toMatchObject({ titleState: "PASS", metaDescriptionState: "PASS", canonicalState: "PASS", redirectState: "NOT_EVALUATED", indexabilityState: "PASS", h1Count: 1, h1State: "PASS", developmentUrlLeakState: "PASS" });
    expect(result.trace).toMatchObject({ jobId: "job-dallas", externalExecutionId: "579510", generationState: "COMPLETE", reconciliationState: "RECONCILED TO DRAFT", wordpressObjectId: "13084", attemptCount: 2 });
    expect(result.actions.canonical?.label).toBe("Open WordPress Draft");
  });

  test("keeps legacy product and contextual roles distinct with useful provenance", () => {
    const result = model();
    expect(result.images).toMatchObject({ contractState: "LEGACY_IMAGE_STATE", productAuthority: { state: "NOT_WIRED", imageUrl: null, provenance: "wordpress-media:10757" }, contextualInUse: { state: "LEGACY_FEATURED", wordpressMediaId: "10757", authority: "PRODUCT_INTELLIGENCE" } });
    expect(result.images.contextualInUse.grounding).toContain("PRODUCT_TRUTH role was not persisted");
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ category: "IMAGE", severity: "BLOCKED", what: "Required product authority media unresolved" })]));
    expect(result.reviewState).toBe("REVIEW_BLOCKED");
    expect(result.visualQa).toMatchObject({ contractExists: true, certificationState: "NOT_CERTIFIED", overallState: "NOT_EVALUATED", captures: [], decisionState: "PENDING" });
    expect(result.richComposition.plan).toMatchObject({ contract: "site-page-composition-plan-v1", profile: "LOCATION_SERVICE", validationState: "BLOCKED" });
    expect(result.richComposition.plan.media).toEqual(expect.arrayContaining([expect.objectContaining({ role: "PRODUCT_AUTHORITY", readiness: "NOT_WIRED" }), expect.objectContaining({ role: "CONTEXTUAL_IN_USE", readiness: "LEGACY" })]));
    expect(result.richComposition.plan.blockers).toContain("PRODUCT_AUTHORITY_NOT_WIRED");
    expect(result.richComposition.safeNextAction).toContain("site-page-media-assignment-v1");
  });

  test("uses an exact product assignment without claiming current WordPress rendering", () => {
    const assignment = { assignmentId: "media-assignment-dallas", organizationId: "ssi", siteId: "site-projector", buildSessionId: "glw-job:job-dallas", pageId: "target-dallas", pageRevisionId: "job:job-dallas:2026-09-12T02:00:00.000Z", slotId: "product-authority", role: "PRODUCT_AUTHORITY", asset: { type: "APPROVED_EXISTING", authorityReference: "wordpress-media:10757", productId: "product-enclosure", wordpressMediaId: 10757, url: "https://projectorenclosure.com/wp-content/uploads/enclosure.webp", sha256: "a".repeat(64) }, metadata: { altText: "Fan cooled projector enclosure", caption: null, title: "Fan cooled enclosure", description: "Approved product image" }, approval: { candidateId: "candidate", approvedBy: "owner", approvedAt: "2026-09-05T00:00:00.000Z" }, wordpressReceipt: null, createdAt: "2026-09-13T00:00:00.000Z" } as SitePageMediaAssignment;
    const result = model({ mediaAssignments: [assignment] });
    expect(result.images.productAuthority).toMatchObject({ state: "ASSIGNED", wordpressMediaId: "10757", renderedInCurrentWordPress: false });
    expect(result.images.contextualInUse.state).toBe("LEGACY_FEATURED");
    expect(result.richComposition.plan).toMatchObject({ validationState: "READY", blockers: [] });
    expect(result.richComposition.plan.media).toEqual(expect.arrayContaining([expect.objectContaining({ role: "PRODUCT_AUTHORITY", readiness: "READY", assignmentId: "media-assignment-dallas" }), expect.objectContaining({ role: "CONTEXTUAL_IN_USE", readiness: "LEGACY" })]));
    expect(result.issues.some((issue) => issue.what === "Product authority not wired")).toBe(false);
  });

  test("reuses only matching approved documentary product authority for non-mutating review", () => {
    const approved = { assignmentId: "media-assignment-reference", organizationId: "ssi", siteId: "site-projector", buildSessionId: "glw-job:reference", pageId: "target-reference", pageRevisionId: "job:reference:2026-09-12T00:00:00.000Z", slotId: "product-authority", role: "PRODUCT_AUTHORITY", asset: { type: "APPROVED_EXISTING", authorityReference: "wordpress-media:10757", productId: "product-enclosure", wordpressMediaId: 10757, url: "https://projectorenclosure.com/wp-content/uploads/enclosure.webp", sha256: "a".repeat(64) }, metadata: { altText: "Fan cooled projector enclosure", caption: null, title: "Fan cooled enclosure", description: "Approved product image" }, approval: { candidateId: "candidate", approvedBy: "owner", approvedAt: "2026-09-05T00:00:00.000Z" }, wordpressReceipt: null, createdAt: "2026-09-13T00:00:00.000Z" } as SitePageMediaAssignment;
    const result = model({ approvedProductMedia: approved });
    expect(result.images.productAuthority).toMatchObject({ state: "RESOLVED_APPROVED", imageUrl: approved.asset.type === "APPROVED_EXISTING" ? approved.asset.url : null, wordpressMediaId: "10757", renderedInCurrentWordPress: false });
    expect(result.richComposition.plan.media).toEqual(expect.arrayContaining([expect.objectContaining({ role: "PRODUCT_AUTHORITY", readiness: "READY", assignmentId: "media-assignment-reference" })]));
    expect(result.richComposition.preview.productImageUrl).toBe("https://projectorenclosure.com/wp-content/uploads/enclosure.webp");
    expect(result.issues.some((issue) => issue.what === "Required product authority media unresolved")).toBe(false);
  });

  test("blocks content-ready city review until governed localized composition exists", () => {
    const result = model({ targetStatus: "content_ready" });
    expect(result.reviewState).toBe("REVIEW_BLOCKED");
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ category: "POLICY", severity: "BLOCKED", what: "Governed localized composition is unavailable" })]));
  });

  test("renders live and source previews, readable review evidence, and no publish action", () => {
    const html = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={model()} />);
    expect(html).toContain("Fan Cooled Projector Enclosures in Dallas");
    expect(html).toContain("Dallas, TX");
    expect(html).toContain("#13084 · DRAFT");
    expect(html).toContain("DRAFT READY");
    expect(html).toContain("Actual WordPress Draft");
    expect(html).toContain("Genesis Source / Assembly Preview");
    expect(html).toContain("Rendered Visual Certification");
    expect(html).toContain("CURRENT RENDER");
    expect(html).toContain("PROPOSED COMPOSITION PLAN");
    expect(html).toContain("LOCATION SERVICE");
    expect(html).toContain("PRODUCT AUTHORITY");
    expect(html).toContain("NOT WIRED");
    expect(html).toContain("CONTEXTUAL IN USE");
    expect(html).toContain("LEGACY");
    expect(html).toContain("Run Visual Review");
    expect(html).toContain("Browser viewport");
    expect(html).toContain("NOT EVALUATED");
    expect(html).toContain("Product Authority");
    expect(html).toContain("NOT WIRED");
    expect(html).toContain("Contextual In-Use");
    expect(html).toContain("Generation / Execution Trace");
    expect(html).toContain("579510");
    expect(html.indexOf("Rendered Visual Certification")).toBeLessThan(html.indexOf("Actual WordPress Draft"));
    expect(html).not.toMatch(/>Publish(?: Page)?</);
    expect(html).not.toContain("Approve Review");
  });

  test("shows published as the primary owner state when lifecycle is published", () => {
    const html = renderToStaticMarkup(
      <GlwGeneratedPageReviewWorkspace model={model({ targetStatus: "published" })} />,
    );

    expect(html).toContain("PUBLISHED ✓");
  });

  test("fails visibly when authenticated WordPress content is unavailable and preserves navigation context", () => {
    const result = model({ wordpressDraft: null, wordpressMedia: null, readState: "AUTH_FAILURE" });
    const html = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={result} />);
    expect(result.wordpress.verified).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ category: "WORDPRESS", what: "Live WordPress draft could not be fully verified" })]));
    expect(html).toContain("Authenticated draft content is unavailable: AUTH FAILURE");
    expect(html).toContain("/glw/campaigns/campaign-texas?organizationId=ssi&amp;siteId=site-projector");
    expect(html).toContain("/glw/campaigns?organizationId=ssi&amp;siteId=site-projector");
  });

  test("renders persisted capture geometry, findings, decision currency, and stale review state", () => {
    const capture = (viewportClass: "DESKTOP" | "MOBILE", width: number) => ({ captureId: `capture-${viewportClass}`, viewportClass, viewportWidth: width, viewportHeight: 900, documentWidth: width, documentHeight: 4000, primaryContentBounds: { x: 100, y: 0, width: width - 200, height: 4000 }, horizontalOverflow: 0, screenshotArtifact: { reference: `/visual/${viewportClass}.png`, sha256: "a".repeat(64), byteSize: 1000, width, height: 900, mediaType: "image/png" as const }, capturedAt: "2026-09-12T12:00:00.000Z", source: { origin: "https://projectorenclosure.com", pathname: "/fan-cooled-projector-enclosures/texas/dallas/" }, renderer: { engine: "Chromium", version: "140", userAgent: null }, hero: { authority: "NOT_IDENTIFIED" as const, present: null, bounds: null, headingBounds: null, headingLineCount: null, primaryCtaBounds: null, mediaBounds: null, mediaBeforeHero: null, containerAligned: null }, media: [{ assignmentId: null, semanticRole: "CONTEXTUAL_IN_USE" as const, mediaId: "10757", assigned: false, rendered: true, renderedBounds: { x: 100, y: 100, width: 500, height: 250 }, contextId: "featured", aboveFold: true }], sections: [{ sectionId: "section-1", bounds: { x: 100, y: 400, width: 800, height: 500 }, headingBounds: null, headingLineCount: null, contentBounds: null, mediaBounds: null, gapBefore: 40 }] });
    const certification = { certificationId: "cert-1", contract: "rendered-visual-certification-v1", schemaVersion: 1, identity: { organizationId: "ssi", siteId: "site-projector", pageId: "target-dallas", pageRevisionIdentity: "job:job-dallas:2026-09-12T02:00:00.000Z", canonicalPath: target.canonicalPath, contentHash: "b".repeat(64), renderedContentHash: "c".repeat(64), campaignId: campaign.campaignId, targetId: target.targetId, jobId: job.jobId, externalExecutionId: "579510", wordpressObjectId: "13084", wordpressStatus: "draft" }, layoutClass: "CONTENT_ARTICLE", captureSetId: "capture-set-1", captures: [capture("DESKTOP", 1440), capture("MOBILE", 375)], findings: [{ findingCode: "DESKTOP_HERO_GEOMETRY", category: "HERO", state: "NOT_EVALUATED", summary: "No authoritative hero identity was supplied.", evidenceReferences: ["capture-DESKTOP"], rule: { ruleId: "RVC_HERO_AUTHORITY_MISSING", version: "genesis-rendered-visual-rules-v1", thresholds: {} }, safeRecommendation: null }], overallState: "PASS", capturedAt: "2026-09-12T12:00:00.000Z", createdAt: "2026-09-12T12:01:00.000Z", createdBy: "owner", mutationPerformed: false } as RenderedVisualCertification;
    const decision = { decisionId: "decision-1", certificationId: "cert-1", captureSetId: "capture-set-1", pageRevisionIdentity: certification.identity.pageRevisionIdentity, contentHash: certification.identity.contentHash, renderedContentHash: certification.identity.renderedContentHash, decision: "APPROVED", note: "Exact captures reviewed.", decidedAt: "2026-09-12T12:02:00.000Z", decidedBy: "owner", publicationAuthorized: false } as const;
    const current = deriveGeneratedPageVisualQaReview({ certification, decision, certificationState: "CURRENT", decisionState: "CURRENT" });
    const stale = deriveGeneratedPageVisualQaReview({ certification, decision, certificationState: "STALE", decisionState: "STALE" });
    const currentHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={{ ...model(), visualQa: current }} />);
    const staleHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={{ ...model(), visualQa: stale }} />);
    expect(currentHtml).toContain("visual-capture-tab-desktop");
    expect(currentHtml).toContain("visual-capture-tab-mobile");
    expect(currentHtml).toContain("visual-capture-expand-desktop");
    expect(currentHtml).toContain("visual-capture-expand-mobile");
    expect(currentHtml).toContain("max-h-[560px]");
    expect(currentHtml).toContain("peer-checked/desktop-expand:max-h-none");
    expect(currentHtml).toContain("peer-checked/mobile-expand:max-h-none");
    expect(currentHtml).toContain("checked=\"\"");
    expect(currentHtml).not.toContain("group-open:max-h-none");
    expect(currentHtml).toContain("Expand Full Capture");
    expect(currentHtml).toContain("Collapse Capture");
    expect(currentHtml).toContain("DESKTOP Capture");
    expect(currentHtml).toContain("MOBILE Capture");
    expect(currentHtml).toContain("86%");
    expect(currentHtml).toContain("RVC_HERO_AUTHORITY_MISSING");
    expect(currentHtml).toContain("APPROVED");
    expect(currentHtml).toContain("Evidence currency: CURRENT");
    expect(currentHtml).toContain("Visual Review Current");
    expect(currentHtml).toContain("Recapture");
    expect(currentHtml).toContain("DESKTOP visual certification capture");
    expect(staleHtml).toContain("VISUAL REVIEW STALE");
    expect(staleHtml).toContain("Re-run Visual Review");
    expect(staleHtml).toContain("Recapture and re-run visual review");
    expect(stale.overallState).toBe("NOT_EVALUATED");
  });

  test("shows owner decision controls only for an eligible current PASS certification", () => {
    const base = model();
    const eligible = { ...base, reviewState: "NEEDS_ATTENTION" as const, visualQa: { ...base.visualQa, certificationState: "CURRENT" as const, overallState: "PASS" as const }, actions: { ...base.actions, ownerDecision: { endpoint: "/api/glw/visual-certifications/cert-current/decision", organizationId: "ssi", siteId: "site-projector" } } };
    const ineligible = { ...eligible, actions: { ...eligible.actions, ownerDecision: null } };
    const eligibleHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={eligible} />);
    const ineligibleHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={ineligible} />);
    expect(eligibleHtml).toContain("Approve Page");
    expect(eligibleHtml).toContain("Needs Fix");
    expect(eligible.actions.ownerDecision?.endpoint).toBe("/api/glw/visual-certifications/cert-current/decision");
    expect(ineligibleHtml).not.toContain("Approve Page");
    expect(ineligibleHtml).not.toContain("Needs Fix");
  });

  test("keeps owner decision action for CURRENT PASS certification when wordpressStatus is publish", () => {
    const cert = {
      certificationId: "cert-publish",
      contract: "rendered-visual-certification-v1",
      schemaVersion: 1,
      identity: {
        organizationId: "ssi",
        siteId: "site-projector",
        pageId: target.targetId,
        pageRevisionIdentity: "job:job-dallas:2026-09-12T02:00:00.000Z",
        canonicalPath: target.canonicalPath,
        contentHash: "b".repeat(64),
        renderedContentHash: "c".repeat(64),
        campaignId: campaign.campaignId,
        targetId: target.targetId,
        jobId: job.jobId,
        externalExecutionId: "579510",
        wordpressObjectId: "13084",
        wordpressStatus: "publish",
      },
      layoutClass: "CONTENT_ARTICLE",
      captureSetId: "capture-publish",
      captures: [],
      findings: [],
      overallState: "PASS",
      capturedAt: "2026-09-12T12:00:00.000Z",
      createdAt: "2026-09-12T12:01:00.000Z",
      createdBy: "owner",
      mutationPerformed: false,
    } as RenderedVisualCertification;

    const decision = {
      decisionId: "decision-publish",
      certificationId: "cert-publish",
      captureSetId: "capture-publish",
      pageRevisionIdentity: "job:job-dallas:2026-09-12T02:00:00.000Z",
      contentHash: "b".repeat(64),
      renderedContentHash: "c".repeat(64),
      decision: "PENDING",
      note: null,
      decidedAt: "2026-09-12T12:02:00.000Z",
      decidedBy: "owner",
      publicationAuthorized: false,
    } as const;

    const result = deriveGeneratedPageReviewModel({
      campaign,
      target,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:10757",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
      wordpressDraft: { id: 13084, slug: "dallas", status: "publish", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
      visualCertification: {
        certification: cert,
        decision,
        certificationState: "CURRENT",
        decisionState: "PENDING",
      },
      mediaAssignments: [{
        assignmentId: "media-assignment-publish",
        organizationId: "ssi",
        siteId: "site-projector",
        buildSessionId: "glw-job:job-dallas",
        pageId: "target-dallas",
        pageRevisionId: "job:job-dallas:2026-09-12T02:00:00.000Z",
        slotId: "product-authority",
        role: "PRODUCT_AUTHORITY",
        asset: {
          type: "APPROVED_EXISTING",
          authorityReference: "wordpress-media:10757",
          productId: "product-enclosure",
          wordpressMediaId: 10757,
          url: "https://projectorenclosure.com/wp-content/uploads/enclosure.webp",
          sha256: "a".repeat(64),
        },
        metadata: { altText: "Fan cooled projector enclosure", caption: null, title: "Fan cooled enclosure", description: "Approved product image" },
        approval: { candidateId: "candidate", approvedBy: "owner", approvedAt: "2026-09-05T00:00:00.000Z" },
        wordpressReceipt: null,
        createdAt: "2026-09-13T00:00:00.000Z",
      } as SitePageMediaAssignment],
    });

    expect(result.actions.ownerDecision).toMatchObject({
      endpoint: "/api/glw/visual-certifications/cert-publish/decision",
      organizationId: "ssi",
      siteId: "site-projector",
    });
  });

  test("exposes publish action only when exact publish gates are satisfied", () => {
    const cert = {
      certificationId: "cert-ready",
      contract: "rendered-visual-certification-v1",
      schemaVersion: 1,
      identity: {
        organizationId: "ssi",
        siteId: "site-projector",
        campaignId: campaign.campaignId,
        targetId: target.targetId,
        pageId: target.targetId,
        pageRevisionIdentity: "job:job-dallas:2026-09-12T02:00:00.000Z",
        canonicalPath: target.canonicalPath,
        contentHash: "b".repeat(64),
        renderedContentHash: "c".repeat(64),
        jobId: job.jobId,
        externalExecutionId: "579510",
        wordpressObjectId: "13084",
        wordpressStatus: "draft",
      },
      layoutClass: "CONTENT_ARTICLE",
      captureSetId: "capture-ready",
      captures: [],
      findings: [],
      overallState: "PASS",
      capturedAt: "2026-09-12T12:00:00.000Z",
      createdAt: "2026-09-12T12:01:00.000Z",
      createdBy: "owner",
      mutationPerformed: false,
    } as RenderedVisualCertification;
    const decision = {
      decisionId: "decision-ready",
      certificationId: "cert-ready",
      captureSetId: "capture-ready",
      pageRevisionIdentity: "job:job-dallas:2026-09-12T02:00:00.000Z",
      contentHash: "b".repeat(64),
      renderedContentHash: "c".repeat(64),
      decision: "APPROVED",
      note: "Ready to publish",
      decidedAt: "2026-09-12T12:02:00.000Z",
      decidedBy: "owner",
      publicationAuthorized: false,
    } as const;

    const readyCampaign = { ...campaign, publicationPolicy: "publish_after_gates" } as GlwCampaign;
    const readyModel = deriveGeneratedPageReviewModel({
      campaign: readyCampaign,
      target,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:10757",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
      wordpressDraft: { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
      visualCertification: {
        certification: cert,
        decision,
        certificationState: "CURRENT",
        decisionState: "CURRENT",
      },
      mediaAssignments: [{
        assignmentId: "media-assignment-ready",
        organizationId: "ssi",
        siteId: "site-projector",
        buildSessionId: "glw-job:job-dallas",
        pageId: "target-dallas",
        pageRevisionId: "job:job-dallas:2026-09-12T02:00:00.000Z",
        slotId: "product-authority",
        role: "PRODUCT_AUTHORITY",
        asset: {
          type: "APPROVED_EXISTING",
          authorityReference: "wordpress-media:10757",
          productId: "product-enclosure",
          wordpressMediaId: 10757,
          url: "https://projectorenclosure.com/wp-content/uploads/enclosure.webp",
          sha256: "a".repeat(64),
        },
        metadata: { altText: "Fan cooled projector enclosure", caption: null, title: "Fan cooled enclosure", description: "Approved product image" },
        approval: { candidateId: "candidate", approvedBy: "owner", approvedAt: "2026-09-05T00:00:00.000Z" },
        wordpressReceipt: null,
        createdAt: "2026-09-13T00:00:00.000Z",
      } as SitePageMediaAssignment],
    });

    expect(readyModel.actions.publish).toMatchObject({
      endpoint: "/api/glw/campaigns/campaign-texas/publish",
      campaignId: "campaign-texas",
      targetId: "target-dallas",
    });

    const nonDraftLifecycle = deriveGeneratedPageReviewModel({
      campaign: readyCampaign,
      target: { ...target, status: "published" } as GlwCampaignTarget,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:10757",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
      wordpressDraft: { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
      visualCertification: { certification: cert, decision, certificationState: "CURRENT", decisionState: "CURRENT" },
    });
    expect(nonDraftLifecycle.actions.publish).toBeNull();

    const draftOnlyModel = deriveGeneratedPageReviewModel({
      campaign,
      target,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:10757",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
      wordpressDraft: { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
      visualCertification: { certification: cert, decision, certificationState: "CURRENT", decisionState: "CURRENT" },
    });
    expect(draftOnlyModel.actions.publish).toBeNull();

    const pendingDecisionModel = deriveGeneratedPageReviewModel({
      campaign: readyCampaign,
      target,
      job,
      siteName: "ProjectorEnclosure.com",
      domain: "projectorenclosure.com",
      productName: "Fan Cooled Projector Enclosures",
      productAuthorityReference: "wordpress-media:10757",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
      wordpressDraft: { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
      visualCertification: {
        certification: cert,
        decision: null,
        certificationState: "CURRENT",
        decisionState: "PENDING",
      },
    });
    expect(pendingDecisionModel.actions.publish).toBeNull();
  });

  test("wires publish action component to exact target payload contract", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/GlwPublishPageAction.tsx"), "utf8");
    expect(source).toContain("confirm: \"PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS\"");
    expect(source).toContain("targetId: props.targetId");
    expect(source).toContain("window.confirm(\"Publish this exact draft-ready page now?\")");
    expect(source).toContain("running ? \"Publishing...\" : \"Publish Page\"");
  });

  test("renders Publish Page button only when publish action is present", () => {
    const base = model();
    const publishVisible = {
      ...base,
      actions: {
        ...base.actions,
        publish: {
          endpoint: "/api/glw/campaigns/campaign-texas/publish",
          organizationId: "ssi",
          siteId: "site-projector",
          campaignId: "campaign-texas",
          targetId: "target-dallas",
        },
      },
    };
    const hidden = {
      ...publishVisible,
      actions: {
        ...publishVisible.actions,
        publish: null,
      },
    };
    const visibleHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={publishVisible} />);
    const hiddenHtml = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={hidden} />);

    expect(visibleHtml).toContain("Publish Page");
    expect(hiddenHtml).not.toContain("Publish Page");
  });

  test("build model computes current visual identity from authoritative current state, not prior certification identity fallback", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/glw/generated-page-review-read-model.ts"), "utf8");
    expect(source).toContain("const currentIdentity: RenderedVisualPageIdentity = { organizationId: job.organizationId");
    expect(source).toContain("wordpressStatus: wordpressDraft?.status ?? job.wordpressStatus");
    expect(source).not.toContain("projection.certification?.identity ??");
  });

  test("renders generated contextual media repair action only when eligible", () => {
    const base = model();
    const eligible = {
      ...base,
      actions: {
        ...base.actions,
        generatedContextualRepair: {
          endpoint: "/api/glw/pages/job-dallas/generated-contextual-media-repair",
          organizationId: "ssi",
          siteId: "site-projector",
          operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA" as const,
          label: "Replace Legacy Contextual Image" as const,
          identity: {
            campaignId: "campaign-texas",
            targetId: "target-dallas",
            jobId: "job-dallas",
            externalExecutionId: "579510",
            wordpressObjectId: "13084",
            productId: "product-enclosure",
            pageRevisionId: "job:job-dallas:2026-09-12T02:00:00.000Z",
            expectedStoredSha256: "d".repeat(64),
          },
        },
      },
    };
    const ineligible = {
      ...eligible,
      actions: {
        ...eligible.actions,
        generatedContextualRepair: null,
      },
    };
    const eligibleHtml = renderToStaticMarkup(
      <GlwGeneratedPageReviewWorkspace model={eligible} />,
    );
    const ineligibleHtml = renderToStaticMarkup(
      <GlwGeneratedPageReviewWorkspace model={ineligible} />,
    );

    expect(eligibleHtml).toContain("Replace Legacy Contextual Image");
    expect(eligibleHtml).toContain("Draft-only contextual image repair");
    expect(ineligibleHtml).not.toContain("Replace Legacy Contextual Image");
  });

  test("strict outdoor sphere uses exact generated contextual assignment for review and preview instead of legacy featured media", () => {
    const strictCampaign = {
      ...campaign,
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
    } as GlwCampaign;
    const strictTarget = {
      ...target,
      targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-fl",
      campaignId: strictCampaign.campaignId,
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      productId: strictCampaign.productId,
      status: "draft_ready",
      wordpressObjectId: "20163",
      cityName: "Miami",
      stateCode: "FL",
    } as GlwCampaignTarget;
    const strictJob = {
      ...job,
      jobId: "5d877113-638a-40d0-9252-6390ec97c837",
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      campaignId: strictCampaign.campaignId,
      productId: strictCampaign.productId,
      state: "Florida",
      city: "Miami",
      wordpressObjectId: "20163",
      wordpressStatus: "draft",
      updatedAt: "2026-09-18T02:46:59.526Z",
      featuredImagePresent: true,
    } as GlwPageExecutionRecord;
    const pageRevisionIdentity = "job:5d877113-638a-40d0-9252-6390ec97c837:2026-09-18T02:46:59.526Z";
    const generatedUrl = "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/fl-contextual-generated.jpg";
    const legacyUrl = "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/fl-legacy-featured.jpg";
    const generatedAssignment = {
      assignmentId: "media-assignment-job:5d877113-638a-40d0-9252-6390ec97c837-POST_HERO_CONTEXTUAL",
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      buildSessionId: `contextual-media:${strictTarget.targetId}`,
      pageId: strictTarget.targetId,
      pageRevisionId: pageRevisionIdentity,
      slotId: "POST_HERO_CONTEXTUAL",
      role: "CONTEXTUAL_IN_USE",
      asset: {
        type: "GENERATED",
        provider: "OPENAI_IMAGE",
        model: "gpt-image-2",
        generationJobId: "contextual-generation-fl",
        effectivePrompt: "Conceptual contextual visualization only.",
        referenceInputs: [],
        outputSha256: "a".repeat(64),
      },
      metadata: {
        altText: "Conceptual contextual visualization in Miami, Florida; not a real customer installation.",
        caption: null,
        title: "CONTEXTUAL IN USE",
        description: "Generated contextual media",
      },
      approval: {
        candidateId: "contextual-generation-fl",
        approvedBy: "owner",
        approvedAt: "2026-09-18T02:47:00.000Z",
      },
      wordpressReceipt: {
        mediaId: 20166,
        url: generatedUrl,
        attachedToObjectId: "20163",
        altTextVerified: true,
        placementVerified: true,
        verifiedAt: "2026-09-18T02:47:10.000Z",
      },
      createdAt: "2026-09-18T02:47:00.000Z",
    } as SitePageMediaAssignment;

    const strictResult = deriveGeneratedPageReviewModel({
      campaign: strictCampaign,
      target: strictTarget,
      job: strictJob,
      siteName: "LEDDisplayWarehouse.com",
      domain: "leddisplaywarehouse.com",
      productName: "Outdoor Digital Sphere",
      productAuthorityReference: "wordpress-media:20162",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: strictCampaign.campaignId, organizationId: strictCampaign.organizationId, siteId: strictCampaign.siteId, instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: strictCampaign.productId, scope: "stable_fact" }], updatedAt: "2026-09-18" },
      wordpressDraft: { id: 20163, slug: "florida", status: "draft", link: "https://leddisplaywarehouse.com/?page_id=20163", modified_gmt: "2026-09-18T02:47:12", featured_media: 20162, title: { raw: strictJob.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 20162, source_url: legacyUrl, alt_text: "Legacy media alt" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://leddisplaywarehouse.com/wp-admin/post.php?post=20163&action=edit",
      mediaAssignments: [generatedAssignment],
      approvedProductMedia: null,
      referenceLocations: [],
      authoritativeContextualMedia: [{ assignmentId: generatedAssignment.assignmentId, role: "CONTEXTUAL_IN_USE", semanticRole: "CONTEXTUAL_IN_USE", mediaId: "20166", rendered: true }],
      authoritativePageRevisionIdentity: pageRevisionIdentity,
      generatedContextualReceipts: [{ generationId: "contextual-generation-fl", campaignId: strictCampaign.campaignId, targetId: strictTarget.targetId, productId: strictCampaign.productId, wordpressObjectId: "20163", pageRevisionId: pageRevisionIdentity, mediaRole: "CONTEXTUAL_IN_USE", wordpressMediaId: 20166 }],
    });

    expect(strictResult.images.contextualInUse.state).toBe("GENERATED_CONTEXTUAL");
    expect(strictResult.images.contextualInUse.imageUrl).toBe(generatedUrl);
    expect(strictResult.images.contextualInUse.wordpressMediaId).toBe("20166");
    expect(strictResult.images.contextualInUse.assignmentId).toBe(generatedAssignment.assignmentId);
    expect(strictResult.images.contextualInUse.altText).toBe(generatedAssignment.metadata.altText);
    expect(strictResult.images.contextualInUse.imageUrl).not.toBe(legacyUrl);
    expect(strictResult.richComposition.preview.contextualImageUrl).toBe(generatedUrl);
    expect(strictResult.richComposition.preview.contextualAltText).toBe(generatedAssignment.metadata.altText);
  });

  test("strict outdoor sphere carry-forwards prior generated contextual media only for CURRENT PASS rendered featured-media identity and fails closed on media mismatch", () => {
    const strictCampaign = {
      ...campaign,
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
    } as GlwCampaign;
    const strictTarget = {
      ...target,
      targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-fl",
      campaignId: strictCampaign.campaignId,
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      productId: strictCampaign.productId,
      status: "draft_ready",
      wordpressObjectId: "20163",
      cityName: "Miami",
      stateCode: "FL",
    } as GlwCampaignTarget;
    const strictJob = {
      ...job,
      jobId: "5d877113-638a-40d0-9252-6390ec97c837",
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      campaignId: strictCampaign.campaignId,
      productId: strictCampaign.productId,
      state: "Florida",
      city: "Miami",
      wordpressObjectId: "20163",
      wordpressStatus: "publish",
      updatedAt: "2026-09-18T03:01:59.526Z",
      featuredImagePresent: true,
    } as GlwPageExecutionRecord;
    const currentPageRevisionIdentity = "job:5d877113-638a-40d0-9252-6390ec97c837:2026-09-18T03:01:59.526Z";
    const priorPageRevisionIdentity = "job:5d877113-638a-40d0-9252-6390ec97c837:2026-09-18T02:46:59.526Z";
    const generatedUrl = "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/fl-contextual-generated.jpg";
    const priorGeneratedAssignment = {
      assignmentId: "media-assignment-job:5d877113-638a-40d0-9252-6390ec97c837-POST_HERO_CONTEXTUAL",
      organizationId: strictCampaign.organizationId,
      siteId: strictCampaign.siteId,
      buildSessionId: `contextual-media:${strictTarget.targetId}`,
      pageId: strictTarget.targetId,
      pageRevisionId: priorPageRevisionIdentity,
      slotId: "POST_HERO_CONTEXTUAL",
      role: "CONTEXTUAL_IN_USE",
      asset: {
        type: "GENERATED",
        provider: "OPENAI_IMAGE",
        model: "gpt-image-2",
        generationJobId: "contextual-generation-fl",
        effectivePrompt: "Conceptual contextual visualization only.",
        referenceInputs: [],
        outputSha256: "a".repeat(64),
      },
      metadata: {
        altText: "Conceptual contextual visualization in Miami, Florida; not a real customer installation.",
        caption: null,
        title: "CONTEXTUAL IN USE",
        description: "Generated contextual media",
      },
      approval: {
        candidateId: "contextual-generation-fl",
        approvedBy: "owner",
        approvedAt: "2026-09-18T02:47:00.000Z",
      },
      wordpressReceipt: {
        mediaId: 20166,
        url: generatedUrl,
        attachedToObjectId: "20163",
        altTextVerified: true,
        placementVerified: true,
        verifiedAt: "2026-09-18T02:47:10.000Z",
      },
      createdAt: "2026-09-18T02:47:00.000Z",
    } as SitePageMediaAssignment;
    const currentPassCertification = {
      certificationId: "cert-fl-current",
      contract: "rendered-visual-certification-v1",
      schemaVersion: 1,
      identity: {
        organizationId: strictCampaign.organizationId,
        siteId: strictCampaign.siteId,
        pageId: strictTarget.targetId,
        pageRevisionIdentity: currentPageRevisionIdentity,
        canonicalPath: strictTarget.canonicalPath,
        contentHash: "b".repeat(64),
        renderedContentHash: "c".repeat(64),
        campaignId: strictCampaign.campaignId,
        targetId: strictTarget.targetId,
        jobId: strictJob.jobId,
        externalExecutionId: strictJob.externalExecutionId,
        wordpressObjectId: "20163",
        wordpressStatus: "publish",
      },
      layoutClass: "CONTENT_ARTICLE",
      captureSetId: "capture-fl-current",
      captures: [],
      findings: [],
      overallState: "PASS",
      capturedAt: "2026-09-18T03:02:00.000Z",
      createdAt: "2026-09-18T03:02:00.000Z",
      createdBy: "owner",
      mutationPerformed: false,
    } as RenderedVisualCertification;

    const carryForwardResult = deriveGeneratedPageReviewModel({
      campaign: strictCampaign,
      target: strictTarget,
      job: strictJob,
      siteName: "LEDDisplayWarehouse.com",
      domain: "leddisplaywarehouse.com",
      productName: "Outdoor Digital Sphere",
      productAuthorityReference: "wordpress-media:20162",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: strictCampaign.campaignId, organizationId: strictCampaign.organizationId, siteId: strictCampaign.siteId, instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: strictCampaign.productId, scope: "stable_fact" }], updatedAt: "2026-09-18" },
      wordpressDraft: { id: 20163, slug: "florida", status: "publish", link: "https://leddisplaywarehouse.com/?page_id=20163", modified_gmt: "2026-09-18T03:02:12", featured_media: 20166, title: { raw: strictJob.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 20166, source_url: "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/fl-featured.jpg", alt_text: "Featured media alt" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://leddisplaywarehouse.com/wp-admin/post.php?post=20163&action=edit",
      mediaAssignments: [priorGeneratedAssignment],
      approvedProductMedia: null,
      referenceLocations: [],
      visualCertification: {
        certification: currentPassCertification,
        decision: null,
        certificationState: "CURRENT",
        decisionState: "PENDING",
      },
      authoritativeContextualMedia: [{ assignmentId: priorGeneratedAssignment.assignmentId, role: "CONTEXTUAL_IN_USE", semanticRole: "CONTEXTUAL_IN_USE", mediaId: "20166", rendered: true }],
      authoritativePageRevisionIdentity: currentPageRevisionIdentity,
      generatedContextualReceipts: [{ generationId: "contextual-generation-fl", campaignId: strictCampaign.campaignId, targetId: strictTarget.targetId, productId: strictCampaign.productId, wordpressObjectId: "20163", pageRevisionId: priorPageRevisionIdentity, mediaRole: "CONTEXTUAL_IN_USE", wordpressMediaId: 20166 }],
    });

    expect(carryForwardResult.images.contextualInUse.state).toBe("GENERATED_CONTEXTUAL");
    expect(carryForwardResult.images.contextualInUse.imageUrl).toBe(generatedUrl);
    expect(carryForwardResult.images.contextualInUse.wordpressMediaId).toBe("20166");
    expect(carryForwardResult.images.contextualInUse.assignmentId).toBe(priorGeneratedAssignment.assignmentId);

    const mismatchMediaResult = deriveGeneratedPageReviewModel({
      campaign: strictCampaign,
      target: strictTarget,
      job: strictJob,
      siteName: "LEDDisplayWarehouse.com",
      domain: "leddisplaywarehouse.com",
      productName: "Outdoor Digital Sphere",
      productAuthorityReference: "wordpress-media:20162",
      productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
      knowledgePack: { campaignId: strictCampaign.campaignId, organizationId: strictCampaign.organizationId, siteId: strictCampaign.siteId, instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: strictCampaign.productId, scope: "stable_fact" }], updatedAt: "2026-09-18" },
      wordpressDraft: { id: 20163, slug: "florida", status: "publish", link: "https://leddisplaywarehouse.com/?page_id=20163", modified_gmt: "2026-09-18T03:02:12", featured_media: 20167, title: { raw: strictJob.title }, content: { raw: contentHtml } } as never,
      wordpressMedia: { id: 20167, source_url: "https://leddisplaywarehouse.com/wp-content/uploads/2026/09/fl-featured-other.jpg", alt_text: "Other featured media alt" } as never,
      wordpressReadState: "AUTHENTICATED_EXACT_DRAFT_READ",
      wordpressEditUrl: "https://leddisplaywarehouse.com/wp-admin/post.php?post=20163&action=edit",
      mediaAssignments: [priorGeneratedAssignment],
      approvedProductMedia: null,
      referenceLocations: [],
      visualCertification: {
        certification: currentPassCertification,
        decision: null,
        certificationState: "CURRENT",
        decisionState: "PENDING",
      },
      authoritativeContextualMedia: [{ assignmentId: priorGeneratedAssignment.assignmentId, role: "CONTEXTUAL_IN_USE", semanticRole: "CONTEXTUAL_IN_USE", mediaId: "20166", rendered: true }],
      authoritativePageRevisionIdentity: currentPageRevisionIdentity,
      generatedContextualReceipts: [{ generationId: "contextual-generation-fl", campaignId: strictCampaign.campaignId, targetId: strictTarget.targetId, productId: strictCampaign.productId, wordpressObjectId: "20163", pageRevisionId: priorPageRevisionIdentity, mediaRole: "CONTEXTUAL_IN_USE", wordpressMediaId: 20166 }],
    });

    expect(mismatchMediaResult.images.contextualInUse.state).toBe("MISSING");
  });
});