import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(
  join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-draft-persistence/route.ts"),
  "utf8",
);

describe("reference draft persistence route", () => {
  test("uses distinct persistence authority and never invokes generation infrastructure", () => {
    expect(route).toContain("REFERENCE_DRAFT_PERSISTENCE");
    expect(route).toContain("resolveGlwTrustedOperatorPrincipal");
    expect(route).toContain('authorizeRequest(request, "sites:update")');
    expect(route).not.toContain("execute_workflow");
    expect(route).not.toContain("createGlwDraftExecutionService");
    expect(route).not.toContain("issueGlwReferenceOwnerGrant");
    expect(route).not.toContain("consumeGlwReferenceOwnerGrant");
  });

  test("consumes the exact persistence grant before the sole WordPress write", () => {
    const consume = route.indexOf("consumeGlwReferenceDraftPersistenceGrant({");
    const write = route.indexOf("writeGenesisWordPressDraft({");
    const readback = route.indexOf("const readback = await resolved.reader.getJson");
    const reconcile = route.indexOf("createGlwReferenceContentReconciliationReceipt({");
    const update = route.indexOf("const updated = await glwPageExecutionRepository.update");
    expect(consume).toBeGreaterThan(0);
    expect(consume).toBeLessThan(write);
    expect(write).toBeLessThan(readback);
    expect(readback).toBeLessThan(reconcile);
    expect(reconcile).toBeLessThan(update);
    expect(route.match(/writeGenesisWordPressDraft\(\{/g)).toHaveLength(1);
    expect(route).toContain('operation: "CREATE"');
  });

  test("requires exact certified lineage and stores raw, canonical, QA, authority, and readback evidence", () => {
    for (const marker of [
      "rawArtifactSha256", "canonicalizedArtifactSha256", "canonicalizationReceiptId",
      "canonicalizationPolicyFingerprint", "generatorContractFingerprint", "qaFingerprint",
      "wordpressReadAuthorityFingerprint", "rawGeneratedDraft", "canonicalizedGeneratedDraft",
      "canonicalizationReceipt", "draftPersistenceAuthority", "wordpressReadback",
    ]) expect(route).toContain(marker);
    expect(route).toContain("CANONICALIZED_ARTIFACT_NOT_CERTIFIED");
    expect(route).toContain("FINAL_PRE_PERSISTENCE_QA_FAILED");
    expect(route).toContain("WORDPRESS_STORED_CONTENT_QA_FAILED");
    expect(route).toContain('wordpressStatus: "draft"');
  });
});
