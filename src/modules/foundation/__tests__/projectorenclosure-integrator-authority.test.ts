import { HOMELINE_PRODUCT_ID, INTEGRATOR_12596_VISUAL_PLAN, INTEGRATOR_AUTHORITY_CONFLICTS, INTEGRATOR_AUTHORITY_FACTS, INTEGRATOR_FAMILY_ID, INTEGRATOR_SOURCE_DOCUMENTS, INTEGRATOR_VISUAL_AUTHORITY, resolveIntegratorIdentity, XS_INTEGRATOR_HOMELINE_RELATIONSHIP } from "../projectorenclosure-integrator-authority";

describe("ProjectorEnclosure Integrator owner authority", () => {
  test.each(["Homeline", "XS Integrator", "Extra Small Integrator", "ENC-FC-XS"])("resolves %s to one Homeline product under the Integrator family", (alias) => {
    expect(resolveIntegratorIdentity(alias)).toEqual({ productId: HOMELINE_PRODUCT_ID, familyId: INTEGRATOR_FAMILY_ID, scope: "XS_INTEGRATOR_HOMELINE" });
  });

  test("does not merge larger Integrator sizes into Homeline", () => {
    for (const value of ["Integrator", "Small Integrator", "Medium Integrator", "Large Integrator", "ENC-FC-SM", "ENC-FC-MD", "ENC-FC-LG"]) expect(resolveIntegratorIdentity(value)).toBeNull();
    expect(XS_INTEGRATOR_HOMELINE_RELATIONSHIP.exclusions).toContain("Large Integrator");
  });

  test("keeps every fact page-scoped and size-scoped", () => {
    expect(INTEGRATOR_AUTHORITY_FACTS.every((fact) => fact.source.startsWith("owner-pdf:") && fact.page > 0 && fact.confidence === 1)).toBe(true);
    expect(INTEGRATOR_AUTHORITY_FACTS.filter((fact) => fact.key === "dimensions_lwh").map((fact) => fact.scope)).toEqual(["XS_INTEGRATOR_HOMELINE", "SMALL", "MEDIUM", "LARGE"]);
    expect(INTEGRATOR_AUTHORITY_FACTS.find((fact) => fact.key === "usable_space_lwh")?.scope).toBe("XS_INTEGRATOR_HOMELINE");
    expect(INTEGRATOR_AUTHORITY_CONFLICTS[0].policy).toBe("BLOCK_AUTONOMOUS_CLAIM_GENERATION_UNTIL_RECONCILED");
  });

  test("records immutable source checksums and clears all five visual positions", () => {
    expect(INTEGRATOR_SOURCE_DOCUMENTS.xs.sha256).toHaveLength(64);
    expect(INTEGRATOR_SOURCE_DOCUMENTS.family2025.sha256).toHaveLength(64);
    expect(INTEGRATOR_12596_VISUAL_PLAN).toHaveLength(5);
    expect(INTEGRATOR_12596_VISUAL_PLAN.every((position) => position.status === "CLEARED")).toBe(true);
    expect(INTEGRATOR_VISUAL_AUTHORITY.filter((reference) => reference.classification === "VERIFIED_PRODUCT_DETAIL_IMAGE")).toHaveLength(4);
  });
});