import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";
import type {
  CatalogImportInput,
  CatalogImportMappingOverrides,
  CatalogImportPreview,
  PreviewDiagnostic,
} from "./catalog-import-preview";
import { createCatalogImportPreview } from "./catalog-spreadsheet-preview";
import {
  appendCatalogImportRecord,
  appendSourceProvenance,
  createCatalogImport,
  getCatalogSource,
  transitionCatalogImportStatus,
} from "./catalog-lineage-repository";
import type { CatalogDiagnostic, SourceLocator } from "./catalog-lineage";

function lineageDiagnostic(diagnostic: PreviewDiagnostic): CatalogDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity === "INFO"
      ? "INFO"
      : diagnostic.severity === "WARNING"
        ? "WARNING"
        : "ERROR",
    message: diagnostic.message,
    sourceLocator: diagnostic.sourceLocator,
  };
}

function rawRowPayload(
  rawValues: CatalogImportPreview["recordPreviews"][number]["rawValues"],
): CanonicalJsonValue {
  return Object.fromEntries(
    Object.entries(rawValues).map(([header, value]) => [header, value.rawValue]),
  );
}

function columnLocator(
  rowLocator: SourceLocator,
  column: string,
): SourceLocator {
  return { ...rowLocator, column, cellRange: `${column}${rowLocator.row}` };
}

export async function createPersistedCatalogImportPreview(
  input: CatalogImportInput,
  mappingOverrides: CatalogImportMappingOverrides = {},
): Promise<CatalogImportPreview> {
  if (!getCatalogSource(input.sourceId)) {
    throw new Error(`Catalog source not found: ${input.sourceId}`);
  }

  const preview = await createCatalogImportPreview(input, mappingOverrides);
  if (preview.status === "BLOCKED") {
    return preview;
  }

  createCatalogImport({
    importId: input.importId,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion ?? preview.contentHash,
    contentHash: preview.contentHash,
    schemaVersion: "catalog-import-preview-v1",
    startedAt: preview.createdAt,
    createdBy: input.createdBy,
    recordCounts: {
      total: preview.counts.rawRowCount,
      accepted: preview.counts.candidateDataRowCount,
      rejected: preview.counts.malformedRowCount,
      warning: preview.diagnostics.filter((diagnostic) => diagnostic.severity === "WARNING").length,
    },
    diagnostics: preview.diagnostics.map(lineageDiagnostic),
  });
  transitionCatalogImportStatus({ importId: input.importId, status: "PARSED", actor: "catalog-preview-parser" });

  for (const row of preview.recordPreviews.filter((candidate) =>
    candidate.classification === "DATA" || candidate.classification === "MALFORMED")) {
    const recordId = `catalog-import-record-${createCanonicalContentHash({
      importId: input.importId,
      sourceLocator: row.sourceLocator,
      rawValues: rawRowPayload(row.rawValues),
    }).slice(0, 32)}`;
    appendCatalogImportRecord({
      recordId,
      importId: input.importId,
      sourceLocator: row.sourceLocator,
      rawPayload: rawRowPayload(row.rawValues),
      normalizedCandidate: {
        productIdentity: row.candidateProductIdentity,
        attributes: row.candidateAttributeValues,
        mediaReferences: row.candidateMediaReferences,
        documentReferences: row.candidateDocumentReferences,
      },
      status: row.classification === "MALFORMED" ? "INVALID" : "MAPPED",
      diagnostics: row.diagnostics.map(lineageDiagnostic),
      reconciliationDecision: "UNREVIEWED",
    });

    const sheet = preview.sheets.find((candidate) => candidate.sheetName === row.sheetName);
    for (const mapping of sheet?.columnMappings ?? []) {
      if (mapping.suggestedTarget === "UNMAPPED" || mapping.suggestedTarget === "IGNORE") continue;
      const cell = row.rawValues[mapping.sourceColumn.sourceValueKey];
      if (!cell || cell.rawValue === null) continue;
      appendSourceProvenance({
        sourceId: input.sourceId,
        importId: input.importId,
        importRecordId: recordId,
        sourceLocator: columnLocator(row.sourceLocator, mapping.sourceColumn.columnLetter),
        observedAt: preview.createdAt,
        rawValue: cell.rawValue,
        normalizedValue: cell.normalizedStructuralValue,
        transformationChain: [
          {
            type: "SOURCE_READ",
            input: cell.rawValue,
            output: cell.rawValue,
            rule: "exceljs-cell-read",
            ruleVersion: "4.4.0",
            timestamp: preview.createdAt,
            actor: null,
          },
          {
            type: "COLUMN_MAPPING",
            input: mapping.sourceColumn.sourceHeader,
            output: mapping.suggestedTarget,
            rule: mapping.reason,
            ruleVersion: input.mappingProfileId ?? "genesis-default-v1",
            timestamp: preview.createdAt,
            actor: input.createdBy,
          },
        ],
        confidence: mapping.confidence === "EXACT"
          ? 1
          : mapping.confidence === "HIGH"
            ? 0.85
            : mapping.confidence === "MEDIUM"
              ? 0.6
              : 0.25,
      });
    }
  }

  transitionCatalogImportStatus({ importId: input.importId, status: "MAPPED", actor: "catalog-preview-mapper" });
  transitionCatalogImportStatus({ importId: input.importId, status: "VALIDATED", actor: "catalog-preview-validator" });
  transitionCatalogImportStatus({ importId: input.importId, status: "PREVIEW_READY", actor: input.createdBy });
  return preview;
}