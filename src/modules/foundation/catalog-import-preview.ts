import type { AttributeDataType } from "./canonical-catalog";
import type { CanonicalJsonValue } from "./canonical-content-hash";
import type { SourceLocator } from "./catalog-lineage";

export const CATALOG_IMPORT_LIMITS = {
  maximumXlsxFileSizeBytes: 128 * 1024 * 1024,
  maximumCsvFileSizeBytes: 10 * 1024 * 1024,
  maximumSheets: 40,
  maximumRowsPerSheet: 5_000,
  maximumColumnsPerSheet: 256,
  maximumTotalStructuralCells: 1_000_000,
  maximumTotalNonEmptyCells: 250_000,
  maximumCellTextLength: 32_768,
  maximumFormulaCells: 100_000,
  maximumMergedRanges: 20_000,
  maximumHyperlinks: 10_000,
  maximumHeaderScanRows: 25,
} as const;

export type CatalogImportFileType = "XLSX" | "CSV";
export type CatalogImportMediaType =
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "text/csv";

export type CatalogImportInput = {
  sourceId: string;
  importId: string;
  fileName: string;
  mediaType: string;
  buffer: Buffer;
  createdBy: string;
  sourceVersion?: string;
  mappingProfileId?: string;
};

export type PreviewDiagnosticCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "SHEET_LIMIT_EXCEEDED"
  | "ROW_LIMIT_EXCEEDED"
  | "COLUMN_LIMIT_EXCEEDED"
  | "CELL_LIMIT_EXCEEDED"
  | "NON_EMPTY_CELL_LIMIT_EXCEEDED"
  | "CELL_TEXT_LIMIT_EXCEEDED"
  | "FORMULA_LIMIT_EXCEEDED"
  | "MERGED_RANGE_LIMIT_EXCEEDED"
  | "HYPERLINK_LIMIT_EXCEEDED"
  | "HEADER_NOT_FOUND"
  | "HEADER_REVIEW_REQUIRED"
  | "DUPLICATE_HEADER"
  | "UNMAPPED_COLUMN"
  | "AMBIGUOUS_MAPPING"
  | "MALFORMED_ROW"
  | "MIXED_DATA_TYPES"
  | "UNIT_REVIEW_REQUIRED"
  | "STRUCTURE_REVIEW_REQUIRED"
  | "DUPLICATE_SOURCE_ROW"
  | "SENSITIVE_VALUE_REJECTED"
  | "INFERRED_FROM_MERGED_CELL"
  | "FORMULA_VALUE_PRESENT"
  | "PARSER_ERROR";

export type PreviewDiagnostic = {
  code: PreviewDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR" | "BLOCKING";
  message: string;
  sourceLocator?: SourceLocator;
};

export type CatalogMappingTarget =
  | "PRODUCT_ID"
  | "SKU"
  | "MODEL_NUMBER"
  | "PRODUCT_NAME"
  | "PRODUCT_FAMILY"
  | "MANUFACTURER"
  | "CATEGORY"
  | "DESCRIPTION"
  | "SHORT_DESCRIPTION"
  | "STATUS"
  | "SLUG"
  | "SITE"
  | "VARIANT_KEY_SOURCE"
  | "ATTRIBUTE"
  | "MEDIA_REFERENCE"
  | "DOCUMENT_REFERENCE"
  | "IGNORE"
  | "UNMAPPED";

export type MappingConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type HeaderColumn = {
  sourceHeader: string;
  normalizedHeader: string;
  sourceValueKey: string;
  columnIndex: number;
  columnLetter: string;
};

export type HeaderCandidate = {
  rowNumber: number;
  confidence: MappingConfidence;
  score: number;
  reasons: readonly string[];
};

export type HeaderSelection = {
  selectedHeaderRow: number | null;
  confidence: MappingConfidence;
  candidateHeaderRows: readonly HeaderCandidate[];
  reasons: readonly string[];
  reviewRequired: boolean;
  columns: readonly HeaderColumn[];
};

export type ColumnMappingSuggestion = {
  sourceColumn: HeaderColumn;
  suggestedTarget: CatalogMappingTarget;
  confidence: MappingConfidence;
  reason: string;
  alternatives: readonly CatalogMappingTarget[];
  reviewRequired: boolean;
};

export type UnitObservation = {
  rawUnit: string;
  candidateCanonicalUnit: string;
  confidence: MappingConfidence;
};

export type AttributeMappingCandidate = {
  sourceHeader: string;
  suggestedKey: string;
  observedDataType: AttributeDataType;
  observedUnits: readonly UnitObservation[];
  sampleValues: readonly string[];
  confidence: MappingConfidence;
  reviewRequired: boolean;
};

export type FormulaEvidence = { formula: string; cachedResult: CanonicalJsonValue | null };
export type MergedCellEvidence = { range: string; inference: "NONE" | "INFERRED_FROM_MERGED_CELL" };
export type PreviewCellValue = {
  rawValue: CanonicalJsonValue;
  normalizedStructuralValue: CanonicalJsonValue;
  formula: FormulaEvidence | null;
  mergedCell: MergedCellEvidence | null;
};

export type PreviewRowClassification =
  | "DATA"
  | "BLANK"
  | "HEADER"
  | "SUBHEADER"
  | "FOOTER"
  | "MALFORMED"
  | "IGNORED";

export type CatalogRecordPreview = {
  sheetName: string;
  rowNumber: number;
  classification: PreviewRowClassification;
  sourceLocator: SourceLocator;
  rawValues: Readonly<Record<string, PreviewCellValue>>;
  candidateProductIdentity: Readonly<Record<string, CanonicalJsonValue>>;
  candidateAttributeValues: Readonly<Record<string, CanonicalJsonValue>>;
  candidateMediaReferences: readonly string[];
  candidateDocumentReferences: readonly string[];
  diagnostics: readonly PreviewDiagnostic[];
};

export type CatalogStructureClassification =
  | "SINGLE_PRODUCT"
  | "MULTIPLE_PRODUCTS"
  | "PRODUCT_WITH_VARIANTS"
  | "AMBIGUOUS_STRUCTURE";

export type CatalogStructureInference = {
  classification: CatalogStructureClassification;
  confidence: MappingConfidence;
  reasons: readonly string[];
  reviewRequired: boolean;
  candidateProductCount: number;
  candidateVariantCount: number;
};

export type CatalogSheetInspection = {
  sheetName: string;
  sheetIndex: number;
  usedRange: string | null;
  rowCount: number;
  columnCount: number;
  nonEmptyRowCount: number;
  structuralCellCount: number;
  nonEmptyCellCount: number;
  formulaCellCount: number;
  hyperlinkCount: number;
  mergedRanges: readonly string[];
  headerSelection: HeaderSelection;
  columnMappings: readonly ColumnMappingSuggestion[];
  attributeCandidates: readonly AttributeMappingCandidate[];
  recordPreviews: readonly CatalogRecordPreview[];
  diagnostics: readonly PreviewDiagnostic[];
};

export type CatalogImportPreviewCounts = {
  sheetCount: number;
  rawRowCount: number;
  candidateDataRowCount: number;
  blankRowCount: number;
  ignoredRowCount: number;
  malformedRowCount: number;
  mappedColumnCount: number;
  unmappedColumnCount: number;
  ambiguousMappingCount: number;
  candidateProductCount: number;
  candidateVariantCount: number;
  attributeCandidateCount: number;
  structuralCellCount: number;
  nonEmptyCellCount: number;
  formulaCellCount: number;
  mergedRangeCount: number;
  hyperlinkCount: number;
  embeddedImageCount: number;
};

export type CatalogImportPreview = {
  previewId: string;
  semanticFingerprint: string;
  importId: string;
  sourceId: string;
  fileName: string;
  fileType: CatalogImportFileType;
  contentHash: string;
  sheets: readonly CatalogSheetInspection[];
  selectedSheets: readonly string[];
  headerSelections: Readonly<Record<string, HeaderSelection>>;
  columnMappings: readonly ColumnMappingSuggestion[];
  attributeCandidates: readonly AttributeMappingCandidate[];
  structureInference: CatalogStructureInference;
  recordPreviews: readonly CatalogRecordPreview[];
  diagnostics: readonly PreviewDiagnostic[];
  counts: CatalogImportPreviewCounts;
  status: "READY_FOR_REVIEW" | "BLOCKED";
  createdAt: string;
};

export type CatalogImportMappingOverrides = Readonly<Record<string, CatalogMappingTarget>>;