import { savePersistedState } from "@/modules/foundation/foundation-persistence";

jest.mock("@/modules/foundation/foundation-persistence", () => {
  const actual = jest.requireActual("@/modules/foundation/foundation-persistence");
  return { ...actual, savePersistedState: jest.fn(actual.savePersistedState) };
});

import {
  CATALOG_LINEAGE_BATCH_LIMITS,
  appendCatalogImportRecord,
  appendImportLineageBatch,
  appendSourceProvenance,
  createCatalogImport,
  createCatalogSource,
  getCatalogLineagePersistenceReplacementCount,
  getCatalogLineageRepositoryRevision,
  getCatalogImport,
  listCatalogImportRecords,
  listCatalogRevisions,
  listSourceProvenanceByImport,
  resetCatalogLineageRepositoryForTests,
} from "@/modules/foundation/catalog-lineage-repository";
import type {
  NewCatalogImportRecordInput,
  NewSourceProvenanceInput,
} from "@/modules/foundation/catalog-lineage";
import {
  listProducts,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";

const SOURCE_ID = "batch-source";
const IMPORT_ID = "batch-import";

function record(index: number, overrides: Partial<NewCatalogImportRecordInput> = {}): NewCatalogImportRecordInput {
  return {
    recordId: `batch-record-${index}`,
    importId: IMPORT_ID,
    sourceLocator: { sheet: "Products", row: index + 2, recordKey: `row-${index}` },
    rawPayload: { sku: `SKU-${index}`, value: index },
    normalizedCandidate: { sku: `SKU-${index}`, value: index },
    status: "MAPPED",
    diagnostics: [],
    reconciliationDecision: "UNREVIEWED",
    ...overrides,
  };
}

function provenance(index: number, recordId = `batch-record-${index}`): NewSourceProvenanceInput {
  return {
    sourceId: SOURCE_ID,
    importId: IMPORT_ID,
    importRecordId: recordId,
    sourceLocator: { sheet: "Products", row: index + 2, column: "A" },
    observedAt: `2026-08-27T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    rawValue: `SKU-${index}`,
    normalizedValue: `SKU-${index}`,
    transformationChain: [{
      type: "SOURCE_READ",
      input: `SKU-${index}`,
      output: `SKU-${index}`,
      rule: "batch-test",
      ruleVersion: "1",
      timestamp: "2026-08-27T00:00:00.000Z",
      actor: null,
    }],
    confidence: 1,
  };
}

function prepareImport(): void {
  createCatalogSource({
    sourceId: SOURCE_ID,
    organizationId: "led-display-warehouse",
    type: "SPREADSHEET",
    name: "Batch Source",
    externalSystem: "test",
    configurationReference: null,
    enabled: true,
  });
  createCatalogImport({
    importId: IMPORT_ID,
    sourceId: SOURCE_ID,
    sourceVersion: "1",
    contentHash: "batch-content-hash",
    schemaVersion: "1",
    startedAt: "2026-08-27T00:00:00.000Z",
    createdBy: "test",
    recordCounts: { total: 0, accepted: 0, rejected: 0, warning: 0 },
    diagnostics: [],
  });
}

function expectEmptyBatchState(): void {
  expect(listCatalogImportRecords(IMPORT_ID)).toEqual([]);
  expect(listSourceProvenanceByImport(IMPORT_ID)).toEqual([]);
}

describe("catalog lineage batch persistence", () => {
  beforeEach(() => {
    jest.mocked(savePersistedState).mockImplementation(
      jest.requireActual("@/modules/foundation/foundation-persistence").savePersistedState,
    );
    resetCatalogLineageRepositoryForTests();
    resetProductRepositoryForTests();
    prepareImport();
  });

  test("1. a batch of one record persists", () => {
    const result = appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [] });
    expect(result.importRecordCount).toBe(1);
    expect(listCatalogImportRecords(IMPORT_ID)).toHaveLength(1);
  });

  test("2. many records persist atomically with one replacement", () => {
    const before = getCatalogLineagePersistenceReplacementCount();
    appendImportLineageBatch({
      importId: IMPORT_ID,
      records: Array.from({ length: 1_000 }, (_, index) => record(index)),
      provenance: [],
    });
    expect(listCatalogImportRecords(IMPORT_ID)).toHaveLength(1_000);
    expect(getCatalogLineagePersistenceReplacementCount() - before).toBe(1);
  });

  test("3. records and provenance persist in the same batch", () => {
    appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(1)] });
    expect(listCatalogImportRecords(IMPORT_ID)).toHaveLength(1);
    expect(listSourceProvenanceByImport(IMPORT_ID)).toHaveLength(1);
  });

  test("4. provenance can reference a same-batch record", () => {
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [record(1)],
      provenance: [provenance(1)],
    })).not.toThrow();
  });

  test("5. provenance can reference an existing record", () => {
    appendCatalogImportRecord(record(1));
    appendImportLineageBatch({ importId: IMPORT_ID, records: [], provenance: [provenance(1)] });
    expect(listSourceProvenanceByImport(IMPORT_ID)).toHaveLength(1);
  });

  test("6. duplicate record against repository fails atomically", () => {
    appendCatalogImportRecord(record(1));
    const before = listCatalogImportRecords(IMPORT_ID);
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(2), record(1)], provenance: [] }))
      .toThrow(expect.objectContaining({ code: "IMPORT_RECORD_ALREADY_EXISTS" }));
    expect(listCatalogImportRecords(IMPORT_ID)).toEqual(before);
  });

  test("7. duplicate record inside batch fails atomically", () => {
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1), record(1)], provenance: [] }))
      .toThrow(expect.objectContaining({ code: "IMPORT_RECORD_ALREADY_EXISTS" }));
    expectEmptyBatchState();
  });

  test("8. duplicate provenance against repository fails atomically", () => {
    appendCatalogImportRecord(record(1));
    appendSourceProvenance(provenance(1));
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(2)], provenance: [provenance(1)] }))
      .toThrow(expect.objectContaining({ code: "PROVENANCE_ALREADY_EXISTS" }));
    expect(listCatalogImportRecords(IMPORT_ID).map((item) => item.recordId)).toEqual(["batch-record-1"]);
  });

  test("9. duplicate provenance inside batch fails atomically", () => {
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(1), provenance(1)] }))
      .toThrow(expect.objectContaining({ code: "PROVENANCE_ALREADY_EXISTS" }));
    expectEmptyBatchState();
  });

  test("10. invalid late record rolls back the entire batch", () => {
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [record(1), record(2), record(3, { importId: "other-import" })],
      provenance: [],
    })).toThrow(expect.objectContaining({ code: "IMPORT_RECORD_LINEAGE_MISMATCH" }));
    expectEmptyBatchState();
  });

  test("11. invalid late provenance rolls back the entire batch", () => {
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [record(1), record(2)],
      provenance: [provenance(1), provenance(2), provenance(3, "missing-record")],
    })).toThrow(expect.objectContaining({ code: "PROVENANCE_LINEAGE_MISMATCH" }));
    expectEmptyBatchState();
  });

  test("12. bad same-batch reference rolls back all", () => {
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(2)] }))
      .toThrow(expect.objectContaining({ code: "PROVENANCE_LINEAGE_MISMATCH" }));
    expectEmptyBatchState();
  });

  test("13. expected revision conflict rolls back all", () => {
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [record(1)],
      provenance: [],
      expectedRepositoryRevision: getCatalogLineageRepositoryRevision() - 1,
    })).toThrow(expect.objectContaining({ code: "LINEAGE_REVISION_CONFLICT" }));
    expectEmptyBatchState();
  });

  test("14. simulated persistence failure rolls back all", () => {
    const revisionBefore = getCatalogLineageRepositoryRevision();
    jest.mocked(savePersistedState).mockImplementationOnce(() => {
      throw new Error("simulated persistence failure");
    });
    expect(() => appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(1)] }))
      .toThrow("simulated persistence failure");
    expectEmptyBatchState();
    expect(getCatalogLineageRepositoryRevision()).toBe(revisionBefore);
  });

  test("15. record limit fails before mutation", () => {
    const repeated = record(1);
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: Array(CATALOG_LINEAGE_BATCH_LIMITS.maximumImportRecords + 1).fill(repeated),
      provenance: [],
    })).toThrow(expect.objectContaining({ code: "IMPORT_RECORD_BATCH_LIMIT_EXCEEDED" }));
    expectEmptyBatchState();
  });

  test("16. provenance limit fails before mutation", () => {
    const repeated = provenance(1);
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [],
      provenance: Array(CATALOG_LINEAGE_BATCH_LIMITS.maximumProvenanceRecords + 1).fill(repeated),
    })).toThrow(expect.objectContaining({ code: "PROVENANCE_BATCH_LIMIT_EXCEEDED" }));
    expectEmptyBatchState();
  });

  test("17. sensitive raw payload fails the entire batch", () => {
    expect(() => appendImportLineageBatch({
      importId: IMPORT_ID,
      records: [record(1), record(2, { rawPayload: { apiKey: "unsafe" } })],
      provenance: [],
    })).toThrow(expect.objectContaining({ code: "SENSITIVE_PAYLOAD_REJECTED" }));
    expectEmptyBatchState();
  });

  test("18. individual append operations remain compatible", () => {
    const created = appendCatalogImportRecord(record(1));
    const observed = appendSourceProvenance(provenance(1));
    expect(created.rawPayloadHash).toBeDefined();
    expect(observed.provenanceId).toBeDefined();
  });

  test("19. cross-import provenance remains distinct", () => {
    appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(1)] });
    const first = listSourceProvenanceByImport(IMPORT_ID)[0];
    expect(first.provenanceId).toContain("provenance-");
  });

  test("20. batch persistence does not create CatalogRevision", () => {
    appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [] });
    expect(listCatalogRevisions()).toEqual([]);
  });

  test("21. batch persistence does not mutate ProductConfiguration", () => {
    const productsBefore = JSON.stringify(listProducts());
    appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [provenance(1)] });
    expect(JSON.stringify(listProducts())).toBe(productsBefore);
  });

  test("22. batch limits are bounded for the observed real workload", () => {
    expect(CATALOG_LINEAGE_BATCH_LIMITS).toEqual({
      maximumImportRecords: 25_000,
      maximumProvenanceRecords: 100_000,
      maximumTotalObjects: 125_000,
    });
  });

  test("23. exact real-cardinality batch persists with one replacement", () => {
    const recordCount = 15_033;
    const records = Array.from({ length: recordCount }, (_, index) => record(index));
    const provenanceRecords = records.flatMap((_, index) => [
      provenance(index),
      { ...provenance(index), sourceLocator: { sheet: "Products", row: index + 2, column: "B" }, rawValue: `Product ${index}`, normalizedValue: `Product ${index}` },
    ]);
    const before = getCatalogLineagePersistenceReplacementCount();
    const result = appendImportLineageBatch({ importId: IMPORT_ID, records, provenance: provenanceRecords });
    expect(result).toMatchObject({ importRecordCount: 15_033, provenanceCount: 30_066 });
    expect(getCatalogLineagePersistenceReplacementCount() - before).toBe(1);
    expect(listCatalogImportRecords(IMPORT_ID)).toHaveLength(15_033);
    expect(listSourceProvenanceByImport(IMPORT_ID)).toHaveLength(30_066);
  }, 120_000);

  test("24. import lifecycle remains below review and apply states", () => {
    appendImportLineageBatch({ importId: IMPORT_ID, records: [record(1)], provenance: [] });
    expect(getCatalogImport(IMPORT_ID)?.status).toBe("RECEIVED");
  });
});