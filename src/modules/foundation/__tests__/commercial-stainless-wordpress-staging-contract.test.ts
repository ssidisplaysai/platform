import fs from "node:fs";
import path from "node:path";

const staging = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wordpress-staging.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-1-staging/route.ts"), "utf8");

describe("Commercial Stainless WordPress Wave 1 staging contract", () => {
  test("hard-binds the authorized objects and approved references", () => {
    expect(staging).toContain('COMMERCIAL_STAINLESS_APPROVED_WAVE_1_SHA = "c1d94a4b80661397a67d1ba8674c0ea8f71c3e19"');
    expect(staging).toContain("const AUTHORIZED_IDS = [24, 11, 13, 17, 23] as const");
    expect(staging).toContain("COMMERCIAL_STAINLESS_WAVE_1_PATHS");
  });

  test("uses only native autosave creation and exact revision deletion for rollback", () => {
    expect(staging).toContain("/autosaves");
    expect(staging).toContain("method: \"POST\"");
    expect(staging).toContain("/revisions/${input.revisionId}?force=true");
    expect(staging).toContain("method: \"DELETE\"");
    expect(staging).not.toMatch(/\/pages\/\$\{wordpressObjectId\}[^/]*`, \{ method: "POST"|status:\s*"draft"|status:\s*"publish"/);
  });

  test("persists rollback evidence before writes and verifies parent and public hashes", () => {
    expect(staging.indexOf('status: "PREPARED"')).toBeLessThan(staging.indexOf("/autosaves`, { method: \"POST\""));
    for (const marker of ["contentRaw", "currentContentHash", "currentPublicBodyHash", "PUBLISHED_PARENT_CHANGED", "PUBLIC_BODY_CHANGED", "AUTOSAVE_RAW_HASH_MISMATCH", "AUTOSAVE_RENDER_MISSING"]) expect(staging).toContain(marker);
    expect(staging).toContain("created.reverse()");
    expect(staging).toContain("AUTOSAVE_DELETE_FAILED");
  });

  test("requires explicit authenticated staging and never reports publication mutation", () => {
    expect(route).toContain('authorizeRequest(request, "sites:manage_integrations")');
    expect(route).toContain('STAGE_COMMERCIAL_STAINLESS_WAVE_1_AUTOSAVES');
    expect(route).toContain("publicationMutation: false");
    expect(route).not.toMatch(/publishGenesis|EXECUTE_APPROVED_PUBLICATION|status:\s*"publish"/);
  });

  test("certifies publication readiness separately with fresh autosave, parent, and public invariants", () => {
    expect(route).toContain("CERTIFY_COMMERCIAL_STAINLESS_WAVE_1_AUTOSAVES");
    expect(staging).toContain("certifyCommercialStainlessWordPressWave1");
    for (const marker of ["VISUAL_CERTIFICATION_FAILED", "WORDPRESS_INVARIANT_FAILED", "PUBLICATION_READY", "stagedRenderedHash", "publicBodyHashBefore"]) expect(staging).toContain(marker);
    expect(route).toContain("wordpressMutation: false");
  });
});