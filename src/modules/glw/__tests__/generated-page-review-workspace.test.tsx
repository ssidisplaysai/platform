jest.mock("server-only", () => ({}));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveGeneratedPageReviewModel } from "../generated-page-review-read-model";
import { GlwGeneratedPageReviewWorkspace } from "../GlwGeneratedPageReviewWorkspace";
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

function model(overrides: { wordpressDraft?: object | null; wordpressMedia?: object | null; readState?: string } = {}) {
  return deriveGeneratedPageReviewModel({
    campaign, target, job, siteName: "ProjectorEnclosure.com", domain: "projectorenclosure.com", productName: "Fan Cooled Projector Enclosures", productAuthorityReference: "wordpress-media:10757", productAuthoritySource: "OWNER_APPROVED_CANONICAL_PRODUCT",
    knowledgePack: { campaignId: campaign.campaignId, organizationId: "ssi", siteId: "site-projector", instructions: "Use approved authority.", references: [], revision: 2, status: "ready", authorityReferences: [{ sourceType: "product", sourceId: "product-enclosure", scope: "stable_fact" }], updatedAt: "2026-09-12" },
    wordpressDraft: overrides.wordpressDraft === undefined ? { id: 13084, slug: "dallas", status: "draft", link: "https://projectorenclosure.com/?page_id=13084", modified_gmt: "2026-09-12T02:00:00", featured_media: 10757, title: { raw: job.title }, content: { raw: contentHtml } } : overrides.wordpressDraft as never,
    wordpressMedia: overrides.wordpressMedia === undefined ? { id: 10757, source_url: "https://projectorenclosure.com/wp-content/uploads/enclosure.jpg", alt_text: "Fan cooled projector enclosure in use" } : overrides.wordpressMedia as never,
    wordpressReadState: overrides.readState ?? "AUTHENTICATED_EXACT_DRAFT_READ", wordpressEditUrl: "https://projectorenclosure.com/wp-admin/post.php?post=13084&action=edit",
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
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ category: "IMAGE", severity: "WARNING", what: "Product authority not wired" })]));
    expect(result.issues.some((issue) => issue.category === "POLICY")).toBe(false);
    expect(result.reviewState).toBe("NEEDS_ATTENTION");
    expect(result.visualQa).toMatchObject({ contractExists: false, gapIdentified: true, desktopLayout: "NOT_EVALUATED", heroComposition: "NOT_EVALUATED", sectionComposition: "NOT_EVALUATED", mediaPlacement: "NOT_EVALUATED", mobileLayout: "NOT_EVALUATED" });
  });

  test("renders live and source previews, readable review evidence, and no publish action", () => {
    const html = renderToStaticMarkup(<GlwGeneratedPageReviewWorkspace model={model()} />);
    expect(html).toContain("Fan Cooled Projector Enclosures in Dallas");
    expect(html).toContain("Dallas, TX");
    expect(html).toContain("#13084 · DRAFT");
    expect(html).toContain("DRAFT READY");
    expect(html).toContain("Actual WordPress Draft");
    expect(html).toContain("Genesis Source / Assembly Preview");
    expect(html).toContain("Rendered Visual QA");
    expect(html).toContain("Browser viewport");
    expect(html).toContain("NOT EVALUATED");
    expect(html).toContain("Product Authority");
    expect(html).toContain("NOT WIRED");
    expect(html).toContain("Contextual In-Use");
    expect(html).toContain("Generation / Execution Trace");
    expect(html).toContain("579510");
    expect(html).not.toMatch(/>Publish(?: Page)?</);
    expect(html).not.toContain("Approve Review");
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
});