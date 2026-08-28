import ExcelJS from "exceljs";

import type { CatalogImportInput } from "@/modules/foundation/catalog-import-preview";
import { createPersistedCatalogImportPreview } from "@/modules/foundation/catalog-import-preview-service";
import { createCatalogImportPreview } from "@/modules/foundation/catalog-spreadsheet-preview";
import {
  createCatalogSource,
  getCatalogImport,
  listCatalogImportRecords,
  listCatalogRevisions,
  listSourceProvenanceByImport,
  resetCatalogLineageRepositoryForTests,
} from "@/modules/foundation/catalog-lineage-repository";
import {
  listProducts,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";

const SOURCE_ID = "ssi-row-classification-source";

function csv(content: string, importId = "ssi-row-classification-import"): CatalogImportInput {
  return {
    sourceId: SOURCE_ID,
    importId,
    fileName: "SSI Pricing Master Sheet.xlsx.csv",
    mediaType: "text/csv",
    buffer: Buffer.from(content),
    createdBy: "test",
    sourceVersion: "test-v1",
    mappingProfileId: "ssi-pricing-master-v1",
  };
}

async function xlsx(
  configure: (sheet: ExcelJS.Worksheet) => void,
  importId = "ssi-formula-import",
): Promise<CatalogImportInput> {
  const workbook = new ExcelJS.Workbook();
  configure(workbook.addWorksheet("Specialty LED"));
  return {
    sourceId: SOURCE_ID,
    importId,
    fileName: "SSI Pricing Master Sheet.xlsx",
    mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    createdBy: "test",
    sourceVersion: "test-v1",
    mappingProfileId: "ssi-pricing-master-v1",
  };
}

describe("SSI source profile and row classification", () => {
  beforeEach(() => {
    resetCatalogLineageRepositoryForTests();
    resetProductRepositoryForTests();
    createCatalogSource({
      sourceId: SOURCE_ID,
      organizationId: "led-display-warehouse",
      type: "SPREADSHEET",
      name: "SSI Pricing Master Sheet",
      externalSystem: "test",
      configurationReference: null,
      enabled: true,
    });
  });

  test("1. product row with SKU and name is DATA", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name\nA,Product"));
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "DATA", classificationReasons: ["PRODUCT_IDENTITY_PRESENT"] });
  });

  test("2. product row with name but no SKU is DATA under SSI profile", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Size/Option\n,Round LED,2m"));
    expect(preview.recordPreviews[1].classification).toBe("DATA");
  });

  test("3. pricing-only row is PRICING_FILLER", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Dealer Price,Retail Price\n,,100,150"));
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "PRICING_FILLER", classificationReasons: ["PRICING_ONLY_FILLER"] });
  });

  test("4. formula-pricing-only row is PRICING_FILLER", async () => {
    const input = await xlsx((sheet) => sheet.addRows([
      ["SKU", "Item Name", "Dealer Price"],
      [null, null, { formula: "50*2", result: 100 }],
    ]));
    const preview = await createCatalogImportPreview(input);
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "PRICING_FILLER", classificationReasons: ["FORMULA_TAIL"] });
  });

  test("5. fully blank row is BLANK", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name\nA,Product\n,"));
    expect(preview.recordPreviews[2]).toMatchObject({ classification: "BLANK", classificationReasons: ["BLANK_ROW"] });
  });

  test("6. selected header row is HEADER", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name\nA,Product"));
    expect(preview.recordPreviews[0]).toMatchObject({ classification: "HEADER", classificationReasons: ["HEADER_ROW"] });
  });

  test("7. internal section heading is SUBHEADER", async () => {
    const preview = await createCatalogImportPreview(csv("Item Name,Size/Option\nFeatures,\nProduct,2m"));
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "SUBHEADER", classificationReasons: ["SUBHEADER_ROW"] });
  });

  test("8. category description is NARRATIVE", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Product Description\n,,Category Overview: designed for retail applications with standard sizes and features."));
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "NARRATIVE", classificationReasons: ["CATEGORY_NARRATIVE"] });
  });

  test("9. notes-only row is NOTES", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Notes\n,,Requires operator review"));
    expect(preview.recordPreviews[1]).toMatchObject({ classification: "NOTES", classificationReasons: ["NOTES_ONLY"] });
  });

  test("10. product-intent row without identity is MALFORMED", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Size/Option\n,,2m"));
    expect(preview.recordPreviews[1].classification).toBe("MALFORMED");
  });

  test("11. malformed row retains deterministic reason", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Resolution\n,,1920x1080"));
    expect(preview.recordPreviews[1].classificationReasons).toEqual(["MISSING_REQUIRED_IDENTITY"]);
  });

  test("12. filler row does not create an import record", async () => {
    const preview = await createPersistedCatalogImportPreview(csv("SKU,Item Name,Dealer Price\nA,Product,100\n,,200"));
    expect(preview.counts.pricingFillerRowCount).toBe(1);
    expect(listCatalogImportRecords(preview.importId)).toHaveLength(1);
  });

  test("13. filler row does not create a product candidate", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Dealer Price\n,,200"));
    expect(preview.recordPreviews[1].candidateProductIdentity).toEqual({});
  });

  test("14. filler row does not create a technical attribute candidate value", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Dealer Price\n,,200"));
    expect(preview.recordPreviews[1].candidateAttributeValues).toEqual({});
  });

  test("15. commercial columns do not become technical attributes", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Dealer Price,Shipping Cost,Tariff/Duties/Import Tax\nA,Product,100,10,5"));
    expect(preview.attributeCandidates).toEqual([]);
    expect(preview.recordPreviews[1].candidateCommercialFields).toEqual({ "dealer price": 100 });
  });

  test("16. Product Description maps to DESCRIPTION", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Product Description\nA,Product,Description"));
    expect(preview.recordPreviews[1].candidateProductIdentity.DESCRIPTION).toBe("Description");
  });

  test("17. Photo maps to MEDIA_REFERENCE", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Photo\nA,Product,media://photo"));
    expect(preview.recordPreviews[1].candidateMediaReferences).toEqual(["media://photo"]);
  });

  test("18. Photos maps to MEDIA_REFERENCE", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Photos\nA,Product,media://photos"));
    expect(preview.recordPreviews[1].candidateMediaReferences).toEqual(["media://photos"]);
  });

  test("19. Spec Sheet Link maps to DOCUMENT_REFERENCE", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Spec Sheet Link\nA,Product,document://spec"));
    expect(preview.recordPreviews[1].candidateDocumentReferences).toEqual(["document://spec"]);
  });

  test("20. Notes maps to source metadata", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Notes\nA,Product,Review"));
    expect(preview.recordPreviews[1].candidateSourceMetadata).toEqual({ notes: "Review" });
  });

  test("21. Brighness/Refresh resolves through the source profile", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Brighness/Refresh\nA,Product,5000 nits / 3840 Hz"));
    expect(preview.columnMappings[2]).toMatchObject({ suggestedTarget: "ATTRIBUTE", confidence: "EXACT", reviewRequired: false });
  });

  test("22. SKU-less specialty LED row remains DATA", async () => {
    const preview = await createCatalogImportPreview(csv("Item Name,Size/Option,Price per set\nRound LED,2m,1000"));
    expect(preview.recordPreviews[1].classification).toBe("DATA");
  });

  test("23. SKU-less row with only technical values remains MALFORMED", async () => {
    const preview = await createCatalogImportPreview(csv("Item Name,Cabinet Size\n,500 mm"));
    expect(preview.recordPreviews[1].classification).toBe("MALFORMED");
  });

  test("24. classification is deterministic", async () => {
    const input = csv("SKU,Item Name,Dealer Price\nA,Product,100\n,,200");
    const first = await createCatalogImportPreview(input);
    const second = await createCatalogImportPreview(input);
    expect(second.recordPreviews.map((row) => [row.classification, row.classificationReasons]))
      .toEqual(first.recordPreviews.map((row) => [row.classification, row.classificationReasons]));
  });

  test("25. source locator remains intact for non-product rows", async () => {
    const preview = await createCatalogImportPreview(csv("SKU,Item Name,Dealer Price\n,,200"));
    expect(preview.recordPreviews[1].sourceLocator).toMatchObject({ sheet: "sheet1", row: 2, cellRange: "A2:C2" });
  });

  test("26. mapped DATA provenance remains compatible", async () => {
    const preview = await createPersistedCatalogImportPreview(csv("SKU,Item Name,Product Description\nA,Product,Description"));
    expect(listSourceProvenanceByImport(preview.importId).length).toBeGreaterThan(0);
    expect(listCatalogImportRecords(preview.importId)[0].normalizedCandidate).toHaveProperty("productIdentity.DESCRIPTION", "Description");
  });

  test("27. preview lifecycle ceiling remains PREVIEW_READY", async () => {
    const preview = await createPersistedCatalogImportPreview(csv("SKU,Item Name\nA,Product"));
    expect(getCatalogImport(preview.importId)?.status).toBe("PREVIEW_READY");
  });

  test("28. classification preview causes zero catalog mutation", async () => {
    const productsBefore = JSON.stringify(listProducts());
    await createPersistedCatalogImportPreview(csv("SKU,Item Name,Dealer Price\nA,Product,100\n,,200"));
    expect(JSON.stringify(listProducts())).toBe(productsBefore);
    expect(listCatalogRevisions()).toEqual([]);
  });

  const categoryNarrative = "Category Overview: This display family is designed for commercial applications. Features: durable construction and flexible mounting. Standard Sizes: multiple configurations.";

  async function mergedNarrativeWorkbook(importId = "merged-narrative-import"): Promise<CatalogImportInput> {
    return xlsx((sheet) => {
      sheet.addRows([
        [categoryNarrative],
        ["Item Name", "SKU", "Status"],
        ["Real Product", "SKU-1", "Active"],
      ]);
      sheet.mergeCells("A1:C1");
    }, importId);
  }

  test("29. merged category narrative before header is NARRATIVE", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook());
    expect(preview.recordPreviews[0]).toMatchObject({
      classification: "NARRATIVE",
      classificationReasons: ["CATEGORY_NARRATIVE"],
    });
    expect(preview.recordPreviews[1].classification).toBe("HEADER");
    expect(preview.recordPreviews[2].classification).toBe("DATA");
  });

  test("30. long unmerged product name remains DATA", async () => {
    const longName = `Commercial display designed for applications with features ${"and capabilities ".repeat(30)}`;
    const preview = await createCatalogImportPreview(csv(`SKU,Item Name\nSKU-1,"${longName}"`));
    expect(preview.recordPreviews[1].classification).toBe("DATA");
  });

  test("31. merged product formatting with independent SKU remains DATA", async () => {
    const input = await xlsx((sheet) => {
      sheet.addRows([
        ["SKU", "Item Name", "Product Description"],
        ["SKU-1", "Real Product", null],
      ]);
      sheet.mergeCells("B2:C2");
    }, "merged-valid-product");
    expect((await createCatalogImportPreview(input)).recordPreviews[1].classification).toBe("DATA");
  });

  test("32. merged section heading inside data region is SUBHEADER", async () => {
    const input = await xlsx((sheet) => {
      sheet.addRows([
        ["Item Name", "SKU", "Status"],
        ["Features"],
        ["Product", "SKU-1", "Active"],
      ]);
      sheet.mergeCells("A2:C2");
    }, "merged-subheader");
    expect((await createCatalogImportPreview(input)).recordPreviews[1]).toMatchObject({
      classification: "SUBHEADER",
      classificationReasons: ["SUBHEADER_ROW"],
    });
  });

  test("33. repeated merged narrative identity values remain NARRATIVE", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook("repeated-narrative"));
    expect(preview.recordPreviews[0].candidateProductIdentity).toMatchObject({
      PRODUCT_NAME: categoryNarrative,
      SKU: categoryNarrative,
      STATUS: categoryNarrative,
    });
    expect(preview.recordPreviews[0].classification).toBe("NARRATIVE");
  });

  test("34. product description on valid product does not force NARRATIVE", async () => {
    const preview = await createCatalogImportPreview(csv(`SKU,Item Name,Product Description\nSKU-1,Product,"${categoryNarrative}"`));
    expect(preview.recordPreviews[1].classification).toBe("DATA");
  });

  test("35. narrative source coordinates and merged master are preserved", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook("narrative-coordinates"));
    const row = preview.recordPreviews[0];
    expect(row.sourceLocator).toMatchObject({ sheet: "Specialty LED", row: 1, cellRange: "A1:C1" });
    expect(row.rawValues["Item Name"].mergedCell).toEqual({
      range: "A1:C1",
      masterCell: "A1",
      inference: "NONE",
    });
    expect(row.rawValues.SKU.mergedCell).toEqual({
      range: "A1:C1",
      masterCell: "A1",
      inference: "INFERRED_FROM_MERGED_CELL",
    });
  });

  test("36. merged narrative classification is deterministic", async () => {
    const input = await mergedNarrativeWorkbook("narrative-determinism");
    const first = await createCatalogImportPreview(input);
    const second = await createCatalogImportPreview(input);
    expect(second.recordPreviews.map((row) => [row.classification, row.classificationReasons]))
      .toEqual(first.recordPreviews.map((row) => [row.classification, row.classificationReasons]));
  });

  test("37. product count excludes merged narrative row", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook("narrative-product-count"));
    expect(preview.counts.candidateDataRowCount).toBe(1);
    expect(preview.counts.narrativeRowCount).toBe(1);
  });

  test("38. SKU coverage candidates exclude merged narrative row", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook("narrative-sku-count"));
    const data = preview.recordPreviews.filter((row) => row.classification === "DATA");
    expect(data.filter((row) => row.candidateProductIdentity.SKU)).toHaveLength(1);
  });

  test("39. product description counts exclude category narrative", async () => {
    const preview = await createCatalogImportPreview(await mergedNarrativeWorkbook("narrative-description-count"));
    const descriptions = preview.recordPreviews.filter((row) =>
      row.classification === "DATA" && row.candidateProductIdentity.DESCRIPTION);
    expect(descriptions).toHaveLength(0);
  });

  test("40. merged narrative preview causes zero catalog mutation", async () => {
    const before = JSON.stringify(listProducts());
    const preview = await createPersistedCatalogImportPreview(
      await mergedNarrativeWorkbook("narrative-zero-mutation"),
    );
    expect(preview.counts.narrativeRowCount).toBe(1);
    expect(listCatalogImportRecords(preview.importId)).toHaveLength(1);
    expect(JSON.stringify(listProducts())).toBe(before);
    expect(listCatalogRevisions()).toEqual([]);
  });
});