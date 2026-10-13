import { createCanonicalContentHash } from "@/modules/foundation/canonical-content-hash";
import {
  createCatalogRevisionContentHash,
  createCatalogSourceId,
  type CatalogRevisionSnapshot,
  type NewCatalogImportInput,
  type NewCatalogImportRecordInput,
  type NewCatalogSourceInput,
  type NewSourceProvenanceInput,
  type SourceLocator,
} from "@/modules/foundation/catalog-lineage";
import {
  CatalogLineageRepositoryError,
  appendCatalogImportRecord,
  appendSourceProvenance,
  createCatalogImport,
  createCatalogRevision,
  createCatalogSource,
  createImportContentHash,
  getCatalogImport,
  getCatalogImportRecord,
  getCatalogRevision,
  getCatalogSource,
  getLatestCatalogRevision,
  getSourceProvenance,
  listCatalogImportRecords,
  listCatalogImports,
  listCatalogRevisions,
  listCatalogSources,
  listSourceProvenanceByImport,
  listSourceProvenanceByImportRecord,
  resetCatalogLineageRepositoryForTests,
  setCatalogSourceEnabled,
  transitionCatalogImportStatus,
  updateCatalogSource,
} from "@/modules/foundation/catalog-lineage-repository";
import {
  getCanonicalProduct,
  listCanonicalProducts,
  listProducts,
  resetProductRepositoryForTests,
} from "@/modules/foundation/product-repository";

const ORGANIZATION_ID = "led-display-warehouse";
const SOURCE_ID = "catalog-source-test";

function sourceInput(overrides: Partial<NewCatalogSourceInput> = {}): NewCatalogSourceInput {
  return {
    sourceId: SOURCE_ID,
    organizationId: ORGANIZATION_ID,
    type: "SPREADSHEET",
    name: "Synthetic Catalog",
    externalSystem: "test-fixture",
    configurationReference: "configref-synthetic-catalog",
    enabled: true,
    ...overrides,
  };
}

function importInput(
  importId = "catalog-import-1",
  payload: unknown = { sku: "TEST-1", value: 10 },
  sourceId = SOURCE_ID,
): NewCatalogImportInput {
  return {
    importId,
    sourceId,
    sourceVersion: "source-v1",
    contentHash: createCanonicalContentHash(payload),
    schemaVersion: "catalog-import-v1",
    startedAt: "2026-08-27T00:00:00.000Z",
    createdBy: "test-operator",
    recordCounts: { total: 1, accepted: 0, rejected: 0, warning: 0 },
    diagnostics: [],
  };
}

function recordInput(
  recordId = "catalog-record-1",
  importId = "catalog-import-1",
): NewCatalogImportRecordInput {
  return {
    recordId,
    importId,
    sourceLocator: { fileName: "synthetic.xlsx", sheet: "Products", row: 2, column: "A", cellRange: "A2:D2" },
    rawPayload: { sku: "TEST-1", dimensions: { height: 10, width: 20 } },
    normalizedCandidate: { sku: "TEST-1", height: 10, width: 20 },
    status: "MAPPED",
    diagnostics: [],
    reconciliationDecision: "UNREVIEWED",
  };
}

function provenanceInput(
  importId = "catalog-import-1",
  importRecordId = "catalog-record-1",
): NewSourceProvenanceInput {
  return {
    sourceId: SOURCE_ID,
    importId,
    importRecordId,
    sourceLocator: { fileName: "synthetic.xlsx", sheet: "Products", row: 2, column: "C" },
    observedAt: "2026-08-27T00:00:00.000Z",
    rawValue: "10 mm",
    normalizedValue: { value: 10, unit: "mm" },
    transformationChain: [
      {
        type: "UNIT_NORMALIZATION",
        input: "10 mm",
        output: { value: 10, unit: "mm" },
        rule: "metric-length",
        ruleVersion: "1",
        timestamp: "2026-08-27T00:00:01.000Z",
        actor: null,
      },
    ],
    confidence: 1,
  };
}

function transitionToApproved(importId = "catalog-import-1"): void {
  for (const status of ["PARSED", "MAPPED", "VALIDATED", "PREVIEW_READY", "REVIEWED", "APPROVED"] as const) {
    transitionCatalogImportStatus({ importId, status });
  }
}

function revisionSnapshot(): CatalogRevisionSnapshot {
  return {
    sourceImportIds: ["catalog-import-1"],
    products: listCanonicalProducts().map((product) => ({ id: product.productId, version: product.version })),
    productFamilies: [],
    variants: [],
    attributeDefinitions: [],
    mediaAssets: [],
    documentAssets: [],
  };
}

describe("catalog source, import, provenance, and revision persistence", () => {
  beforeEach(() => {
    resetCatalogLineageRepositoryForTests();
    resetProductRepositoryForTests();
    createCatalogSource(sourceInput());
  });

  test("1. CatalogSource create, get, and list work", () => {
    expect(getCatalogSource(SOURCE_ID)?.name).toBe("Synthetic Catalog");
    expect(listCatalogSources(ORGANIZATION_ID)).toHaveLength(1);
  });

  test("2. CatalogSource identity helper is deterministic", () => {
    const identity = { organizationId: ORGANIZATION_ID, type: "API" as const, name: "Catalog API", externalSystem: "ERP" };
    expect(createCatalogSourceId(identity)).toBe(createCatalogSourceId({ ...identity }));
  });

  test("3. CatalogSource stable identity cannot be changed", () => {
    expect(() => updateCatalogSource(SOURCE_ID, { sourceId: "changed" } as never))
      .toThrow(expect.objectContaining({ code: "SOURCE_IDENTITY_IMMUTABLE" }));
    expect(getCatalogSource(SOURCE_ID)?.sourceId).toBe(SOURCE_ID);
  });

  test("4. CatalogSource non-identity metadata updates increment version", () => {
    const updated = updateCatalogSource(SOURCE_ID, { name: "Renamed Source" });
    expect(updated).toMatchObject({ sourceId: SOURCE_ID, name: "Renamed Source", version: 2 });
  });

  test("5. CatalogSource enable and disable preserve identity", () => {
    expect(setCatalogSourceEnabled(SOURCE_ID, false)).toMatchObject({ sourceId: SOURCE_ID, enabled: false });
    expect(setCatalogSourceEnabled(SOURCE_ID, true)).toMatchObject({ sourceId: SOURCE_ID, enabled: true });
  });

  test("6. CatalogSource contains no direct credential field and rejects credential-like references", () => {
    const source = getCatalogSource(SOURCE_ID)!;
    expect(source).not.toHaveProperty("password");
    expect(source).not.toHaveProperty("apiKey");
    expect(() => createCatalogSource(sourceInput({ sourceId: "bad-source", configurationReference: "password=unsafe" })))
      .toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION_REFERENCE" }));
  });

  test("7. CatalogImport persists immutable source and content identity", () => {
    const created = createCatalogImport(importInput());
    expect(getCatalogImport(created.importId)).toMatchObject({
      importId: created.importId,
      sourceId: SOURCE_ID,
      contentHash: created.contentHash,
      status: "RECEIVED",
    });
    expect(listCatalogImports(SOURCE_ID)).toHaveLength(1);
  });

  test("8. duplicate source and content hash is detected without reusing an import ID", () => {
    createCatalogImport(importInput());
    expect(() => createCatalogImport(importInput("catalog-import-2")))
      .toThrow(expect.objectContaining({ code: "DUPLICATE_IMPORT_DETECTED" }));
    expect(getCatalogImport("catalog-import-2")).toBeNull();
  });

  test("9. legal import lifecycle transitions succeed", () => {
    createCatalogImport(importInput());
    transitionToApproved();
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "APPLYING" });
    expect(transitionCatalogImportStatus({ importId: "catalog-import-1", status: "APPLIED" }).status).toBe("APPLIED");
  });

  test("10. illegal lifecycle transitions fail closed", () => {
    createCatalogImport(importInput());
    expect(() => transitionCatalogImportStatus({ importId: "catalog-import-1", status: "APPROVED" }))
      .toThrow(expect.objectContaining({ code: "ILLEGAL_IMPORT_TRANSITION" }));
    expect(getCatalogImport("catalog-import-1")?.status).toBe("RECEIVED");
  });

  test("11. APPLIED is terminal", () => {
    createCatalogImport(importInput());
    transitionToApproved();
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "APPLYING" });
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "APPLIED" });
    expect(() => transitionCatalogImportStatus({ importId: "catalog-import-1", status: "FAILED" }))
      .toThrow(expect.objectContaining({ code: "ILLEGAL_IMPORT_TRANSITION" }));
  });

  test("12. REJECTED is terminal", () => {
    createCatalogImport(importInput());
    for (const status of ["PARSED", "MAPPED", "VALIDATED", "PREVIEW_READY"] as const) {
      transitionCatalogImportStatus({ importId: "catalog-import-1", status });
    }
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "REJECTED" });
    expect(() => transitionCatalogImportStatus({ importId: "catalog-import-1", status: "REVIEWED" }))
      .toThrow(expect.objectContaining({ code: "ILLEGAL_IMPORT_TRANSITION" }));
  });

  test("13. diagnostic metadata is boundedly redacted", () => {
    const created = createCatalogImport({
      ...importInput(),
      diagnostics: [{ code: "TEST", severity: "ERROR", message: "token=unsafe-value" }],
    });
    expect(created.diagnostics[0].message).toBe("token=[REDACTED]");
  });

  test("14. CatalogImportRecord preserves immutable raw payload", () => {
    createCatalogImport(importInput());
    const input = recordInput();
    const created = appendCatalogImportRecord(input);
    (input.rawPayload as { sku: string }).sku = "MUTATED";
    expect(getCatalogImportRecord(created.recordId)?.rawPayload).toEqual({
      sku: "TEST-1",
      dimensions: { height: 10, width: 20 },
    });
    expect(listCatalogImportRecords(created.importId)).toHaveLength(1);
  });

  test("15. import record raw payload cannot be overwritten by duplicate append", () => {
    createCatalogImport(importInput());
    appendCatalogImportRecord(recordInput());
    expect(() => appendCatalogImportRecord({ ...recordInput(), rawPayload: { sku: "CHANGED" } }))
      .toThrow(expect.objectContaining({ code: "IMPORT_RECORD_ALREADY_EXISTS" }));
    expect(getCatalogImportRecord("catalog-record-1")?.rawPayload).toHaveProperty("sku", "TEST-1");
  });

  test("16. credential-like raw payload keys are rejected before persistence", () => {
    createCatalogImport(importInput());
    expect(() => appendCatalogImportRecord({ ...recordInput(), rawPayload: { sku: "TEST-1", apiKey: "unsafe" } }))
      .toThrow(expect.objectContaining({ code: "SENSITIVE_PAYLOAD_REJECTED" }));
    expect(getCatalogImportRecord("catalog-record-1")).toBeNull();
  });

  test("17. SourceLocator supports spreadsheet coordinates", () => {
    const locator: SourceLocator = { fileName: "catalog.xlsx", sheet: "Products", row: 10, column: "C", cellRange: "A10:C10" };
    expect(locator).toMatchObject({ sheet: "Products", row: 10, column: "C" });
  });

  test("18. SourceLocator supports URL and external object identity without spreadsheet coordinates", () => {
    const locator: SourceLocator = { url: "https://example.test/products/42", externalObjectId: "42", externalParentId: "7", path: "/products/42" };
    expect(locator.externalObjectId).toBe("42");
    expect(locator.sheet).toBeUndefined();
  });

  test("19. same canonical payload produces the same hash", () => {
    expect(createImportContentHash({ sku: "A", value: 1 })).toBe(createImportContentHash({ sku: "A", value: 1 }));
  });

  test("20. object key ordering does not change content hash", () => {
    expect(createImportContentHash({ sku: "A", nested: { width: 2, height: 1 } }))
      .toBe(createImportContentHash({ nested: { height: 1, width: 2 }, sku: "A" }));
  });

  test("21. changed source content changes content hash", () => {
    expect(createImportContentHash({ sku: "A", value: 1 })).not.toBe(createImportContentHash({ sku: "A", value: 2 }));
  });

  test("22. SourceProvenance retains source, import, and record identity", () => {
    createCatalogImport(importInput());
    appendCatalogImportRecord(recordInput());
    const provenance = appendSourceProvenance(provenanceInput());
    expect(getSourceProvenance(provenance.provenanceId)).toMatchObject({
      sourceId: SOURCE_ID,
      importId: "catalog-import-1",
      importRecordId: "catalog-record-1",
    });
    expect(listSourceProvenanceByImportRecord("catalog-record-1")).toHaveLength(1);
    expect(listSourceProvenanceByImport("catalog-import-1")).toHaveLength(1);
  });

  test("23. two imports observing the same value remain distinct provenance observations", () => {
    createCatalogImport(importInput());
    createCatalogImport(importInput("catalog-import-2", { sku: "TEST-1", value: 11 }));
    appendCatalogImportRecord(recordInput());
    appendCatalogImportRecord(recordInput("catalog-record-2", "catalog-import-2"));
    const first = appendSourceProvenance(provenanceInput());
    const second = appendSourceProvenance(provenanceInput("catalog-import-2", "catalog-record-2"));
    expect(second.provenanceId).not.toBe(first.provenanceId);
  });

  test("24. duplicate exact source observation is rejected", () => {
    createCatalogImport(importInput());
    appendCatalogImportRecord(recordInput());
    appendSourceProvenance(provenanceInput());
    expect(() => appendSourceProvenance(provenanceInput()))
      .toThrow(expect.objectContaining({ code: "PROVENANCE_ALREADY_EXISTS" }));
  });

  test("25. transformation chain is preserved", () => {
    createCatalogImport(importInput());
    appendCatalogImportRecord(recordInput());
    const provenance = appendSourceProvenance(provenanceInput());
    expect(provenance.transformationChain).toEqual(provenanceInput().transformationChain);
  });

  test("26. existing product without provenance remains valid", () => {
    const product = getCanonicalProduct("prod-indoor-led-video-wall");
    expect(product).not.toBeNull();
    expect(product?.sourceEvidenceReference).toBeNull();
  });

  test("27. creating an import does not mutate product authority", () => {
    const before = JSON.stringify(listProducts());
    createCatalogImport(importInput());
    expect(JSON.stringify(listProducts())).toBe(before);
  });

  test("28. creating import records and provenance does not mutate product authority", () => {
    const before = JSON.stringify(listProducts());
    createCatalogImport(importInput());
    appendCatalogImportRecord(recordInput());
    appendSourceProvenance(provenanceInput());
    expect(JSON.stringify(listProducts())).toBe(before);
  });

  test("29. CatalogRevision rejects imports that are not approved or applied", () => {
    createCatalogImport(importInput());
    expect(() => createCatalogRevision({ organizationId: ORGANIZATION_ID, createdBy: "operator", snapshot: revisionSnapshot(), metadata: {} }))
      .toThrow(expect.objectContaining({ code: "IMPORT_NOT_APPROVED_FOR_REVISION" }));
    expect(listCatalogRevisions()).toHaveLength(0);
  });

  test("30. CatalogRevision creation references all existing projected products", () => {
    createCatalogImport(importInput());
    transitionToApproved();
    const revision = createCatalogRevision({ organizationId: ORGANIZATION_ID, createdBy: "operator", snapshot: revisionSnapshot(), metadata: {} });
    expect(revision.productIds).toEqual(listCanonicalProducts().map((product) => product.productId).sort());
    expect(revision.productIds).toHaveLength(6);
  });

  test("31. CatalogRevision is immutable through returned values", () => {
    createCatalogImport(importInput());
    transitionToApproved();
    const revision = createCatalogRevision({ organizationId: ORGANIZATION_ID, createdBy: "operator", snapshot: revisionSnapshot(), metadata: { reason: "initial" } });
    (revision.productIds as string[]).push("mutated-product");
    (revision.metadata as Record<string, string>).reason = "mutated";
    expect(getCatalogRevision(revision.catalogRevisionId)?.productIds).not.toContain("mutated-product");
    expect(getCatalogRevision(revision.catalogRevisionId)?.metadata.reason).toBe("initial");
  });

  test("32. revision numbering is organization-scoped, monotonic, and latest is readable", () => {
    createCatalogImport(importInput());
    transitionToApproved();
    const first = createCatalogRevision({ organizationId: ORGANIZATION_ID, createdBy: "operator", snapshot: revisionSnapshot(), metadata: {} });
    const second = createCatalogRevision({ organizationId: ORGANIZATION_ID, createdBy: "operator", snapshot: revisionSnapshot(), metadata: {} });
    expect([first.revisionNumber, second.revisionNumber]).toEqual([1, 2]);
    expect(second.previousRevisionId).toBe(first.catalogRevisionId);
    expect(getLatestCatalogRevision(ORGANIZATION_ID)?.catalogRevisionId).toBe(second.catalogRevisionId);
  });

  test("33. equivalent canonical revision snapshots hash identically", () => {
    const snapshot = revisionSnapshot();
    const reordered = { ...snapshot, products: [...snapshot.products].reverse() };
    expect(createCatalogRevisionContentHash(snapshot)).toBe(createCatalogRevisionContentHash(reordered));
  });

  test("34. meaningful canonical changes alter the revision hash", () => {
    const snapshot = revisionSnapshot();
    const changed = {
      ...snapshot,
      products: snapshot.products.map((product, index) => index === 0 ? { ...product, version: product.version + 1 } : product),
    };
    expect(createCatalogRevisionContentHash(snapshot)).not.toBe(createCatalogRevisionContentHash(changed));
  });

  test("35. import creation does not automatically create CatalogRevision", () => {
    createCatalogImport(importInput());
    expect(listCatalogRevisions()).toEqual([]);
  });

  test("36. CatalogRevision rejects approved imports from another organization", () => {
    createCatalogSource(sourceInput({ sourceId: "other-source", organizationId: "other-organization" }));
    createCatalogImport(importInput("other-import", { sku: "OTHER" }, "other-source"));
    transitionToApproved("other-import");
    expect(() => createCatalogRevision({
      organizationId: ORGANIZATION_ID,
      createdBy: "operator",
      snapshot: { ...revisionSnapshot(), sourceImportIds: ["other-import"] },
      metadata: {},
    })).toThrow(expect.objectContaining({ code: "REVISION_ORGANIZATION_MISMATCH" }));
  });

  test("37. import lifecycle history is append-only and preserves every transition", () => {
    createCatalogImport(importInput());
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "PARSED", actor: "parser" });
    transitionCatalogImportStatus({ importId: "catalog-import-1", status: "MAPPED", actor: "mapper" });
    expect(getCatalogImport("catalog-import-1")?.statusHistory).toEqual([
      {
        from: null,
        to: "RECEIVED",
        transitionedAt: "2026-08-27T00:00:00.000Z",
        actor: "test-operator",
      },
      expect.objectContaining({ from: "RECEIVED", to: "PARSED", actor: "parser" }),
      expect.objectContaining({ from: "PARSED", to: "MAPPED", actor: "mapper" }),
    ]);
  });
});