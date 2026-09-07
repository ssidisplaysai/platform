import { canEstablishProductTruth } from "../visual-product-authority";
import { PROJECTORENCLOSURE_FAMILY_AUTHORITY, PROJECTORENCLOSURE_OWNER_CONFLICTS, PROJECTORENCLOSURE_OWNER_FACTS, PROJECTORENCLOSURE_OWNER_RESOLUTIONS, PROJECTORENCLOSURE_OWNER_SOURCES, PROJECTORENCLOSURE_OWNER_VISUALS, validateOwnerSourceAuthorityRegistry } from "../projectorenclosure-owner-source-authority";

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

  test("preserves conflicts while recording controlling owner and source-precedence resolutions", () => {
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.map((conflict) => conflict.conflictId)).toEqual(expect.arrayContaining(["defender-ip-rating", "hush-size-table", "ust-cc-filename-identity", "homeline-xs-exterior-dimensions"]));
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.find((conflict) => conflict.conflictId === "defender-ip-rating")).toMatchObject({ disposition: "RESOLVED_BY_OWNER", controllingValue: "IP65 Equivalent" });
    expect(PROJECTORENCLOSURE_OWNER_RESOLUTIONS.find((resolution) => resolution.resolutionId === "owner-resolution:defender-model-prefix")).toMatchObject({
      controllingValue: "ENC-AC-SM->ENC-CC-SM; ENC-AC-MD->ENC-CC-MD; ENC-AC-LG->ENC-CC-LG; ENC-AC-LG+->ENC-CC-LG+; ENC-AC-XL->ENC-CC-XL",
      prohibitedExtrapolations: ["ENC-AC is not a current alias after remediation", "no mapping for any unlisted model"],
    });
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.find((conflict) => conflict.conflictId === "ust-cc-filename-identity")).toMatchObject({ disposition: "RESOLVED_BY_SOURCE_PRECEDENCE", controllingValue: "UST Hush Projector Enclosure" });
    expect(PROJECTORENCLOSURE_OWNER_CONFLICTS.find((conflict) => conflict.conflictId === "homeline-marketing-environment")?.disposition).toBe("OWNER_DECISION_REQUIRED");
    expect(PROJECTORENCLOSURE_OWNER_RESOLUTIONS).toHaveLength(7);
    expect(PROJECTORENCLOSURE_OWNER_RESOLUTIONS.every((resolution) => resolution.sourceClass === "OWNER_DIRECT_AUTHORITY" && resolution.ownerAuthorityStatus === "CONTROLLING" && resolution.prohibitedExtrapolations.length > 0)).toBe(true);
  });

  test("upgrades resolved families while retaining partial UST and cage authority", () => {
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.HUSH.status).toBe("VERIFIED_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.DEFENDER.status).toBe("VERIFIED_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.CLIMATE_CONTROLLED.status).toBe("VERIFIED_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.INTEGRATOR.status).toBe("VERIFIED_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.HOMELINE_XS.status).toBe("VERIFIED_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.UST_HUSH.status).toBe("PARTIAL_PRODUCT_AUTHORITY");
    expect(PROJECTORENCLOSURE_FAMILY_AUTHORITY.PROJECTOR_CAGE.status).toBe("PARTIAL_PRODUCT_AUTHORITY");
  });
});
