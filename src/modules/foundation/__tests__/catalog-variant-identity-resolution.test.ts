import { buildCatalogReconciliationPlan } from "@/modules/foundation/catalog-reconciliation-plan";
import type { CatalogImportInput, CatalogImportPreview } from "@/modules/foundation/catalog-import-preview";
import { createCatalogImportPreview } from "@/modules/foundation/catalog-spreadsheet-preview";
import type { SourceProvenance } from "@/modules/foundation/catalog-lineage";
import {
  listCatalogImports,
  listCatalogRevisions,
  resetCatalogLineageRepositoryForTests,
} from "@/modules/foundation/catalog-lineage-repository";
import {
  listCanonicalProducts,
  listProducts,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";
import {
  SSI_CATALOG_RECONCILIATION_POLICY,
  type SsiCatalogReconciliationPolicy,
} from "@/modules/foundation/ssi-catalog-reconciliation-policy";

function input(body: string): CatalogImportInput {
  return {
    sourceId: "ssi-001e1-test",
    importId: "ssi-001e1-test-import",
    fileName: "ssi-001e1.csv",
    mediaType: "text/csv",
    buffer: Buffer.from(body),
    createdBy: "test",
    mappingProfileId: "ssi-pricing-master-v1",
  };
}

async function previewForSheet(sheetName: string, body: string): Promise<CatalogImportPreview> {
  const preview = await createCatalogImportPreview(input(body));
  const headerPolicy = SSI_CATALOG_RECONCILIATION_POLICY.headerDecisions
    .find((decision) => decision.sheetName === sheetName);
  preview.sheets[0] = {
    ...preview.sheets[0],
    sheetName,
    headerSelection: {
      ...preview.sheets[0].headerSelection,
      selectedHeaderRow: headerPolicy?.headerRow ?? 1,
    },
  };
  preview.recordPreviews = preview.recordPreviews.map((row) => ({
    ...row,
    sheetName,
    sourceLocator: { ...row.sourceLocator, sheet: sheetName },
  }));
  return preview;
}

async function build(
  sheetName: string,
  body: string,
  options: {
    policy?: SsiCatalogReconciliationPolicy;
    provenance?: readonly SourceProvenance[];
  } = {},
) {
  return buildCatalogReconciliationPlan({
    sourceImportId: "ssi-001e1-test-import",
    preview: await previewForSheet(sheetName, body),
    existingProducts: listCanonicalProducts(),
    policy: options.policy,
    provenance: options.provenance,
  });
}

describe("SSI 001E.1 variant identity collision resolution", () => {
  beforeEach(() => {
    resetProductRepositoryForTests();
    resetCatalogLineageRepositoryForTests();
  });

  test.each([
    ["SMD All-in-One LED", "Size/Option,Cabinet Size,Touch Option,Item Name\nP1.25,1000x500,With IR Touch,Screen\nP1.25,1000x500,Without IR Touch,Screen"],
    ["Can LED Screen", "Size/Option,Size,Item Name\nP2,500 mm,Screen\nP2,750 mm,Screen"],
    ["Exhibition Table LED", "Size/Option,Size,Item Name\nP2,500 mm,Screen\nP2,750 mm,Screen"],
    ["Interactive LED Floor", "Size/Option,Brightness,Item Name\nP2,500 nits,Screen\nP2,1000 nits,Screen"],
    ["Reception Desk LED", "Size/Option,Size,Item Name\nP2,500 mm,Screen\nP2,750 mm,Screen"],
    ["Tileable Roll-Up LED", "Size/Option,Size,Item Name\nP2,500 mm,Screen\nP2,750 mm,Screen"],
    ["Transparent LED", "Size/Option,Size,Module,Item Name\nP2,500 mm,A,Screen\nP2,500 mm,B,Screen"],
  ])("separates the live discriminator for %s", async (sheetName, body) => {
    const result = await build(sheetName, body);
    expect(result.variantDecisions).toHaveLength(2);
    expect(new Set(result.variantDecisions.map((decision) => decision.candidateVariantId)).size).toBe(2);
    expect(result.summary.variantKeyCollisionCount).toBe(0);
  });

  test("brightness remains non-identity for Standard DVLED", async () => {
    const result = await build("Standard DVLED", "Size/Option,Brightness,Item Name\nP2,500 nits,Screen\nP2,1000 nits,Screen");
    expect(result.variantDecisions).toHaveLength(1);
    expect(result.summary.sameVariantMultiSourceCount).toBe(1);
  });

  test("resolution changes identity only where frozen", async () => {
    const result = await build("Round LED", "Size/Option,Resolution,Item Name\nP2,1080p,Screen\nP2,4K,Screen");
    expect(result.variantDecisions).toHaveLength(2);
  });

  test.each([
    ["Price", "100", "200"],
    ["Shipping Cost", "10", "20"],
    ["Tariff", "5", "7"],
  ])("%s difference does not create another technical variant", async (field, first, second) => {
    const result = await build("Interactive LED Floor", `Size/Option,Brightness,${field},Item Name\nP2,500 nits,${first},Screen\nP2,500 nits,${second},Screen`);
    expect(result.variantDecisions).toHaveLength(1);
    expect(result.summary.sameVariantMultiSourceCount).toBe(1);
    expect(result.summary.variantKeyCollisionCount).toBe(0);
  });

  test("semantic SKU suffix remains distinct", async () => {
    const result = await build("Indoor Kiosks", "SKU,Size/Option,Item Name\nENC-CC-LG,55 in,Screen\nENC-CC-LG+,55 in,Screen");
    expect(result.variantDecisions).toHaveLength(2);
  });

  test("exact duplicate technical row does not create another variant", async () => {
    const result = await build("Interactive LED Floor", "Size/Option,Brightness,Item Name\nP2,500 nits,Screen\nP2,500 nits,Screen");
    expect(result.variantDecisions).toHaveLength(1);
    expect(result.summary.duplicateSourceCount).toBe(1);
  });

  test("same technical variant with commercial differences retains both observations", async () => {
    const result = await build("Interactive LED Floor", "Size/Option,Brightness,Price,Item Name\nP1.56,1000 nits,4620,Screen\nP1.56,1000 nits,3145,Screen");
    expect(result.variantDecisions[0].sourceLocators).toHaveLength(2);
    expect(result.commercialSourceAssociations).toHaveLength(2);
    expect(result.reviewRequirements).toContain("Review multiple commercial or content observations associated with one technical variant.");
  });

  test("one exact SKU asserting contradictory technical identities stays blocked", async () => {
    const result = await build("Indoor Kiosks", "SKU,Size/Option,Item Name\nK-1,43 in,Screen\nK-1,55 in,Screen");
    expect(result.variantDecisions).toHaveLength(2);
    expect(result.variantDecisions.every((decision) => decision.action === "SOURCE_IDENTITY_CONFLICT")).toBe(true);
    expect(result.summary.sourceIdentityConflictCount).toBe(2);
    expect(result.status).toBe("BLOCKED");
  });

  test("distinct exact product names remain separate product groups", async () => {
    const result = await build("Transparent LED", "Size/Option,Item Name\nP2,Transparent LED\nP2,Dual-Sided Transparent LED");
    expect(result.productDecisions).toHaveLength(2);
    expect(result.variantDecisions).toHaveLength(0);
  });

  test("non-identity mounting change keeps the same key", async () => {
    const result = await build("Indoor Kiosks", "Size/Option,Add Mounting,Item Name\n55 in,Wall,Screen\n55 in,Floor,Screen");
    expect(result.variantDecisions).toHaveLength(1);
  });

  test("identity field declaration order does not change a key", async () => {
    const original = await build("Indoor Kiosks", "Size/Option,Touch Option,Item Name\n55 in,Touch,Screen\n65 in,Touch,Screen");
    const reorderedPolicy: SsiCatalogReconciliationPolicy = {
      ...SSI_CATALOG_RECONCILIATION_POLICY,
      familyPolicies: SSI_CATALOG_RECONCILIATION_POLICY.familyPolicies.map((family) =>
        family.familyId === "family-kiosks"
          ? { ...family, variantIdentityFields: [...family.variantIdentityFields].reverse() }
          : family),
    };
    const reordered = await build("Indoor Kiosks", "Size/Option,Touch Option,Item Name\n55 in,Touch,Screen\n65 in,Touch,Screen", { policy: reorderedPolicy });
    expect(reordered.variantDecisions.map((decision) => decision.candidateVariantId).sort())
      .toEqual(original.variantDecisions.map((decision) => decision.candidateVariantId).sort());
  });

  test("all consolidated source observations remain accounted for exactly once", async () => {
    const result = await build("Interactive LED Floor", "Size/Option,Brightness,Price,Item Name\nP1.56,1000 nits,4620,Screen\nP1.56,1000 nits,3145,Screen\nP2,500 nits,2000,Screen");
    const locators = result.variantDecisions.flatMap((decision) => decision.sourceLocators);
    expect(locators).toHaveLength(3);
    expect(new Set(locators.map((locator) => `${locator.sheet}|${locator.row}`)).size).toBe(3);
  });

  test("duplicate provenance remains retainable on one variant", async () => {
    const provenance = [2, 3].map((row): SourceProvenance => ({
      provenanceId: `provenance-${row}`,
      sourceId: "ssi-001e1-test",
      importId: "ssi-001e1-test-import",
      importRecordId: `record-${row}`,
      sourceLocator: { sheet: "Interactive LED Floor", row },
      contentHash: `hash-${row}`,
      observedAt: "2026-08-27T00:00:00.000Z",
      rawValue: "P2",
      normalizedValue: "P2",
      transformationChain: [],
      confidence: 1,
    }));
    const result = await build("Interactive LED Floor", "Size/Option,Brightness,Item Name\nP2,500 nits,Screen\nP2,500 nits,Screen", { provenance });
    expect(result.variantDecisions[0].provenanceIds).toEqual(["provenance-2", "provenance-3"]);
  });

  test("planning performs zero catalog mutation", async () => {
    const productsBefore = JSON.stringify(listProducts());
    await build("Interactive LED Floor", "Size/Option,Brightness,Item Name\nP2,500 nits,Screen\nP2,1000 nits,Screen");
    expect(JSON.stringify(listProducts())).toBe(productsBefore);
    expect(listCatalogImports()).toEqual([]);
    expect(listCatalogRevisions()).toEqual([]);
  });

  test("the reconciliation policy is re-frozen at 1.1.0", () => {
    expect(SSI_CATALOG_RECONCILIATION_POLICY).toMatchObject({ version: "1.1.0", frozen: true });
  });
});