import {
  buildCatalogReconciliationPlan,
  normalizeSsiSku,
} from "@/modules/foundation/catalog-reconciliation-plan";
import { createCatalogImportPreview } from "@/modules/foundation/catalog-spreadsheet-preview";
import { listCanonicalProducts } from "@/modules/foundation/product-repository";
import {
  SSI_CATALOG_RECONCILIATION_POLICY,
  SSI_HEADER_DECISIONS,
  SSI_SHEET_FAMILY_DECISIONS,
} from "@/modules/foundation/ssi-catalog-reconciliation-policy";
import {
  listCatalogImports,
  listCatalogRevisions,
  resetCatalogLineageRepositoryForTests,
} from "@/modules/foundation/catalog-lineage-repository";
import {
  listProducts,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";
import type { CatalogImportInput } from "@/modules/foundation/catalog-import-preview";
import type { SourceProvenance } from "@/modules/foundation/catalog-lineage";

function csv(
  body: string,
  importId = "reconciliation-test-import",
): CatalogImportInput {
  return {
    sourceId: "reconciliation-test-source",
    importId,
    fileName: "SSI Pricing Master Sheet.xlsx.csv",
    mediaType: "text/csv",
    buffer: Buffer.from(body),
    createdBy: "test",
    sourceVersion: "test-v1",
    mappingProfileId: "ssi-pricing-master-v1",
  };
}

async function plan(
  body: string,
  options: {
    existingProducts?: ReturnType<typeof listCanonicalProducts>;
    policy?: typeof SSI_CATALOG_RECONCILIATION_POLICY;
    importId?: string;
    provenance?: readonly SourceProvenance[];
  } = {},
) {
  const input = csv(body, options.importId);
  const preview = await createCatalogImportPreview(input);
  preview.sheets[0] = { ...preview.sheets[0], sheetName: "Indoor Kiosks" };
  preview.recordPreviews = preview.recordPreviews.map((row) => ({ ...row, sheetName: "Indoor Kiosks", sourceLocator: { ...row.sourceLocator, sheet: "Indoor Kiosks" } }));
  return buildCatalogReconciliationPlan({
    sourceImportId: input.importId,
    preview,
    existingProducts: options.existingProducts ?? listCanonicalProducts(),
    provenance: options.provenance,
    policy: options.policy,
  });
}

describe("SSI catalog reconciliation planning", () => {
  beforeEach(() => {
    resetProductRepositoryForTests();
    resetCatalogLineageRepositoryForTests();
  });

  test("1. exact SKU match finds an existing product", async () => {
    const result = await plan("SKU,Item Name,Size/Option\nLEDW-OUTDOOR-KIOSK,Outdoor Digital Kiosk,55 in");
    expect(result.productDecisions[0]).toMatchObject({
      action: "MATCH_EXISTING_PRODUCT",
      existingProductId: "prod-outdoor-digital-kiosk",
      confidence: "EXACT",
    });
  });

  test("2. fuzzy name does not authorize existing match", async () => {
    const result = await plan("SKU,Item Name\n,Outdoor Digital Kiosks Plus");
    expect(result.productDecisions[0].action).toBe("CREATE_PRODUCT");
    expect(result.productDecisions[0].existingProductId).toBeNull();
  });

  test("3. SKU semantic suffix is preserved", () => {
    expect(normalizeSsiSku("ENC-CC-LG")).toBe("ENC-CC-LG");
    expect(normalizeSsiSku("ENC-CC-LG+")).toBe("ENC-CC-LG+");
    expect(normalizeSsiSku("ENC-CC-LG")).not.toBe(normalizeSsiSku("ENC-CC-LG+"));
  });

  test("4. SKU-less exact family name grouping is deterministic", async () => {
    const first = await plan("Item Name,Size/Option\nSpecialty Kiosk,43 in");
    const second = await plan("Item Name,Size/Option\nSpecialty Kiosk,43 in");
    expect(second.productDecisions[0].candidateProductId).toBe(first.productDecisions[0].candidateProductId);
  });

  test("5. SKU-less repeated identity without variant fields requires review", async () => {
    const result = await plan("Item Name\nSpecialty Kiosk\nSpecialty Kiosk");
    expect(result.variantDecisions.every((decision) => decision.reviewRequired)).toBe(true);
  });

  test("6. repeated rows group into one product and variants", async () => {
    const result = await plan("SKU,Item Name,Size/Option\nK-43,Specialty Kiosk,43 in\nK-55,Specialty Kiosk,55 in");
    expect(result.summary.productGroupCount).toBe(1);
    expect(result.summary.variantCandidateCount).toBe(2);
  });

  test("7. product and variant grouping is deterministic", async () => {
    const source = "SKU,Item Name,Size/Option\nK-43,Specialty Kiosk,43 in\nK-55,Specialty Kiosk,55 in";
    const first = await plan(source);
    const second = await plan(source);
    expect(second.productDecisions).toEqual(first.productDecisions);
    expect(second.variantDecisions).toEqual(first.variantDecisions);
  });

  test("8. variant identity ignores non-identity description", async () => {
    const first = await plan("SKU,Item Name,Size/Option,Product Description\nK-43,Specialty Kiosk,43 in,First\nK-55,Specialty Kiosk,55 in,Second");
    const second = await plan("SKU,Item Name,Size/Option,Product Description\nK-43,Specialty Kiosk,43 in,Changed\nK-55,Specialty Kiosk,55 in,Changed");
    expect(second.variantDecisions.map((decision) => decision.candidateVariantId))
      .toEqual(first.variantDecisions.map((decision) => decision.candidateVariantId));
  });

  test("9. variant identity changes with identity attribute", async () => {
    const first = await plan("SKU,Item Name,Size/Option\n,Specialty Kiosk,43 in\n,Specialty Kiosk,55 in");
    expect(first.variantDecisions[0].candidateVariantId).not.toBe(first.variantDecisions[1].candidateVariantId);
  });

  test("10. commercial fields are excluded from technical attributes", async () => {
    const result = await plan("SKU,Item Name,Size/Option,Dealer Price,Shipping Cost\nK-1,Kiosk,43 in,1000,50");
    expect(result.attributeValues).toHaveLength(1);
    expect(result.commercialSourceAssociations).toHaveLength(1);
    expect(result.commercialSourceAssociations[0].values).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "dealer price", value: 1000 }),
      expect.objectContaining({ field: "shipping cost", value: 50 }),
    ]));
  });

  test("11. description association works", async () => {
    const result = await plan("SKU,Item Name,Product Description\nK-1,Kiosk,Description");
    expect(result.summary.descriptionAssociationCount).toBe(1);
  });

  test("12. document association works", async () => {
    const result = await plan("SKU,Item Name,Spec Sheet Link\nK-1,Kiosk,document://spec");
    expect(result.summary.documentAssociationCount).toBe(1);
  });

  test("13. family narrative association works", async () => {
    const input = csv("SKU,Item Name\nK-1,Kiosk");
    const preview = await createCatalogImportPreview(input);
    const narrative = {
      ...preview.recordPreviews[0],
      sheetName: "Indoor Kiosks",
      classification: "NARRATIVE" as const,
      classificationReasons: ["CATEGORY_NARRATIVE" as const],
      sourceLocator: { sheet: "Indoor Kiosks", row: 1 },
    };
    preview.sheets[0] = { ...preview.sheets[0], sheetName: "Indoor Kiosks" };
    preview.recordPreviews = [narrative, ...preview.recordPreviews.slice(1).map((row) => ({ ...row, sheetName: "Indoor Kiosks", sourceLocator: { ...row.sourceLocator, sheet: "Indoor Kiosks" } }))];
    const result = buildCatalogReconciliationPlan({ sourceImportId: input.importId, preview, existingProducts: [] });
    expect(result.summary.familyNarrativeAssociationCount).toBe(1);
  });

  test("14. source provenance is retained", async () => {
    const provenance: SourceProvenance = {
      provenanceId: "provenance-1",
      sourceId: "source",
      importId: "reconciliation-test-import",
      importRecordId: "record",
      sourceLocator: { sheet: "Indoor Kiosks", row: 2, column: "A" },
      contentHash: "hash",
      observedAt: "2026-08-27T00:00:00.000Z",
      rawValue: "K-1",
      normalizedValue: "K-1",
      transformationChain: [],
      confidence: 1,
    };
    const result = await plan("SKU,Item Name\nK-1,Kiosk", { provenance: [provenance] });
    expect(result.productDecisions[0].provenanceIds).toContain("provenance-1");
  });

  test("15. duplicate SKU conflict is detected", async () => {
    const result = await plan("SKU,Item Name\nDUP-1,Product A\nDUP-1,Product B");
    expect(result.summary.identityConflictCount).toBe(2);
    expect(result.status).toBe("BLOCKED");
  });

  test("16. exact duplicate observations consolidate into one variant", async () => {
    const result = await plan("Item Name,Size/Option\nProduct A,43 in\nProduct A,43 in");
    expect(result.variantDecisions).toHaveLength(1);
    expect(result.variantDecisions[0].sourceLocators).toHaveLength(2);
    expect(result.summary.duplicateSourceCount).toBe(1);
    expect(result.summary.variantKeyCollisionCount).toBe(0);
  });

  test("17. same plan inputs generate the same fingerprint", async () => {
    const first = await plan("SKU,Item Name\nK-1,Kiosk");
    const second = await plan("SKU,Item Name\nK-1,Kiosk");
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  test("18. policy change changes fingerprint", async () => {
    const first = await plan("SKU,Item Name\nK-1,Kiosk");
    const changedPolicy = { ...SSI_CATALOG_RECONCILIATION_POLICY, version: "1.0.1" };
    const second = await plan("SKU,Item Name\nK-1,Kiosk", { policy: changedPolicy });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("19. source identity change changes fingerprint", async () => {
    const first = await plan("SKU,Item Name\nK-1,Kiosk");
    const second = await plan("SKU,Item Name\nK-2,Kiosk");
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("20. existing catalog identity change changes fingerprint", async () => {
    const products = listCanonicalProducts();
    const first = await plan("SKU,Item Name\nK-1,Kiosk", { existingProducts: products });
    const changed = products.map((product, index) => index === 0 ? { ...product, version: product.version + 1 } : product);
    const second = await plan("SKU,Item Name\nK-1,Kiosk", { existingProducts: changed });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  test("21. zero product mutation", async () => {
    const before = JSON.stringify(listProducts());
    await plan("SKU,Item Name\nK-1,Kiosk");
    expect(JSON.stringify(listProducts())).toBe(before);
  });

  test("22. zero variant and attribute persistence", async () => {
    await plan("SKU,Item Name,Size/Option\nK-1,Kiosk,43 in");
    expect(listProducts()).toHaveLength(6);
    expect(listCatalogImports()).toEqual([]);
  });

  test("23. zero CatalogRevision creation", async () => {
    await plan("SKU,Item Name\nK-1,Kiosk");
    expect(listCatalogRevisions()).toEqual([]);
  });

  test("24. all headers and sheet families are frozen", () => {
    expect(SSI_HEADER_DECISIONS).toHaveLength(27);
    expect(SSI_HEADER_DECISIONS.every((decision) => decision.decision === "APPROVED")).toBe(true);
    expect(SSI_SHEET_FAMILY_DECISIONS).toHaveLength(27);
    expect(new Set(SSI_SHEET_FAMILY_DECISIONS.map((decision) => decision.familyId)).size).toBe(24);
    expect(SSI_CATALOG_RECONCILIATION_POLICY.frozen).toBe(true);
  });
});