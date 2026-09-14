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
      "COMMERCIAL_STAINLESS_DESIGN_BUILD_OWNER_APPROVED_PUBLICATION_V1",
      "DESIGN_BUILD_APPROVED_REVISION=116",
      "6a7fd9a24b5eaef25d4beaf858ad294e46c23dc35c22422a722be580d1904669",
      "f6b02c55646697fbe89a503834f550a22f896a42dc462397517c0ff3d590b5be",
    ])
      expect(compactSource).toContain(m);
  });
  test("copies autosave raw exactly and preserves identity", () => {
    expect(source).toContain("/pages/14/autosaves/116");
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
      "PUBLISH_EXACT_DESIGN_BUILD_CANDIDATE_V1",
      "RECOVER_EXACT_DESIGN_BUILD_COMMITTED_PUBLICATION_V1",
      "CERTIFY_EXACT_DESIGN_BUILD_ACTUAL_PUBLIC_RENDER_V1",
      "body.objectId!==14",
      "body.revision!==116",
    ])
      expect(compactRoute).toContain(m);
    expect(route).not.toMatch(/wave2|GLW|n8n/i);
  });
});
