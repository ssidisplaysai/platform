jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOUSTON_BUNDLE_ID, HOUSTON_CANONICAL_PATH, HOUSTON_MARKET_BUNDLE_ID, HOUSTON_NARRATIVE, HOUSTON_PREVIEW_ID, HOUSTON_PRODUCT_MEDIA_HASH, HOUSTON_TARGET_ID } from "../houston-reference-preview";

const service = readFileSync(join(process.cwd(), "src/modules/glw/houston-reference-preview-service.ts"), "utf8");
const capture = readFileSync(join(process.cwd(), "src/modules/glw/houston-reference-preview-capture-service.ts"), "utf8");
const route = readFileSync(join(process.cwd(), "src/app/api/glw/houston-reference-preview/route.ts"), "utf8");
const preview = readFileSync(join(process.cwd(), "src/modules/glw/GlwMarketInformedReferencePreview.tsx"), "utf8");
const review = readFileSync(join(process.cwd(), "src/modules/glw/GlwHoustonReferencePreviewReview.tsx"), "utf8");

describe("Houston reference preview contract", () => {
  test("uses exact queued-target identity without a fabricated job", () => {
    expect(HOUSTON_TARGET_ID).toContain("tx-houston");
    expect(HOUSTON_CANONICAL_PATH).toBe("fan-cooled-projector-enclosures/texas/houston");
    expect(HOUSTON_PREVIEW_ID).toBe("houston-reference-preview-v1");
    expect(service).toContain("jobId: null");
    expect(service).toContain('target.status !== "queued"');
    expect(service).toContain("target.jobId");
    expect(service).toContain("target.wordpressObjectId");
  });

  test("keeps Houston research, market, theme, links, and media distinct from Dallas", () => {
    expect(HOUSTON_BUNDLE_ID).toContain("houston-southeast-texas");
    expect(HOUSTON_MARKET_BUNDLE_ID).toContain("houston-southeast-texas");
    expect(service).toContain("local-context-houston-southeast-texas-r1");
    expect(service).toContain("local-links-houston-southeast-texas-r1");
    expect(service).toContain("local-theme-houston-southeast-texas-r1");
    expect(service).toContain("market-intelligence-houston-southeast-texas-r1");
    expect(service).toContain("no Dallas local evidence reused");
    expect(service).not.toContain("dallasculture.org");
    expect(service).not.toContain("dallasconventioncenter.com");
  });

  test("independently selects commercial AV and does not inherit Dallas primary emphasis", () => {
    expect(service).toContain('primaryApplication: "COMMERCIAL_AV"');
    expect(service).toContain('supportingApplications: ["EVENT_VENUE", "PROJECTION_MAPPING"]');
    expect(service).toContain('PRODUCT_FIT: "INSUFFICIENT"');
    expect(HOUSTON_NARRATIVE.applicationBody).toContain("Projection mapping remains a bounded supporting use");
  });

  test("preserves product truth and routes harsh exposure to verified climate authority", () => {
    expect(HOUSTON_PRODUCT_MEDIA_HASH).toHaveLength(64);
    expect(service).toContain("HOUSTON_PRODUCT_MEDIA_AUTHORITY_STALE");
    expect(service).toContain('applicationId: "OUTDOOR_PROJECTION"');
    expect(service).toContain('compatibility: "UNSUPPORTED"');
    expect(HOUSTON_NARRATIVE.suitabilityBody).toContain("Climate Controlled Projector Enclosures");
    expect(service).toContain("crossSellCatalogItemIds: []");
  });

  test("enforces anti-cliche and false-proximity safeguards", () => {
    for (const term of ["cowboy", "Texas flag", "western font", "desert", "ranch", "oil derrick", "space city cliché"]) expect(service).toContain(term);
    for (const claim of ["SSI has a Houston office", "a depicted Houston venue is a customer", "a generated scene is an actual Houston installation"]) expect(service).toContain(claim);
    expect(preview).toContain("without local-presence claims");
    expect(preview).toContain("Not a Houston venue, customer, or installation");
  });

  test("creates four distinct semantic roles with required grounding", () => {
    for (const role of ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"]) expect(service).toContain(role);
    expect(service).toContain('claimClass: "CONCEPTUAL_CONTEXTUAL"');
    expect(service).toContain('claimClass: "APPLICATION_VISUALIZATION"');
    expect(service).toContain('claimClass: "ATMOSPHERIC"');
    expect(service).toContain("productTruthReference");
  });

  test("keeps generation preview-only with no apply, publish, dispatch, or WordPress creation control", () => {
    expect(route).toContain("wordpressMutationPerformed: false");
    expect(route).toContain("wordpressCreated: false");
    expect(route).toContain("campaignMutationPerformed: false");
    expect(route).toContain("jobCreated: false");
    expect(route).toContain("executionCreated: false");
    expect(route).toContain("dispatchPerformed: false");
    expect(route).toContain("publicationPerformed: false");
    expect(review).toContain("NO APPLY OR PUBLISH CONTROL");
    expect(review).not.toMatch(/>Apply</);
    expect(review).not.toMatch(/>Publish</);
  });

  test("requires four responsive preview captures and owner review", () => {
    for (const viewport of ["DESKTOP_1440", "DESKTOP_1024", "TABLET_768", "MOBILE_375"]) expect(capture).toContain(viewport);
    expect(capture).toContain("ownerReviewRequired: true");
    expect(capture).toContain("countsAsWordPressRenderCertification: false");
    expect(capture).toContain("wordpressMutationPerformed: false");
    expect(preview).toContain('data-preview-authority="PREVIEW_ONLY"');
  });
});
