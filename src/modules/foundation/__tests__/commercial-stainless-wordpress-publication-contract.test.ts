import fs from "node:fs";
import path from "node:path";

const publication = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wordpress-publication.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-1-publication/route.ts"), "utf8");

describe("Commercial Stainless WordPress Wave 1 publication contract", () => {
  test("hard-binds the owner-authorized objects, autosaves, profiles, and implementation", () => {
    for (const marker of ["3a2dd3980bf03022d6fabc7403b4c18bfba5ed31", "wordpressObjectId: 24, autosaveId: 88", "wordpressObjectId: 11, autosaveId: 89", "wordpressObjectId: 13, autosaveId: 90", "wordpressObjectId: 17, autosaveId: 91", "wordpressObjectId: 23, autosaveId: 92", "LANDING_CONVERSION", "CAPABILITY", "PRODUCT_SERVICE", "INDUSTRY_APPLICATION", "RESOURCE"]) expect(publication).toContain(marker);
  });

  test("binds the Page 24 canary retry independently from the earlier rolled-back receipt", () => {
    for (const marker of ["32c2d638d1a0e2e9d35d94bdb426fed9e9725808", "COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLICATION_RETRY_V1:APPROVED", "csc-page24-canary-publication-retry-v1-24-88", "COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTOSAVE_HASH", "publishCommercialStainlessPage24Canary"]) expect(publication).toContain(marker);
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY");
    expect(route).toContain("Page 24 is the only authorized canary target.");
  });

  test("binds V2 to the featured-image render repair and strengthens actual public media predicates", () => {
    for (const marker of ["222dd49cfe790cdd50fe097d8b8e7f2a9d868fd0", "COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLICATION_RETRY_V2:APPROVED", "csc-page24-canary-publication-retry-v2-24-88", "publishCommercialStainlessPage24CanaryV2", "themeFeaturedImageCount", "embeddedRichMediaCount", "duplicateFeaturedImage"]) expect(publication).toContain(marker);
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V2");
    expect(route).toContain("Page 24 is the only authorized V2 canary target.");
  });

  test("binds V3 only to Page 24 and the host-spacing repair authority", () => {
    for (const marker of ["e79dbbefd87bf442a000c6928b403fcc796338ba", "COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLICATION_RETRY_V3:APPROVED", "csc-page24-canary-publication-retry-v3-24-88", "publishCommercialStainlessPage24CanaryV3"]) expect(publication).toContain(marker);
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_PAGE24_CANARY_V3");
    expect(route).toContain("Page 24 is the only authorized V3 canary target.");
  });

  test("binds remaining Wave 1 publication to four objects in exact sequential order", () => {
    for (const marker of ["COMMERCIAL_STAINLESS_WAVE1_REMAINING_SEQUENTIAL_PUBLICATION_V1:APPROVED", "COMMERCIAL_STAINLESS_WAVE1_REMAINING_ORDER = [11, 13, 17, 23]", "csc-wave1-remaining-v1-", "COMMERCIAL_STAINLESS_REMAINING_SEQUENCE_BLOCKED", "publishCommercialStainlessRemainingWave1Page"]) expect(publication).toContain(marker);
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE1_REMAINING_PAGE");
    expect(route).toContain("Only objects 11, 13, 17, and 23 are authorized.");
  });

  test("requires exact certified autosave hashes and sequential public certification", () => {
    for (const marker of ["stage.stagedContentHash", "stage.stagedRenderedHash", "stage.certification", "COMMERCIAL_STAINLESS_PUBLICATION_SEQUENCE_BLOCKED", "PUBLISHED_PENDING_VISUAL", "PUBLIC_CERTIFIED"]) expect(publication).toContain(marker);
    expect(publication.indexOf('status: "PREPARED"')).toBeLessThan(publication.indexOf("await updateContent"));
  });

  test("updates content only and rolls back before reporting a failed page", () => {
    expect(publication).toContain('body: JSON.stringify({ content: input.content })');
    expect(publication).not.toMatch(/JSON\.stringify\(\{[^}]*status|status:\s*"publish"/);
    for (const marker of ["rollbackAuthority", "await rollback", "ROLLBACK_FAILED", "semanticPass", "seoPreserved", "identityPreserved"]) expect(publication).toContain(marker);
  });

  test("uses structural shell authority, converged reads, and durable failed responses", () => {
    for (const marker of ["verifyWordPressTemplateStructure", "verifyRenderedWhitespace", "layoutEvidence.length === 4", "convergePublicVerification", "requiredConsecutiveReads: 2", "maxAttempts: 5", "timeoutMs: 10_000", "responseBodyHtml", "responseHeaders", "predicateMatrix", "verificationFailure", "expectedStoredContentHash", "actualStoredContentHash", 'status: "BLOCKED"']) expect(publication).toContain(marker);
    expect(publication).not.toContain("min-height:\\s*(?:[5-9]\\d\\d|\\d{4,})px");
    expect(publication.indexOf('status: "BLOCKED"')).toBeLessThan(publication.indexOf("const restored = await rollback"));
  });

  test("uses governed semantic media classification instead of raw duplicate source counts", () => {
    for (const marker of ["extractRenderedMediaInstances", "evaluateSemanticMediaReuse", "commercialStainlessMediaReuseDeclarations", "semanticMediaReusePass", "mediaDuplicationFindings", "hostDuplicateMediaCount > 0"]) expect(publication).toContain(marker);
    expect(publication).not.toContain("new Set(mediaSources).size !== mediaSources.length");
  });

  test("persists failed visual evidence before exact rollback and public restoration verification", () => {
    expect(publication.indexOf('status: "BLOCKED", visualCertification: visual')).toBeLessThan(publication.indexOf("const storedRestored = await rollback"));
    for (const marker of ["ROLLBACK_STORED_IDENTITY_FAILED", "ROLLBACK_PUBLIC_IDENTITY_FAILED", "receipt.prePublication.publicDocumentHash"]) expect(publication).toContain(marker);
  });

  test("exposes only explicit authenticated publish and public-certification commands", () => {
    expect(route).toContain('authorizeRequest(request, "sites:manage_integrations")');
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE_1_REVISION");
    expect(route).toContain("CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE_1_PUBLIC_RENDER");
    expect(route).toContain("body.implementationSha !== expectedSha");
    expect(route).toContain("remaining ? COMMERCIAL_STAINLESS_WAVE1_REMAINING_AUTHORITY_SHA : canaryV3 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_V3_HOST_SPACING_SHA : canaryV2 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_V2_RENDER_REPAIR_SHA : canaryV1 ? COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA : COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA");
  });

  test("redacts exact rollback bodies from API responses", () => {
    expect(publication).toContain("contentRaw: undefined");
    expect(route).toContain("summarizeCommercialStainlessWordPressPublicationReceipt");
  });
});