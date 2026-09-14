import fs from "node:fs";
import path from "node:path";

const staging = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/commercial-stainless-wordpress-staging.ts"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/commercial-stainless-wave-1-staging/route.ts"), "utf8");

describe("Commercial Stainless WordPress Wave 1 staging contract", () => {
  test("hard-binds the authorized objects and approved references", () => {
    expect(staging).toContain('COMMERCIAL_STAINLESS_APPROVED_WAVE_1_SHA = "c1d94a4b80661397a67d1ba8674c0ea8f71c3e19"');
    expect(staging).toContain("const AUTHORIZED_IDS = [24, 11, 13, 17, 23] as const");
    expect(staging).toContain("COMMERCIAL_STAINLESS_WAVE_1_PATHS");
    expect(staging).toContain("unauthorizedAutosaves");
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

  test("binds the Page 23 media repair to exact prior evidence and one approved replacement", () => {
    for (const marker of ["COMMERCIAL_STAINLESS_PAGE23_GOVERNED_REVISION_STAGING_V1:APPROVED", "f12ea05f629d60988a31969b138b472caffde88833557422cf5766a388602dc0", "COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_ID = 50", "design-build-fabrication.jpg", "stageCommercialStainlessPage23MediaRepair", 'wordpressObjectId: 23', 'profile: "RESOURCE"']) expect(staging).toContain(marker);
    expect(route).toContain("STAGE_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1");
  });

  test("persists Genesis authority before mutation and never claims publication readiness", () => {
    expect(staging.indexOf('status: "PREPARED", wordpressObjectId: 23')).toBeLessThan(staging.indexOf('`${resolved.apiBase}/pages/23/autosaves`, { method: "POST"'));
    for (const marker of ["priorAutosaveContentRaw", "preRepairRevisionIds", "postRepairRevisionIds", 'revisionAuthority: "GENESIS_DURABLE_EQUIVALENT"', 'status: "OWNER_REVIEW_READY"', "parentIdentityPreserved", "publicIdentityPreserved"]) expect(staging).toContain(marker);
    expect(staging).toContain("content: priorRaw");
    expect(staging).toContain("AUTOSAVE_ROLLBACK_FAILED");
    expect(route).toContain("publicationMutation: false");
  });

  test("persists repaired responsive evidence without another WordPress mutation", () => {
    for (const marker of ["certifyCommercialStainlessPage23MediaRepair", "CommercialStainlessPage23RepairVisualCertification", "mediaInstanceCount === 5", "repeatedSourceCount === 0", "primaryCapabilitiesImagePreserved", "replacementMediaPresent"]) expect(staging).toContain(marker);
    expect(route).toContain("CERTIFY_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1");
    expect(route).toContain("wordpressMutation: false");
    expect(staging).toContain('record.status !== "PUBLICATION_READY" ? ["OWNER_REVIEW_ONLY"]');
  });
});