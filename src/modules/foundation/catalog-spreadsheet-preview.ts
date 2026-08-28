import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";
import {
  getCatalogSourceMappingProfile,
  type CatalogSourceMappingProfile,
} from "./catalog-source-mapping-profile";
import {
  CATALOG_IMPORT_LIMITS,
  type AttributeMappingCandidate,
  type CatalogImportFileType,
  type CatalogImportInput,
  type CatalogImportMappingOverrides,
  type CatalogImportPreview,
  type CatalogMappingTarget,
  type CatalogRecordPreview,
  type CatalogSheetInspection,
  type CatalogStructureInference,
  type ColumnMappingSuggestion,
  type HeaderCandidate,
  type HeaderColumn,
  type HeaderSelection,
  type MappingConfidence,
  type PreviewCellValue,
  type PreviewDiagnostic,
  type UnitObservation,
} from "./catalog-import-preview";

type ParsedCell = PreviewCellValue & { text: string };
type ParsedSheet = {
  name: string;
  index: number;
  rows: ParsedCell[][];
  mergedRanges: string[];
  structuralCellCount: number;
  nonEmptyCellCount: number;
  formulaCellCount: number;
  hyperlinkCount: number;
};

export type WorkbookComplexity = {
  sheetCount: number;
  rowsPerSheet: readonly { sheetName: string; rowCount: number; columnCount: number }[];
  totalStructuralCells: number;
  totalNonEmptyCells: number;
  totalFormulaCells: number;
  totalMergedRanges: number;
  totalHyperlinks: number;
};

const CORE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  PRODUCT_ID: ["product id", "productid"],
  SKU: ["sku", "product sku", "part number", "part no"],
  MODEL_NUMBER: ["model", "model number", "model no"],
  PRODUCT_NAME: ["product", "product name", "item name", "item"],
  PRODUCT_FAMILY: ["product family", "family"],
  MANUFACTURER: ["manufacturer", "maker"],
  CATEGORY: ["category", "product category"],
  DESCRIPTION: ["description", "full description"],
  SHORT_DESCRIPTION: ["short description", "summary"],
  STATUS: ["status", "product status"],
  SLUG: ["slug", "product slug"],
  SITE: ["site", "website"],
  VARIANT_KEY_SOURCE: ["variant", "variant key", "option"],
  MEDIA_REFERENCE: ["image", "image url", "media", "video url"],
  DOCUMENT_REFERENCE: ["document", "document url", "spec sheet", "manual"],
};

const UNIT_PATTERN = /(?:^|\s|\()((?:mm|in|ft|nits|cd\/m2|w|v|hz)|")\)?\s*$/i;

function columnLetter(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function normalizeCatalogHeader(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_#/-]+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function confidenceForScore(score: number): MappingConfidence {
  if (score >= 0.9) return "EXACT";
  if (score >= 0.72) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

function isFormula(value: ExcelJS.CellValue): value is ExcelJS.CellFormulaValue {
  return Boolean(value && typeof value === "object" && "formula" in value);
}

function isHyperlink(value: ExcelJS.CellValue): value is ExcelJS.CellHyperlinkValue {
  return Boolean(value && typeof value === "object" && "hyperlink" in value);
}

function scalar(value: unknown): CanonicalJsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text);
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((entry) => entry.text).join("");
  }
  return String(value);
}

function parsedCell(cell: ExcelJS.Cell, mergedRanges: readonly string[]): ParsedCell {
  const value = cell.value;
  const formula = isFormula(value)
    ? { formula: value.formula, cachedResult: scalar(value.result) }
    : null;
  const rawValue = formula ? formula.cachedResult : scalar(value);
  const text = rawValue === null ? "" : String(rawValue);
  const mergedRange = mergedRanges.find((range) => cell.isMerged && range.includes(cell.master.address)) ?? null;
  return {
    rawValue,
    normalizedStructuralValue: typeof rawValue === "string" ? rawValue.trim() : rawValue,
    formula,
    mergedCell: mergedRange ? {
      range: mergedRange,
      masterCell: cell.master.address,
      inference: cell.address === cell.master.address ? "NONE" : "INFERRED_FROM_MERGED_CELL",
    } : null,
    text,
  };
}

function validateFileType(input: CatalogImportInput): CatalogImportFileType {
  const lowerName = input.fileName.toLowerCase();
  const xlsx = lowerName.endsWith(".xlsx")
    && input.mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    && input.buffer.subarray(0, 2).toString("binary") === "PK";
  const csv = lowerName.endsWith(".csv")
    && (input.mediaType === "text/csv" || input.mediaType === "text/plain")
    && input.buffer.subarray(0, 2).toString("binary") !== "PK";
  if (xlsx) return "XLSX";
  if (csv) return "CSV";
  throw new CatalogPreviewError("UNSUPPORTED_FILE_TYPE", "Only matching .xlsx and comma-delimited CSV inputs are supported.");
}

export class CatalogPreviewError extends Error {
  constructor(readonly code: PreviewDiagnostic["code"], message: string) {
    super(message);
    this.name = "CatalogPreviewError";
  }
}

async function parseInput(input: CatalogImportInput, fileType: CatalogImportFileType): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (fileType === "XLSX") {
      await workbook.xlsx.load(input.buffer, {
        ignoreNodes: ["dataValidations", "extLst", "picture", "drawing", "sheetProtection"],
      });
    } else {
      if (countCsvRecords(input.buffer.toString("utf8")) > CATALOG_IMPORT_LIMITS.maximumRowsPerSheet) {
        throw new CatalogPreviewError("ROW_LIMIT_EXCEEDED", "CSV exceeds the configured row limit.");
      }
      await workbook.csv.read(Readable.from(input.buffer), {
        parserOptions: {
          delimiter: ",",
          quote: '"',
          escape: '"',
          headers: false,
          ignoreEmpty: false,
          strictColumnHandling: true,
          discardUnmappedColumns: false,
          trim: false,
          maxRows: CATALOG_IMPORT_LIMITS.maximumRowsPerSheet + 1,
        },
      });
    }
  } catch (error) {
    if (error instanceof CatalogPreviewError) throw error;
    throw new CatalogPreviewError("PARSER_ERROR", `Unable to parse source: ${(error as Error).message}`);
  }
  const rowsPerSheet = workbook.worksheets.map((worksheet) => ({
    sheetName: worksheet.name,
    rowCount: worksheet.rowCount,
    columnCount: worksheet.columnCount,
  }));
  const totalStructuralCells = rowsPerSheet.reduce(
    (total, sheet) => total + sheet.rowCount * sheet.columnCount,
    0,
  );
  const totalMergedRanges = workbook.worksheets.reduce(
    (total, worksheet) => total + ((worksheet.model as { merges?: string[] }).merges?.length ?? 0),
    0,
  );
  validateWorkbookComplexity({
    sheetCount: workbook.worksheets.length,
    rowsPerSheet,
    totalStructuralCells,
    totalNonEmptyCells: 0,
    totalFormulaCells: 0,
    totalMergedRanges,
    totalHyperlinks: 0,
  });

  let runningNonEmptyCells = 0;
  let runningFormulaCells = 0;
  let runningHyperlinks = 0;
  return workbook.worksheets.map((worksheet, sheetOffset) => {
    const mergedRanges = [...((worksheet.model as { merges?: string[] }).merges ?? [])].sort();
    const rows: ParsedCell[][] = [];
    let nonEmptyCellCount = 0;
    let formulaCellCount = 0;
    let hyperlinkCount = 0;
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row: ParsedCell[] = [];
      for (let column = 1; column <= worksheet.columnCount; column += 1) {
        const cell = worksheet.getCell(rowNumber, column);
        const value = parsedCell(cell, mergedRanges);
        if (value.text.trim()) nonEmptyCellCount += 1;
        if (value.formula) formulaCellCount += 1;
        if (isHyperlink(cell.value)) hyperlinkCount += 1;
        if (value.text.length > CATALOG_IMPORT_LIMITS.maximumCellTextLength) {
          throw new CatalogPreviewError("CELL_TEXT_LIMIT_EXCEEDED", `Cell ${worksheet.name}!${columnLetter(column)}${rowNumber} exceeds the text limit.`);
        }
        row.push(value);
      }
      rows.push(row);
    }
    runningNonEmptyCells += nonEmptyCellCount;
    runningFormulaCells += formulaCellCount;
    runningHyperlinks += hyperlinkCount;
    validateWorkbookComplexity({
      sheetCount: workbook.worksheets.length,
      rowsPerSheet,
      totalStructuralCells,
      totalNonEmptyCells: runningNonEmptyCells,
      totalFormulaCells: runningFormulaCells,
      totalMergedRanges,
      totalHyperlinks: runningHyperlinks,
    });
    return {
      name: worksheet.name || (fileType === "CSV" ? "CSV" : `Sheet${sheetOffset + 1}`),
      index: sheetOffset,
      rows,
      mergedRanges,
      structuralCellCount: worksheet.rowCount * worksheet.columnCount,
      nonEmptyCellCount,
      formulaCellCount,
      hyperlinkCount,
    };
  });
}

function headerSemanticMatches(value: string): number {
  return Object.values(CORE_ALIASES).filter((aliases) => aliases.includes(value)).length;
}

export function detectHeader(rows: readonly ParsedCell[][]): HeaderSelection {
  const candidates: HeaderCandidate[] = rows
    .slice(0, CATALOG_IMPORT_LIMITS.maximumHeaderScanRows)
    .map((row, index) => {
      const values = row.map((cell) => cell.text.trim()).filter(Boolean);
      const normalized = values.map(normalizeCatalogHeader);
      const density = row.length ? values.length / row.length : 0;
      const uniqueness = values.length ? new Set(normalized).size / values.length : 0;
      const semantics = normalized.reduce((count, value) => count + headerSemanticMatches(value), 0);
      const nextPopulation = rows[index + 1]?.filter((cell) => cell.text.trim()).length ?? 0;
      const score = Math.min(1, density * 0.3 + uniqueness * 0.2 + Math.min(semantics, 3) * 0.15 + (nextPopulation > 0 ? 0.05 : 0));
      return {
        rowNumber: index + 1,
        confidence: confidenceForScore(score),
        score: Number(score.toFixed(4)),
        reasons: [`non-empty density ${density.toFixed(2)}`, `${semantics} known semantic headers`, `${new Set(normalized).size} unique headers`],
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.rowNumber - right.rowNumber);
  const selected = candidates[0];
  const selectedRow = selected ? rows[selected.rowNumber - 1] : null;
  const rawColumns = selectedRow
    ? selectedRow.map((cell, index) => ({ sourceHeader: cell.text, normalizedHeader: normalizeCatalogHeader(cell.text), columnIndex: index + 1, columnLetter: columnLetter(index + 1) })).filter((column) => column.sourceHeader.trim())
    : [];
  const normalizedCounts = new Map<string, number>();
  rawColumns.forEach((column) => normalizedCounts.set(column.normalizedHeader, (normalizedCounts.get(column.normalizedHeader) ?? 0) + 1));
  const columns: HeaderColumn[] = rawColumns.map((column) => ({
    ...column,
    sourceValueKey: (normalizedCounts.get(column.normalizedHeader) ?? 0) > 1
      ? `${column.sourceHeader} [${column.columnLetter}]`
      : column.sourceHeader,
  }));
  const reviewRequired = !selected || selected.confidence === "LOW" || selected.confidence === "NONE" || selected.confidence === "MEDIUM";
  return {
    selectedHeaderRow: selected?.rowNumber ?? null,
    confidence: selected?.confidence ?? "NONE",
    candidateHeaderRows: candidates,
    reasons: selected?.reasons ?? ["No defensible header candidate found."],
    reviewRequired,
    columns,
  };
}

function suggestMapping(column: HeaderColumn, override?: CatalogMappingTarget): ColumnMappingSuggestion {
  if (override) return { sourceColumn: column, suggestedTarget: override, confidence: "EXACT", reason: "Explicit preview mapping override.", alternatives: [], reviewRequired: false };
  if (column.normalizedHeader === "name") {
    return {
      sourceColumn: column,
      suggestedTarget: "PRODUCT_NAME",
      confidence: "LOW",
      reason: "Generic name may describe a product, manufacturer, category, or another entity.",
      alternatives: ["MANUFACTURER", "CATEGORY", "UNMAPPED"],
      reviewRequired: true,
    };
  }
  const matches = Object.entries(CORE_ALIASES).filter(([, aliases]) => aliases.includes(column.normalizedHeader)).map(([target]) => target as CatalogMappingTarget);
  if (matches.length === 1) return { sourceColumn: column, suggestedTarget: matches[0], confidence: "EXACT", reason: "Exact normalized header alias.", alternatives: [], reviewRequired: false };
  if (matches.length > 1) return { sourceColumn: column, suggestedTarget: matches[0], confidence: "LOW", reason: "Header matches multiple targets.", alternatives: matches.slice(1), reviewRequired: true };
  const attributeLike = Boolean(column.normalizedHeader) && !/^(notes?|comments?|unnamed)$/.test(column.normalizedHeader);
  return { sourceColumn: column, suggestedTarget: attributeLike ? "ATTRIBUTE" : "UNMAPPED", confidence: attributeLike ? "MEDIUM" : "NONE", reason: attributeLike ? "Non-core column is a candidate attribute." : "No safe mapping alias found.", alternatives: attributeLike ? ["UNMAPPED", "IGNORE"] : ["IGNORE"], reviewRequired: true };
}

function inferType(values: readonly string[]): { type: AttributeMappingCandidate["observedDataType"]; mixed: boolean } {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
  const kinds = new Set(nonEmpty.map((value) => {
    if (/^(true|false|yes|no)$/i.test(value)) return "BOOLEAN";
    if (/^-?\d+$/.test(value)) return "INTEGER";
    if (/^-?\d+(?:\.\d+)?\s*(?:mm|in|ft|nits|cd\/m2|w|v|hz|")$/i.test(value)) return "DIMENSION";
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return "NUMBER";
    return "STRING";
  }));
  if (kinds.size === 1) return { type: [...kinds][0] as AttributeMappingCandidate["observedDataType"], mixed: false };
  return { type: "STRING", mixed: kinds.size > 1 };
}

function observedUnits(header: HeaderColumn, values: readonly string[]): UnitObservation[] {
  const observations = new Set<string>();
  const headerMatch = header.sourceHeader.match(/\(([^)]+)\)/);
  if (headerMatch) observations.add(headerMatch[1]);
  values.forEach((value) => {
    const match = value.match(UNIT_PATTERN);
    if (match) observations.add(match[1]);
  });
  return [...observations].sort().map((unit) => ({ rawUnit: unit, candidateCanonicalUnit: unit.toLowerCase(), confidence: "HIGH" }));
}

function isSensitiveHeader(header: string): boolean {
  return /^(password|secret|api key|token|authorization|connection string)$/i.test(normalizeCatalogHeader(header));
}

function inspectSheet(
  sheet: ParsedSheet,
  overrides: CatalogImportMappingOverrides,
  sourceProfile: CatalogSourceMappingProfile | null,
): CatalogSheetInspection {
  const diagnostics: PreviewDiagnostic[] = [];
  const headerSelection = detectHeader(sheet.rows);
  if (!headerSelection.selectedHeaderRow) diagnostics.push({ code: "HEADER_NOT_FOUND", severity: "BLOCKING", message: "No defensible header row was found.", sourceLocator: { sheet: sheet.name } });
  else if (headerSelection.reviewRequired) diagnostics.push({ code: "HEADER_REVIEW_REQUIRED", severity: "WARNING", message: "The selected header row requires operator review.", sourceLocator: { sheet: sheet.name, row: headerSelection.selectedHeaderRow } });
  const duplicateHeaders = headerSelection.columns.filter((column, index, all) => all.findIndex((candidate) => candidate.normalizedHeader === column.normalizedHeader) !== index);
  duplicateHeaders.forEach((column) => diagnostics.push({ code: "DUPLICATE_HEADER", severity: "WARNING", message: `Duplicate header: ${column.sourceHeader}`, sourceLocator: { sheet: sheet.name, row: headerSelection.selectedHeaderRow ?? undefined, column: column.columnLetter } }));
  headerSelection.columns.filter((column) => isSensitiveHeader(column.sourceHeader)).forEach((column) => diagnostics.push({ code: "SENSITIVE_VALUE_REJECTED", severity: "BLOCKING", message: `Credential-like column is not permitted: ${column.sourceHeader}`, sourceLocator: { sheet: sheet.name, column: column.columnLetter } }));
  const mappings = headerSelection.columns.map((column) => suggestMapping(
    column,
    overrides[`${sheet.name}:${column.normalizedHeader}`]
      ?? overrides[column.normalizedHeader]
      ?? sourceProfile?.columnMappings[column.normalizedHeader],
  ));
  mappings.filter((mapping) => mapping.suggestedTarget === "UNMAPPED").forEach((mapping) => diagnostics.push({ code: "UNMAPPED_COLUMN", severity: "WARNING", message: `Unmapped column: ${mapping.sourceColumn.sourceHeader}` }));
  mappings.filter((mapping) => mapping.confidence === "LOW" && mapping.alternatives.length > 0).forEach((mapping) => diagnostics.push({ code: "AMBIGUOUS_MAPPING", severity: "WARNING", message: `Ambiguous mapping: ${mapping.sourceColumn.sourceHeader}` }));
  const recordPreviews: CatalogRecordPreview[] = [];
  const headerRow = headerSelection.selectedHeaderRow ?? 0;
  sheet.rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawValues: Record<string, PreviewCellValue> = Object.create(null) as Record<string, PreviewCellValue>;
    headerSelection.columns.forEach((column) => { rawValues[column.sourceValueKey] = row[column.columnIndex - 1] ?? { rawValue: null, normalizedStructuralValue: null, formula: null, mergedCell: null }; });
    const values = Object.values(rawValues).map((value) => value.rawValue).filter((value) => value !== null && String(value).trim());
    let classification: CatalogRecordPreview["classification"] = "DATA";
    const classificationReasons: CatalogRecordPreview["classificationReasons"][number][] = [];
    const rowDiagnostics: PreviewDiagnostic[] = [];
    if (rowNumber === headerRow) {
      classification = "HEADER";
      classificationReasons.push("HEADER_ROW");
    } else if (!values.length) {
      classification = "BLANK";
      classificationReasons.push("BLANK_ROW");
    } else if (/^(notes?|specifications?|features?|variants?|applications?|standard sizes?)[:]?$/i.test(String(values[0]))
      && new Set(values.map(String)).size === 1) {
      classification = "SUBHEADER";
      classificationReasons.push("SUBHEADER_ROW");
    } else if (/^(total|end|footer|disclaimer)\b/i.test(String(values[0]))) {
      classification = "FOOTER";
      classificationReasons.push("FOOTER_ROW");
    }
    const candidateProductIdentity: Record<string, CanonicalJsonValue> = {};
    const candidateAttributeValues: Record<string, CanonicalJsonValue> = {};
    const candidateSourceMetadata: Record<string, CanonicalJsonValue> = {};
    const candidateCommercialFields: Record<string, CanonicalJsonValue> = {};
    const candidateLogisticsFields: Record<string, CanonicalJsonValue> = {};
    const candidateTaxFields: Record<string, CanonicalJsonValue> = {};
    const candidateMediaReferences: string[] = [];
    const candidateDocumentReferences: string[] = [];
    mappings.forEach((mapping) => {
      const cell = row[mapping.sourceColumn.columnIndex - 1];
      if (!cell || cell.rawValue === null) return;
      if (mapping.suggestedTarget === "ATTRIBUTE") candidateAttributeValues[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "SOURCE_METADATA") candidateSourceMetadata[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "COMMERCIAL_PRICING_FIELD") candidateCommercialFields[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "LOGISTICS_FIELD") candidateLogisticsFields[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "TAX_FIELD") candidateTaxFields[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "MEDIA_REFERENCE") candidateMediaReferences.push(String(cell.rawValue));
      else if (mapping.suggestedTarget === "DOCUMENT_REFERENCE") candidateDocumentReferences.push(String(cell.rawValue));
      else if (!["UNMAPPED", "IGNORE", "MEDIA_REFERENCE", "DOCUMENT_REFERENCE"].includes(mapping.suggestedTarget)) candidateProductIdentity[mapping.suggestedTarget] = cell.rawValue;
      if (cell.formula) rowDiagnostics.push({ code: "FORMULA_VALUE_PRESENT", severity: "INFO", message: "Formula metadata and cached value were preserved; no formula was executed.", sourceLocator: { sheet: sheet.name, row: rowNumber, column: mapping.sourceColumn.columnLetter } });
      if (cell.mergedCell?.inference === "INFERRED_FROM_MERGED_CELL") rowDiagnostics.push({ code: "INFERRED_FROM_MERGED_CELL", severity: "WARNING", message: "Value was inferred from a merged-cell master and requires identity review.", sourceLocator: { sheet: sheet.name, row: rowNumber, column: mapping.sourceColumn.columnLetter, cellRange: cell.mergedCell.range } });
    });
    if (classification === "DATA") {
      const hasIdentity = Boolean(
        candidateProductIdentity.SKU
        || candidateProductIdentity.PRODUCT_NAME
        || candidateProductIdentity.MODEL_NUMBER,
      );
      const narrativeText = values.map(String).join("\n");
      const hasNarrative = /category overview|standard sizes|applications?:|features?:/i.test(narrativeText)
        || (narrativeText.length > 240 && /designed|ideal for|suitable for/i.test(narrativeText));
      const identityTargets: CatalogMappingTarget[] = ["SKU", "PRODUCT_NAME", "MODEL_NUMBER"];
      const identityCells = mappings
        .filter((mapping) => identityTargets.includes(mapping.suggestedTarget))
        .map((mapping) => row[mapping.sourceColumn.columnIndex - 1])
        .filter((cell) => cell && cell.rawValue !== null && String(cell.rawValue).trim());
      const mergedIdentityCells = identityCells.filter((cell) => cell.mergedCell !== null);
      const independentIdentityCells = identityCells.filter((cell) => cell.mergedCell === null);
      const strongMergedNarrative = rowNumber < headerRow
        && hasNarrative
        && mergedIdentityCells.length >= 2
        && independentIdentityCells.length === 0
        && new Set(mergedIdentityCells.map((cell) => cell.mergedCell?.masterCell)).size === 1;
      const hasTechnicalIntent = Object.keys(candidateAttributeValues).length > 0
        || Boolean(candidateProductIdentity.DESCRIPTION)
        || candidateMediaReferences.length > 0
        || candidateDocumentReferences.length > 0;
      const hasCommercial = Object.keys(candidateCommercialFields).length > 0
        || Object.keys(candidateLogisticsFields).length > 0
        || Object.keys(candidateTaxFields).length > 0;
      const formulaOnly = Object.values(rawValues)
        .filter((cell) => cell.rawValue !== null && String(cell.rawValue).trim())
        .every((cell) => cell.formula !== null);

      if (strongMergedNarrative) {
        classification = "NARRATIVE";
        classificationReasons.push("CATEGORY_NARRATIVE");
      } else if (hasIdentity) {
        classificationReasons.push("PRODUCT_IDENTITY_PRESENT");
      } else if (hasNarrative) {
        classification = "NARRATIVE";
        classificationReasons.push("CATEGORY_NARRATIVE");
      } else if (hasCommercial && !hasTechnicalIntent) {
        classification = "PRICING_FILLER";
        classificationReasons.push(formulaOnly ? "FORMULA_TAIL" : "PRICING_ONLY_FILLER");
      } else if (Object.keys(candidateSourceMetadata).length > 0 && !hasTechnicalIntent) {
        classification = "NOTES";
        classificationReasons.push("NOTES_ONLY");
      } else if (!hasTechnicalIntent) {
        classification = "STRUCTURAL_FILLER";
        classificationReasons.push("STRUCTURAL_FILLER");
      } else {
        classification = "MALFORMED";
        classificationReasons.push("MISSING_REQUIRED_IDENTITY");
        rowDiagnostics.push({ code: "MALFORMED_ROW", severity: "ERROR", message: "Product-like row has technical or descriptive evidence but no usable product identity.", sourceLocator: { sheet: sheet.name, row: rowNumber } });
      }
    }
    recordPreviews.push({ sheetName: sheet.name, rowNumber, classification, classificationReasons, sourceLocator: { sheet: sheet.name, row: rowNumber, cellRange: `A${rowNumber}:${columnLetter(sheet.rows[0]?.length ?? 1)}${rowNumber}` }, rawValues, candidateProductIdentity, candidateAttributeValues, candidateSourceMetadata, candidateCommercialFields, candidateLogisticsFields, candidateTaxFields, candidateMediaReferences, candidateDocumentReferences, diagnostics: rowDiagnostics });
  });
  const dataRows = recordPreviews.filter((row) => row.classification === "DATA");
  const attributeCandidates = mappings.filter((mapping) => mapping.suggestedTarget === "ATTRIBUTE").map((mapping) => {
    const samples = dataRows.map((row) => row.rawValues[mapping.sourceColumn.sourceValueKey]?.rawValue).filter((value): value is Exclude<CanonicalJsonValue, null> => value !== null && value !== undefined).map(String).slice(0, 10);
    const inference = inferType(samples);
    const units = observedUnits(mapping.sourceColumn, samples);
    if (inference.mixed) diagnostics.push({ code: "MIXED_DATA_TYPES", severity: "WARNING", message: `Mixed data types observed for ${mapping.sourceColumn.sourceHeader}.` });
    if (units.length > 1) diagnostics.push({ code: "UNIT_REVIEW_REQUIRED", severity: "WARNING", message: `Multiple units observed for ${mapping.sourceColumn.sourceHeader}.` });
    return { sourceHeader: mapping.sourceColumn.sourceHeader, suggestedKey: mapping.sourceColumn.normalizedHeader.replace(/\s+/g, "-"), observedDataType: inference.type, observedUnits: units, sampleValues: samples, confidence: mapping.confidence, reviewRequired: mapping.reviewRequired || inference.mixed || units.length > 1 };
  });
  return { sheetName: sheet.name, sheetIndex: sheet.index, usedRange: sheet.rows.length && sheet.rows[0]?.length ? `A1:${columnLetter(sheet.rows[0].length)}${sheet.rows.length}` : null, rowCount: sheet.rows.length, columnCount: sheet.rows[0]?.length ?? 0, nonEmptyRowCount: sheet.rows.filter((row) => row.some((cell) => cell.text.trim())).length, structuralCellCount: sheet.structuralCellCount, nonEmptyCellCount: sheet.nonEmptyCellCount, formulaCellCount: sheet.formulaCellCount, hyperlinkCount: sheet.hyperlinkCount, mergedRanges: sheet.mergedRanges, headerSelection, columnMappings: mappings, attributeCandidates, recordPreviews, diagnostics };
}

function inferStructure(rows: readonly CatalogRecordPreview[]): CatalogStructureInference {
  const data = rows.filter((row) => row.classification === "DATA");
  const names = data.map((row) => String(row.candidateProductIdentity.PRODUCT_NAME ?? row.candidateProductIdentity.MODEL_NUMBER ?? "")).filter(Boolean);
  const skus = data.map((row) => String(row.candidateProductIdentity.SKU ?? "")).filter(Boolean);
  const uniqueNames = new Set(names.map((value) => value.trim().toLowerCase()));
  const uniqueSkus = new Set(skus.map((value) => value.trim().toLowerCase()));
  if (!data.length || (!names.length && !skus.length)) return { classification: "AMBIGUOUS_STRUCTURE", confidence: "NONE", reasons: ["No defensible product identity values."], reviewRequired: true, candidateProductCount: 0, candidateVariantCount: 0 };
  if (uniqueNames.size === 1 && uniqueSkus.size > 1) return { classification: "PRODUCT_WITH_VARIANTS", confidence: "HIGH", reasons: ["One repeated product identity has multiple distinct SKUs."], reviewRequired: true, candidateProductCount: 1, candidateVariantCount: uniqueSkus.size };
  if (uniqueNames.size > 1 || uniqueSkus.size > 1) return { classification: "MULTIPLE_PRODUCTS", confidence: "HIGH", reasons: ["Multiple distinct product identities were observed."], reviewRequired: false, candidateProductCount: Math.max(uniqueNames.size, uniqueSkus.size), candidateVariantCount: 0 };
  return { classification: "SINGLE_PRODUCT", confidence: "HIGH", reasons: ["One product identity was observed."], reviewRequired: false, candidateProductCount: 1, candidateVariantCount: 0 };
}

function semanticPreview(input: Omit<CatalogImportPreview, "previewId" | "semanticFingerprint" | "createdAt">): unknown {
  return input;
}

export async function createCatalogImportPreview(input: CatalogImportInput, mappingOverrides: CatalogImportMappingOverrides = {}): Promise<CatalogImportPreview> {
  const fileType = validateFileType(input);
  validateCatalogImportTransportSize(fileType, input.buffer.length);
  const contentHash = createCanonicalContentHash(input.buffer.toString("base64"));
  const parsedSheets = await parseInput(input, fileType);
  if (!parsedSheets.length) throw new CatalogPreviewError("PARSER_ERROR", "No usable sheet was found.");
  const sourceProfile = getCatalogSourceMappingProfile(input.mappingProfileId);
  const sheets = parsedSheets.map((sheet) => inspectSheet(sheet, mappingOverrides, sourceProfile));
  const recordPreviews = sheets.flatMap((sheet) => sheet.recordPreviews);
  const columnMappings = sheets.flatMap((sheet) => sheet.columnMappings);
  const attributeCandidates = sheets.flatMap((sheet) => sheet.attributeCandidates);
  const structureInference = inferStructure(recordPreviews);
  const diagnostics = [
    ...sheets.flatMap((sheet) => sheet.diagnostics),
    ...recordPreviews.flatMap((row) => row.diagnostics),
  ];
  if (structureInference.reviewRequired) diagnostics.push({
    code: "STRUCTURE_REVIEW_REQUIRED",
    severity: structureInference.confidence === "NONE" ? "BLOCKING" : "WARNING",
    message: structureInference.reasons.join(" "),
  });
  const counts = {
    sheetCount: sheets.length,
    rawRowCount: recordPreviews.length,
    candidateDataRowCount: recordPreviews.filter((row) => row.classification === "DATA").length,
    blankRowCount: recordPreviews.filter((row) => row.classification === "BLANK").length,
    ignoredRowCount: recordPreviews.filter((row) => ["HEADER", "SUBHEADER", "FOOTER", "IGNORED"].includes(row.classification)).length,
    malformedRowCount: recordPreviews.filter((row) => row.classification === "MALFORMED").length,
    pricingFillerRowCount: recordPreviews.filter((row) => row.classification === "PRICING_FILLER").length,
    structuralFillerRowCount: recordPreviews.filter((row) => row.classification === "STRUCTURAL_FILLER").length,
    narrativeRowCount: recordPreviews.filter((row) => row.classification === "NARRATIVE").length,
    subheaderRowCount: recordPreviews.filter((row) => row.classification === "SUBHEADER").length,
    notesRowCount: recordPreviews.filter((row) => row.classification === "NOTES").length,
    mappedColumnCount: columnMappings.filter((mapping) => !["UNMAPPED", "IGNORE"].includes(mapping.suggestedTarget)).length,
    unmappedColumnCount: columnMappings.filter((mapping) => mapping.suggestedTarget === "UNMAPPED").length,
    ambiguousMappingCount: columnMappings.filter((mapping) => mapping.reviewRequired).length,
    candidateProductCount: structureInference.candidateProductCount,
    candidateVariantCount: structureInference.candidateVariantCount,
    attributeCandidateCount: attributeCandidates.length,
    structuralCellCount: sheets.reduce((total, sheet) => total + sheet.structuralCellCount, 0),
    nonEmptyCellCount: sheets.reduce((total, sheet) => total + sheet.nonEmptyCellCount, 0),
    formulaCellCount: sheets.reduce((total, sheet) => total + sheet.formulaCellCount, 0),
    mergedRangeCount: sheets.reduce((total, sheet) => total + sheet.mergedRanges.length, 0),
    hyperlinkCount: sheets.reduce((total, sheet) => total + sheet.hyperlinkCount, 0),
    embeddedImageCount: 0,
  };
  const base = { importId: input.importId, sourceId: input.sourceId, fileName: input.fileName, fileType, contentHash, sheets, selectedSheets: sheets.filter((sheet) => sheet.headerSelection.selectedHeaderRow !== null).map((sheet) => sheet.sheetName), headerSelections: Object.fromEntries(sheets.map((sheet) => [sheet.sheetName, sheet.headerSelection])), columnMappings, attributeCandidates, structureInference, recordPreviews, diagnostics, counts, status: diagnostics.some((diagnostic) => diagnostic.severity === "BLOCKING") ? "BLOCKED" as const : "READY_FOR_REVIEW" as const };
  const semanticFingerprint = createCanonicalContentHash(semanticPreview(base));
  return { ...base, previewId: `catalog-preview-${semanticFingerprint.slice(0, 24)}`, semanticFingerprint, createdAt: new Date().toISOString() };
}

function countCsvRecords(content: string): number {
  if (!content.length) return 0;
  let records = 1;
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (character === "\n" && !quoted) {
      records += 1;
    }
  }
  return records;
}

export function validateCatalogImportTransportSize(
  fileType: CatalogImportFileType,
  byteLength: number,
): void {
  const maximum = fileType === "XLSX"
    ? CATALOG_IMPORT_LIMITS.maximumXlsxFileSizeBytes
    : CATALOG_IMPORT_LIMITS.maximumCsvFileSizeBytes;
  if (byteLength > maximum) {
    throw new CatalogPreviewError("FILE_TOO_LARGE", `${fileType} input exceeds the configured file-size limit.`);
  }
}

export function validateWorkbookComplexity(complexity: WorkbookComplexity): void {
  if (complexity.sheetCount > CATALOG_IMPORT_LIMITS.maximumSheets) {
    throw new CatalogPreviewError("SHEET_LIMIT_EXCEEDED", "Workbook exceeds the configured sheet limit.");
  }
  const oversizedRows = complexity.rowsPerSheet.find((sheet) =>
    sheet.rowCount > CATALOG_IMPORT_LIMITS.maximumRowsPerSheet);
  if (oversizedRows) {
    throw new CatalogPreviewError("ROW_LIMIT_EXCEEDED", `Sheet ${oversizedRows.sheetName} exceeds the row limit.`);
  }
  const oversizedColumns = complexity.rowsPerSheet.find((sheet) =>
    sheet.columnCount > CATALOG_IMPORT_LIMITS.maximumColumnsPerSheet);
  if (oversizedColumns) {
    throw new CatalogPreviewError("COLUMN_LIMIT_EXCEEDED", `Sheet ${oversizedColumns.sheetName} exceeds the column limit.`);
  }
  if (complexity.totalStructuralCells > CATALOG_IMPORT_LIMITS.maximumTotalStructuralCells) {
    throw new CatalogPreviewError("CELL_LIMIT_EXCEEDED", "Workbook exceeds the structural cell limit.");
  }
  if (complexity.totalNonEmptyCells > CATALOG_IMPORT_LIMITS.maximumTotalNonEmptyCells) {
    throw new CatalogPreviewError("NON_EMPTY_CELL_LIMIT_EXCEEDED", "Workbook exceeds the non-empty cell limit.");
  }
  if (complexity.totalFormulaCells > CATALOG_IMPORT_LIMITS.maximumFormulaCells) {
    throw new CatalogPreviewError("FORMULA_LIMIT_EXCEEDED", "Workbook exceeds the formula cell limit.");
  }
  if (complexity.totalMergedRanges > CATALOG_IMPORT_LIMITS.maximumMergedRanges) {
    throw new CatalogPreviewError("MERGED_RANGE_LIMIT_EXCEEDED", "Workbook exceeds the merged-range limit.");
  }
  if (complexity.totalHyperlinks > CATALOG_IMPORT_LIMITS.maximumHyperlinks) {
    throw new CatalogPreviewError("HYPERLINK_LIMIT_EXCEEDED", "Workbook exceeds the hyperlink limit.");
  }
}