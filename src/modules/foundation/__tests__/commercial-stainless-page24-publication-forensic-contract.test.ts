import fs from "node:fs";
import path from "node:path";

const forensic = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-page24-publication-forensic.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-page24-publication-forensic/route.ts"), "utf8");

describe("Commercial Stainless Page 24 publication forensic contract", () => {
  test("is read-only and bound to Page 24 autosave 88", () => {
    expect(forensic).toContain("const PAGE_ID = 24");
    expect(forensic).toContain("const AUTOSAVE_ID = 88");
    expect(forensic).toContain("mutationPerformed: false");
    expect(route).toContain('authorizeRequest(request, "sites:read")');
    expect(route).not.toMatch(/export async function POST|method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  });

  test("recovers the complete hash chain and revision candidates without content disclosure", () => {
    for (const marker of ["expectedReviewedAutosaveHash", "expectedReviewedRenderedHash", "requestPayloadContentHash", "promotedRevisionCandidates", "rollbackRevisionCandidates", "failedPublicRenderHash", "currentSafe"]) expect(forensic).toContain(marker);
    expect(forensic).not.toContain("contentRaw:");
  });

  test("maps staged, promotion, stored, and public authorities", () => {
    for (const marker of ["stagedAuthority", "promotionAuthority", "storedPublishedAuthority", "publicRenderAuthority", "elementorEvidence", "reusableBlockReferences", "templateBlockSequence", "featuredImageBeforePostContent", "twentytwentyfive//page"]) expect(forensic).toContain(marker);
  });

  test("captures cache headers and repeated browser-independent public hashes", () => {
    for (const marker of ["cacheControl", "cfCacheStatus", "xCache", "cacheReadsStable", "publicRead(),", "publicRead(),", "publicRead(),"]) expect(forensic).toContain(marker);
  });
});