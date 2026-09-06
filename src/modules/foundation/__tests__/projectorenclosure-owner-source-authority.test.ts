import { canEstablishProductTruth } from "../visual-product-authority";
import { PROJECTORENCLOSURE_FAMILY_AUTHORITY, PROJECTORENCLOSURE_OWNER_CONFLICTS, PROJECTORENCLOSURE_OWNER_FACTS, PROJECTORENCLOSURE_OWNER_SOURCES, PROJECTORENCLOSURE_OWNER_VISUALS, validateOwnerSourceAuthorityRegistry } from "../projectorenclosure-owner-source-authority";

describe("ProjectorEnclosure owner-source authority", () => {
  test("preserves immutable source provenance and declared checksum deduplication", () => {
    expect(validateOwnerSourceAuthorityRegistry()).toEqual([]);
    expect(PROJECTORENCLOSURE_OWNER_SOURCES.every((source) => source.locator.startsWith("owner-local:") && source.byteSize > 0)).toBe(true);
    expect(PROJECTORENCLOSURE_OWNER_SOURCES.find((source) => source.sourceId === "owner-pdf:defender-ac-measurements-copy")).toMatchObject({ extractionStatus: "DUPLICATE_REGISTERED", duplicateOf: "owner-pdf:defender-ac-measurements" });
  });

  test("binds every fact to an exact source and evidence location", () => {
    const sourceIds = new Set(PROJECTORENCLOSURE_OWNER_SOURCES.map((source) => source.sourceId));
    expect(PROJECTORENCLOSURE_OWNER_FACTS.length).toBeGreaterThanOrEqual(20);
    expect(PROJECTORENCLOSURE_OWNER_FACTS.every((fact) => sourceIds.has(fact.sourceId) && /^(?:page|member):/.test(fact.evidenceLocation))).toBe(true);
  });

  test("registers only verified owner visuals as product truth", () => {
    expect(PROJECTORENCLOSURE_OWNER_VISUALS).toHaveLength(4);
    expect(PROJECTORENCLOSURE_OWNER_VISUALS.every(canEstablishProductTruth)).toBe(true);
    expect(PROJECTORENCLOSURE_OWNER_VISUALS.every((visual) => visual.durableSourceId.includes("sha256:") && visual.wordpressMediaId === null)).toBe(true);
  });

  test("fails closed on source conflicts and ambiguous UST identity", () => {
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.map((conflict) => conflict.conflictId)).toEqual(expect.arrayContaining(["defender-ip-rating", "hush-size-table", "ust-cc-filename-identity", "homeline-xs-exterior-dimensions"]));
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.find((conflict) => conflict.conflictId === "ust-cc-filename-identity")?.disposition).toBe("IDENTITY_AMBIGUOUS");
  });

  test("keeps conflicted families out of verified status", () => {
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.HUSH.status).toBe("CONFLICTED_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.DEFENDER.status).toBe("CONFLICTED_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.CLIMATE_CONTROLLED.status).toBe("CONFLICTED_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.UST_HUSH.status).toBe("PARTIAL_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.PROJECTOR_CAGE.status).toBe("PARTIAL_PRODUCT_AUTHORITY");
  });
});
