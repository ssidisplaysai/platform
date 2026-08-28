import ExcelJS from "exceljs";

import {
  CATALOG_IMPORT_LIMITS,
  type CatalogImportInput,
} from "@/modules/foundation/catalog-import-preview";
import { createPersistedCatalogImportPreview } from "@/modules/foundation/catalog-import-preview-service";
import {
  CatalogPreviewError,
  createCatalogImportPreview,
  normalizeCatalogHeader,
} from "@/modules/foundation/catalog-spreadsheet-preview";
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

const SOURCE_ID = "catalog-source-preview-test";

function csvInput(content: string, importId = "preview-import-csv"): CatalogImportInput {
  return {
    sourceId: SOURCE_ID,
    importId,
    fileName: "synthetic-catalog.csv",
    mediaType: "text/csv",
    buffer: Buffer.from(content, "utf8"),
    createdBy: "test-operator",
    sourceVersion: "synthetic-v1",
  };
}

async function xlsxInput(
  configure: (workbook: ExcelJS.Workbook) => void,
  importId = "preview-import-xlsx",
): Promise<CatalogImportInput> {
  const workbook = new ExcelJS.Workbook();
  configure(workbook);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    sourceId: SOURCE_ID,
    importId,
    fileName: "synthetic-catalog.xlsx",
    mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
    createdBy: "test-operator",
    sourceVersion: "synthetic-v1",
  };
}

function flatCsv(): string {
  return [
    "SKU,Product Name,Model Number,Pixel Pitch (mm),Brightness",
    'LED-1,"Indoor, Fine Pitch",M-1,1.5 mm,5000 nits',
    "LED-2,Indoor Fine Pitch,M-2,2.6 mm,4500 nits",
  ].join("\n");
}

describe("catalog spreadsheet mapping preview", () => {
  beforeEach(() => {
    resetCatalogLineageRepositoryForTests();
    resetProductRepositoryForTests();
    createCatalogSource({
      sourceId: SOURCE_ID,
      organizationId: "led-display-warehouse",
      type: "SPREADSHEET",
      name: "Synthetic Preview Source",
      externalSystem: "test-fixture",
      configurationReference: null,
      enabled: true,
    });
  });

  test("1. CSV parses quoted commas correctly", async () => {
    const preview = await createCatalogImportPreview(csvInput(flatCsv()));
    expect(preview.recordPreviews.find((row) => row.rowNumber === 2)?.candidateProductIdentity.PRODUCT_NAME)
      .toBe("Indoor, Fine Pitch");
  });

  test("2. CSV handles UTF-8 BOM", async () => {
    const preview = await createCatalogImportPreview(csvInput(`\uFEFF${flatCsv()}`));
    expect(preview.sheets[0].headerSelection.columns[0].sourceHeader).toBe("SKU");
  });

  test("3. CSV preserves embedded line breaks", async () => {
    const preview = await createCatalogImportPreview(csvInput('SKU,Product Name,Description\nLED-1,Product One,"Line one\nLine two"'));
    expect(preview.recordPreviews.find((row) => row.classification === "DATA")?.candidateProductIdentity.DESCRIPTION)
      .toBe("Line one\nLine two");
  });

  test("4. XLSX workbook sheets are enumerated", async () => {
    const input = await xlsxInput((workbook) => {
      workbook.addWorksheet("Products").addRows([["SKU", "Product Name"], ["A", "One"]]);
      workbook.addWorksheet("Accessories").addRows([["SKU", "Product Name"], ["B", "Two"]]);
    });
    const preview = await createCatalogImportPreview(input);
    expect(preview.sheets.map((sheet) => sheet.sheetName)).toEqual(["Products", "Accessories"]);
  });

  test("5. header row need not be row one", async () => {
    const input = await xlsxInput((workbook) => workbook.addWorksheet("Products").addRows([
      ["Supplier catalog generated for preview"],
      [],
      ["SKU", "Product Name", "Model"],
      ["A", "One", "M1"],
    ]));
    expect((await createCatalogImportPreview(input)).sheets[0].headerSelection.selectedHeaderRow).toBe(3);
  });

  test("6. candidate header detection is deterministic", async () => {
    const input = csvInput(flatCsv());
    const first = await createCatalogImportPreview(input);
    const second = await createCatalogImportPreview(input);
    expect(second.sheets[0].headerSelection).toEqual(first.sheets[0].headerSelection);
  });

  test("7. original headers are preserved", async () => {
    const preview = await createCatalogImportPreview(csvInput("Product SKU,PIXEL PITCH (MM)\nA,1.5"));
    expect(preview.sheets[0].headerSelection.columns.map((column) => column.sourceHeader))
      .toEqual(["Product SKU", "PIXEL PITCH (MM)"]);
  });

  test("8. normalized headers are deterministic across structural styles", () => {
    expect(normalizeCatalogHeader("Pixel Pitch")).toBe("pixel pitch");
    expect(normalizeCatalogHeader("pixel_pitch")).toBe("pixel pitch");
    expect(normalizeCatalogHeader("PIXEL PITCH (MM)")).toBe("pixel pitch");
    expect(normalizeCatalogHeader("PixelPitch")).toBe("pixel pitch");
  });

  test("9. exact SKU aliases map to SKU", async () => {
    for (const alias of ["SKU", "Part Number", "Product SKU"]) {
      const preview = await createCatalogImportPreview(csvInput(`${alias},Product Name\nA,One`, `import-${alias}`));
      expect(preview.columnMappings[0].suggestedTarget).toBe("SKU");
    }
  });

  test("10. model aliases map to MODEL_NUMBER", async () => {
    for (const alias of ["Model", "Model Number", "Model #"]) {
      const preview = await createCatalogImportPreview(csvInput(`SKU,${alias}\nA,M1`, `import-${alias}`));
      expect(preview.columnMappings[1].suggestedTarget).toBe("MODEL_NUMBER");
    }
  });

  test("11. product name aliases map correctly", async () => {
    for (const alias of ["Product", "Product Name", "Item Name"]) {
      const preview = await createCatalogImportPreview(csvInput(`SKU,${alias}\nA,One`, `import-${alias}`));
      expect(preview.columnMappings[1].suggestedTarget).toBe("PRODUCT_NAME");
    }
  });

  test("12. unknown columns remain candidate attributes", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Custom Finish\nA,One,Matte"));
    expect(preview.columnMappings[2].suggestedTarget).toBe("ATTRIBUTE");
  });

  test("13. low-confidence mapping requires review", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Custom Finish\nA,One,Matte"));
    expect(preview.columnMappings[2]).toMatchObject({ confidence: "MEDIUM", reviewRequired: true });
  });

  test("14. attribute candidate detection works", async () => {
    const preview = await createCatalogImportPreview(csvInput(flatCsv()));
    expect(preview.attributeCandidates.map((candidate) => candidate.suggestedKey))
      .toEqual(expect.arrayContaining(["pixel-pitch", "brightness"]));
  });

  test("15. raw attribute values are preserved", async () => {
    const preview = await createCatalogImportPreview(csvInput(flatCsv()));
    expect(preview.recordPreviews.find((row) => row.rowNumber === 2)?.candidateAttributeValues["pixel pitch"])
      .toBe("1.5 mm");
  });

  test("16. numeric type inference works", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Ratio\nA,One,1.5\nB,Two,2.5"));
    expect(preview.attributeCandidates[0].observedDataType).toBe("NUMBER");
  });

  test("17. integer type inference works", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Panel Count\nA,One,10\nB,Two,20"));
    expect(preview.attributeCandidates[0].observedDataType).toBe("INTEGER");
  });

  test("18. boolean type inference works", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Outdoor Rated\nA,One,yes\nB,Two,no"));
    expect(preview.attributeCandidates[0].observedDataType).toBe("BOOLEAN");
  });

  test("19. dimension and unit observation work", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Width (mm)\nA,One,500 mm"));
    expect(preview.attributeCandidates[0]).toMatchObject({ observedDataType: "DIMENSION" });
    expect(preview.attributeCandidates[0].observedUnits[0].candidateCanonicalUnit).toBe("mm");
  });

  test("20. mixed data types create a diagnostic", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Width\nA,One,500\nB,Two,unknown"));
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "MIXED_DATA_TYPES")).toBe(true);
  });

  test("21. product-with-variants structure can be suggested", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Pixel Pitch\nA-15,Series A,1.5 mm\nA-26,Series A,2.6 mm"));
    expect(preview.structureInference).toMatchObject({ classification: "PRODUCT_WITH_VARIANTS", candidateProductCount: 1, candidateVariantCount: 2 });
  });

  test("22. ambiguous structure requires review", async () => {
    const preview = await createCatalogImportPreview(csvInput("Unknown,Notes\nvalue,other"));
    expect(preview.structureInference).toMatchObject({ classification: "AMBIGUOUS_STRUCTURE", reviewRequired: true });
    expect(preview.status).toBe("BLOCKED");
  });

  test("23. blank rows are not product candidates", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name\nA,One\n,\nB,Two"));
    expect(preview.counts.blankRowCount).toBe(1);
    expect(preview.counts.candidateDataRowCount).toBe(2);
  });

  test("24. subheader and footer rows are not blindly products", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name\nVariants,\nA,One\nTotal,1"));
    expect(preview.recordPreviews.map((row) => row.classification)).toEqual(expect.arrayContaining(["SUBHEADER", "FOOTER"]));
  });

  test("25. malformed rows are diagnosed", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Custom\n,,orphan"));
    expect(preview.recordPreviews.some((row) => row.classification === "MALFORMED")).toBe(true);
    expect(preview.recordPreviews.some((row) => row.diagnostics.some((diagnostic) => diagnostic.code === "MALFORMED_ROW"))).toBe(true);
  });

  test("26. SourceLocator contains correct sheet, row, column, and range evidence", async () => {
    const preview = await createCatalogImportPreview(csvInput(flatCsv()));
    const row = preview.recordPreviews.find((candidate) => candidate.rowNumber === 2)!;
    expect(row.sourceLocator).toMatchObject({ sheet: "sheet1", row: 2, cellRange: "A2:E2" });
    expect(preview.sheets[0].headerSelection.columns[2]).toMatchObject({ columnIndex: 3, columnLetter: "C" });
  });

  test("27. persisted import records retain raw source rows", async () => {
    await createPersistedCatalogImportPreview(csvInput(flatCsv()));
    expect(listCatalogImportRecords("preview-import-csv")[0].rawPayload).toHaveProperty("SKU", "LED-1");
  });

  test("28. provenance traces mapped values to import records", async () => {
    await createPersistedCatalogImportPreview(csvInput(flatCsv()));
    const records = listCatalogImportRecords("preview-import-csv");
    const provenance = listSourceProvenanceByImport("preview-import-csv");
    expect(provenance.length).toBeGreaterThan(0);
    expect(records.map((record) => record.recordId)).toContain(provenance[0].importRecordId);
    expect(provenance[0].sourceLocator.column).toBeDefined();
  });

  test("29. import lifecycle stops at PREVIEW_READY", async () => {
    await createPersistedCatalogImportPreview(csvInput(flatCsv()));
    const catalogImport = getCatalogImport("preview-import-csv")!;
    expect(catalogImport.status).toBe("PREVIEW_READY");
    expect(catalogImport.statusHistory.map((transition) => transition.to)).toEqual([
      "RECEIVED", "PARSED", "MAPPED", "VALIDATED", "PREVIEW_READY",
    ]);
  });

  test("30. preview persistence does not mutate product repository", async () => {
    const before = JSON.stringify(listProducts());
    await createPersistedCatalogImportPreview(csvInput(flatCsv()));
    expect(JSON.stringify(listProducts())).toBe(before);
  });

  test("31. preview persistence does not create CatalogRevision", async () => {
    await createPersistedCatalogImportPreview(csvInput(flatCsv()));
    expect(listCatalogRevisions()).toEqual([]);
  });

  test("32. same source and mapping yields the same semantic preview fingerprint", async () => {
    const input = csvInput(flatCsv());
    const first = await createCatalogImportPreview(input);
    const second = await createCatalogImportPreview(input);
    expect(second.semanticFingerprint).toBe(first.semanticFingerprint);
  });

  test("33. changed source value changes preview fingerprint", async () => {
    const first = await createCatalogImportPreview(csvInput(flatCsv()));
    const second = await createCatalogImportPreview(csvInput(flatCsv().replace("5000 nits", "5100 nits")));
    expect(second.semanticFingerprint).not.toBe(first.semanticFingerprint);
  });

  test("34. changed mapping changes preview fingerprint", async () => {
    const input = csvInput(flatCsv());
    const first = await createCatalogImportPreview(input);
    const second = await createCatalogImportPreview(input, { brightness: "IGNORE" });
    expect(second.semanticFingerprint).not.toBe(first.semanticFingerprint);
  });

  test("35. unsupported or mismatched file type fails closed", async () => {
    await expect(createCatalogImportPreview({ ...csvInput("x"), fileName: "catalog.txt", mediaType: "text/plain" }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
    await expect(createCatalogImportPreview({ ...csvInput("x"), mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });

  test("36. oversized input fails closed before parsing", async () => {
    const input = csvInput("x");
    input.buffer = Buffer.alloc(CATALOG_IMPORT_LIMITS.maximumFileSizeBytes + 1, 1);
    await expect(createCatalogImportPreview(input)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  test("37. sheet safety limit fails closed", async () => {
    const input = await xlsxInput((workbook) => {
      for (let index = 0; index <= CATALOG_IMPORT_LIMITS.maximumSheets; index += 1) {
        workbook.addWorksheet(`Sheet ${index + 1}`).addRow(["SKU"]);
      }
    });
    await expect(createCatalogImportPreview(input)).rejects.toMatchObject({ code: "SHEET_LIMIT_EXCEEDED" });
  });

  test("38. column safety limit fails closed", async () => {
    const input = await xlsxInput((workbook) => {
      workbook.addWorksheet("Wide").addRow(Array.from({ length: CATALOG_IMPORT_LIMITS.maximumColumnsPerSheet + 1 }, (_, index) => `Column ${index}`));
    });
    await expect(createCatalogImportPreview(input)).rejects.toMatchObject({ code: "COLUMN_LIMIT_EXCEEDED" });
  });

  test("39. sensitive raw columns block preview before lineage persistence", async () => {
    const input = csvInput("SKU,Product Name,API Key\nA,One,unsafe-secret");
    const preview = await createPersistedCatalogImportPreview(input);
    expect(preview.status).toBe("BLOCKED");
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "SENSITIVE_VALUE_REJECTED")).toBe(true);
    expect(getCatalogImport(input.importId)).toBeNull();
  });

  test("40. formula cells preserve formula and cached result without execution", async () => {
    const input = await xlsxInput((workbook) => {
      const sheet = workbook.addWorksheet("Products");
      sheet.addRow(["SKU", "Product Name", "Calculated Width"]);
      sheet.addRow(["A", "One", { formula: "1+1", result: 2 }]);
    });
    const preview = await createCatalogImportPreview(input);
    const formula = preview.recordPreviews.find((row) => row.rowNumber === 2)?.rawValues["Calculated Width"].formula;
    expect(formula).toEqual({ formula: "1+1", cachedResult: 2 });
    expect(preview.recordPreviews.some((row) => row.diagnostics.some((diagnostic) => diagnostic.code === "FORMULA_VALUE_PRESENT"))).toBe(true);
  });

  test("41. merged-cell metadata and inferred evidence are explicit", async () => {
    const input = await xlsxInput((workbook) => {
      const sheet = workbook.addWorksheet("Variants");
      sheet.addRows([["SKU", "Product Name"], ["A-1", "Series A"], ["A-2", null]]);
      sheet.mergeCells("B2:B3");
    });
    const preview = await createCatalogImportPreview(input);
    expect(preview.sheets[0].mergedRanges).toContain("B2:B3");
    const inferred = preview.recordPreviews.find((row) => row.rowNumber === 3)?.rawValues["Product Name"].mergedCell;
    expect(inferred).toEqual({ range: "B2:B3", inference: "INFERRED_FROM_MERGED_CELL" });
  });

  test("42. duplicate headers are diagnosed", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Product Name\nA,One,Duplicate"));
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "DUPLICATE_HEADER")).toBe(true);
  });

  test("43. mixed units require review", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Width\nA,One,500 mm\nB,Two,20 in"));
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "UNIT_REVIEW_REQUIRED")).toBe(true);
    expect(preview.attributeCandidates[0].reviewRequired).toBe(true);
  });

  test("44. no usable header produces a blocked preview", async () => {
    const preview = await createCatalogImportPreview(csvInput("\n\n"));
    expect(preview.status).toBe("BLOCKED");
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "HEADER_NOT_FOUND")).toBe(true);
  });

  test("45. parser errors use bounded diagnostic identity", async () => {
    const invalid = {
      ...csvInput("not-a-workbook"),
      fileName: "invalid.xlsx",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("PKinvalid"),
    };
    await expect(createCatalogImportPreview(invalid)).rejects.toBeInstanceOf(CatalogPreviewError);
  });

  test("46. row safety limit fails closed", async () => {
    const rows = ["SKU,Product Name"];
    for (let index = 0; index < CATALOG_IMPORT_LIMITS.maximumRowsPerSheet; index += 1) {
      rows.push(`SKU-${index},Product ${index}`);
    }
    await expect(createCatalogImportPreview(csvInput(rows.join("\n"))))
      .rejects.toMatchObject({ code: "ROW_LIMIT_EXCEEDED" });
  });

  test("47. malformed quoted CSV fails closed", async () => {
    await expect(createCatalogImportPreview(csvInput('SKU,Product Name\nA,"Unclosed')))
      .rejects.toMatchObject({ code: "PARSER_ERROR" });
  });

  test("48. duplicate header columns retain independent raw evidence", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Product Name\nA,One,Alternate"));
    const row = preview.recordPreviews.find((candidate) => candidate.classification === "DATA")!;
    expect(row.rawValues["Product Name [B]"].rawValue).toBe("One");
    expect(row.rawValues["Product Name [C]"].rawValue).toBe("Alternate");
  });

  test("49. ambiguous generic mappings are explicit and require review", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Name\nA,One"));
    expect(preview.columnMappings[1]).toMatchObject({
      suggestedTarget: "PRODUCT_NAME",
      confidence: "LOW",
      reviewRequired: true,
    });
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "AMBIGUOUS_MAPPING")).toBe(true);
  });

  test("50. untrusted headers cannot mutate row object prototypes", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,__proto__\nA,One,pollution"));
    const row = preview.recordPreviews.find((candidate) => candidate.classification === "DATA")!;
    expect(Object.getPrototypeOf(row.rawValues)).toBeNull();
    if (Object.prototype.hasOwnProperty.call(row.rawValues, "__proto__")) {
      expect(row.rawValues["__proto__"].rawValue).toBe("pollution");
    }
    expect(({} as Record<string, unknown>).pollution).toBeUndefined();
  });

  test("51. mapped media and document references remain row candidates only", async () => {
    const preview = await createCatalogImportPreview(csvInput("SKU,Product Name,Image URL,Spec Sheet\nA,One,media://one,document://one"));
    const row = preview.recordPreviews.find((candidate) => candidate.classification === "DATA")!;
    expect(row.candidateMediaReferences).toEqual(["media://one"]);
    expect(row.candidateDocumentReferences).toEqual(["document://one"]);
  });

  test("52. row diagnostics are included in preview-wide diagnostics", async () => {
    const input = await xlsxInput((workbook) => {
      const sheet = workbook.addWorksheet("Products");
      sheet.addRows([["SKU", "Product Name", "Calculated Width"], ["A", "One", { formula: "1+1", result: 2 }]]);
    });
    const preview = await createCatalogImportPreview(input);
    expect(preview.diagnostics.some((diagnostic) => diagnostic.code === "FORMULA_VALUE_PRESENT")).toBe(true);
  });
});