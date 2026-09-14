import fs from "node:fs";
import path from "node:path";

const publication = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wordpress-publication.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-1-publication/route.ts"), "utf8");

describe("Commercial Stainless WordPress Wave 1 publication contract", () => {
  test("hard-binds the owner-authorized objects, autosaves, profiles, and implementation", () => {
    for (const marker of ["3a2dd3980bf03022d6fabc7403b4c18bfba5ed31", "wordpressObjectId: 24, autosaveId: 88", "wordpressObjectId: 11, autosaveId: 89", "wordpressObjectId: 13, autosaveId: 90", "wordpressObjectId: 17, autosaveId: 91", "wordpressObjectId: 23, autosaveId: 92", "LANDING_CONVERSION", "CAPABILITY", "PRODUCT_SERVICE", "INDUSTRY_APPLICATION", "RESOURCE"]) expect(publication).toContain(marker);
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

  test("exposes only explicit authenticated publish and public-certification commands", () => {
    expect(route).toContain('authorizeRequest(request, "sites:manage_integrations")');
    expect(route).toContain("PUBLISH_EXACT_COMMERCIAL_STAINLESS_WAVE_1_REVISION");
    expect(route).toContain("CERTIFY_EXACT_COMMERCIAL_STAINLESS_WAVE_1_PUBLIC_RENDER");
    expect(route).toContain("implementationSha !== COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA");
  });

  test("redacts exact rollback bodies from API responses", () => {
    expect(publication).toContain("contentRaw: undefined");
    expect(route).toContain("summarizeCommercialStainlessWordPressPublicationReceipt");
  });
});