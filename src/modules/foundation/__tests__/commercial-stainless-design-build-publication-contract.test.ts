import fs from "node:fs";
import path from "node:path";
const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/modules/foundation/commercial-stainless-design-build-publication.ts",
  ),
  "utf8",
);
const route = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/api/sites/[siteId]/commercial-stainless-design-build-publication/route.ts",
  ),
  "utf8",
);
const compactSource = source.replace(/\s/g, "");
const compactRoute = route.replace(/\s/g, "");
describe("Design-Build exact publication", () => {
  test("hard binds object, revision, candidate and rollback hashes", () => {
    for (const m of [
      "COMMERCIAL_STAINLESS_DESIGN_BUILD_REPAIRED_CANDIDATE_PUBLICATION_V2",
      "DESIGN_BUILD_APPROVED_REVISION=119",
      "60d0a538b3d90c3c542b06c1ac55282c1b28ffa94bb04d5756bcbbc968e8a691",
      "f6b02c55646697fbe89a503834f550a22f896a42dc462397517c0ff3d590b5be",
    ])
      expect(compactSource).toContain(m);
  });
  test("copies autosave raw exactly and preserves identity", () => {
    expect(source).toContain("/pages/14/autosaves/${DESIGN_BUILD_APPROVED_REVISION}");
    expect(compactSource).toContain("sha(candidate)===DESIGN_BUILD_APPROVED_HASH");
    expect(compactSource).toContain("JSON.stringify({content})");
    for (const m of [
      "featuredMedia",
      "seoTitle",
      "description",
      "indexability",
    ])
      expect(source).toContain(m);
  });
  test("persists before write, converges actual host, and rolls back on failures", () => {
    expect(compactSource.indexOf('status:"PREPARED"')).toBeLessThan(
      compactSource.indexOf("if(!(awaitupdate"),
    );
    for (const m of [
      "PUBLISHED_PENDING_VISUAL",
      "PUBLIC_CERTIFIED",
      "PUBLIC_CONVERGENCE_FAILED",
      "awaitrollback",
      "ROLLED_BACK",
      "ACTUAL_PUBLIC_HOST_RENDER",
    ])
      expect(compactSource).toContain(m);
  });
  test("requires full visual, media, contrast and responsive gates", () => {
    for (const m of [
      "headerHeroGap===0",
      "heroEyebrowContrast>=4.5",
      "finalCtaEyebrowContrast>=4.5",
      "mainContentImageCount===5",
      "uniqueMainContentImageCount===5",
      "actualDuplicateMedia===0",
      "unreadableTextFailures===0",
    ])
      expect(compactSource).toContain(m);
  });
  test("route exposes exact object-only commands", () => {
    for (const m of [
      "PUBLISH_EXACT_REPAIRED_DESIGN_BUILD_CANDIDATE_V2",
      "RECOVER_EXACT_REPAIRED_DESIGN_BUILD_PUBLICATION_V2",
      "CERTIFY_EXACT_REPAIRED_DESIGN_BUILD_PUBLIC_RENDER_V2",
      "body.objectId!==14",
      "body.revision!==119",
    ])
      expect(compactRoute).toContain(m);
    expect(route).not.toMatch(/wave2|GLW|n8n/i);
  });
  test("requires repaired geometry, links, claims, cache evidence, and unchanged identity", () => {
    for (const marker of [
      "documentScrollWidth<=v.viewportWidth",
      "wrPageLeft>=0",
      "wrPageRight<=v.viewportWidth",
      "overflowMaskUsed===false",
      "brokenInternalLinks===0",
      "devLinks===0",
      "previewLinks===0",
      'claimSafety==="PASS"',
      "unsupportedClaims===0",
      "cacheClassification",
      "contentReconstructed:false",
      "copyChanged:false",
      "mediaChanged:false",
      "sha(reversedCandidate)===DESIGN_BUILD_PRE_REPAIR_HASH",
      "!candidate.includes(DESIGN_BUILD_OVERFLOW_RULE)",
      "DESIGN_BUILD_EXACT_ROLLBACK_AUTHORITY_REQUIRED",
    ])
      expect(compactSource).toContain(marker);
  });
});
