import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { createCanonicalContentHash, type CanonicalJsonValue } from "./canonical-content-hash";
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
type ParsedSheet = { name: string; index: number; rows: ParsedCell[][]; mergedRanges: string[] };

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
    mergedCell: mergedRange ? { range: mergedRange, inference: cell.address === cell.master.address ? "NONE" : "INFERRED_FROM_MERGED_CELL" } : null,
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
        ignoreNodes: ["dataValidations", "extLst", "hyperlinks", "picture", "drawing", "sheetProtection"],
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
  if (workbook.worksheets.length > CATALOG_IMPORT_LIMITS.maximumSheets) {
    throw new CatalogPreviewError("SHEET_LIMIT_EXCEEDED", "Workbook exceeds the configured sheet limit.");
  }
  let totalCells = 0;
  return workbook.worksheets.map((worksheet, sheetOffset) => {
    if (worksheet.rowCount > CATALOG_IMPORT_LIMITS.maximumRowsPerSheet) {
      throw new CatalogPreviewError("ROW_LIMIT_EXCEEDED", `Sheet ${worksheet.name} exceeds the row limit.`);
    }
    if (worksheet.columnCount > CATALOG_IMPORT_LIMITS.maximumColumnsPerSheet) {
      throw new CatalogPreviewError("COLUMN_LIMIT_EXCEEDED", `Sheet ${worksheet.name} exceeds the column limit.`);
    }
    totalCells += worksheet.rowCount * worksheet.columnCount;
    if (totalCells > CATALOG_IMPORT_LIMITS.maximumTotalCells) {
      throw new CatalogPreviewError("CELL_LIMIT_EXCEEDED", "Workbook exceeds the total cell limit.");
    }
    const mergedRanges = [...((worksheet.model as { merges?: string[] }).merges ?? [])].sort();
    const rows: ParsedCell[][] = [];
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row: ParsedCell[] = [];
      for (let column = 1; column <= worksheet.columnCount; column += 1) {
        const value = parsedCell(worksheet.getCell(rowNumber, column), mergedRanges);
        if (value.text.length > CATALOG_IMPORT_LIMITS.maximumCellTextLength) {
          throw new CatalogPreviewError("CELL_TEXT_LIMIT_EXCEEDED", `Cell ${worksheet.name}!${columnLetter(column)}${rowNumber} exceeds the text limit.`);
        }
        row.push(value);
      }
      rows.push(row);
    }
    return { name: worksheet.name || (fileType === "CSV" ? "CSV" : `Sheet${sheetOffset + 1}`), index: sheetOffset, rows, mergedRanges };
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

function inspectSheet(sheet: ParsedSheet, overrides: CatalogImportMappingOverrides): CatalogSheetInspection {
  const diagnostics: PreviewDiagnostic[] = [];
  const headerSelection = detectHeader(sheet.rows);
  if (!headerSelection.selectedHeaderRow) diagnostics.push({ code: "HEADER_NOT_FOUND", severity: "BLOCKING", message: "No defensible header row was found.", sourceLocator: { sheet: sheet.name } });
  else if (headerSelection.reviewRequired) diagnostics.push({ code: "HEADER_REVIEW_REQUIRED", severity: "WARNING", message: "The selected header row requires operator review.", sourceLocator: { sheet: sheet.name, row: headerSelection.selectedHeaderRow } });
  const duplicateHeaders = headerSelection.columns.filter((column, index, all) => all.findIndex((candidate) => candidate.normalizedHeader === column.normalizedHeader) !== index);
  duplicateHeaders.forEach((column) => diagnostics.push({ code: "DUPLICATE_HEADER", severity: "WARNING", message: `Duplicate header: ${column.sourceHeader}`, sourceLocator: { sheet: sheet.name, row: headerSelection.selectedHeaderRow ?? undefined, column: column.columnLetter } }));
  headerSelection.columns.filter((column) => isSensitiveHeader(column.sourceHeader)).forEach((column) => diagnostics.push({ code: "SENSITIVE_VALUE_REJECTED", severity: "BLOCKING", message: `Credential-like column is not permitted: ${column.sourceHeader}`, sourceLocator: { sheet: sheet.name, column: column.columnLetter } }));
  const mappings = headerSelection.columns.map((column) => suggestMapping(column, overrides[`${sheet.name}:${column.normalizedHeader}`] ?? overrides[column.normalizedHeader]));
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
    const rowDiagnostics: PreviewDiagnostic[] = [];
    if (rowNumber === headerRow) classification = "HEADER";
    else if (!values.length) classification = "BLANK";
    else if (/^(notes?|specifications?|features?|variants?)[:]?$/i.test(String(values[0])) && values.length === 1) classification = "SUBHEADER";
    else if (/^(total|end|footer|disclaimer)\b/i.test(String(values[0]))) classification = "FOOTER";
    const candidateProductIdentity: Record<string, CanonicalJsonValue> = {};
    const candidateAttributeValues: Record<string, CanonicalJsonValue> = {};
    const candidateMediaReferences: string[] = [];
    const candidateDocumentReferences: string[] = [];
    mappings.forEach((mapping) => {
      const cell = row[mapping.sourceColumn.columnIndex - 1];
      if (!cell || cell.rawValue === null) return;
      if (mapping.suggestedTarget === "ATTRIBUTE") candidateAttributeValues[mapping.sourceColumn.normalizedHeader] = cell.rawValue;
      else if (mapping.suggestedTarget === "MEDIA_REFERENCE") candidateMediaReferences.push(String(cell.rawValue));
      else if (mapping.suggestedTarget === "DOCUMENT_REFERENCE") candidateDocumentReferences.push(String(cell.rawValue));
      else if (!["UNMAPPED", "IGNORE", "MEDIA_REFERENCE", "DOCUMENT_REFERENCE"].includes(mapping.suggestedTarget)) candidateProductIdentity[mapping.suggestedTarget] = cell.rawValue;
      if (cell.formula) rowDiagnostics.push({ code: "FORMULA_VALUE_PRESENT", severity: "INFO", message: "Formula metadata and cached value were preserved; no formula was executed.", sourceLocator: { sheet: sheet.name, row: rowNumber, column: mapping.sourceColumn.columnLetter } });
      if (cell.mergedCell?.inference === "INFERRED_FROM_MERGED_CELL") rowDiagnostics.push({ code: "INFERRED_FROM_MERGED_CELL", severity: "WARNING", message: "Value was inferred from a merged-cell master and requires identity review.", sourceLocator: { sheet: sheet.name, row: rowNumber, column: mapping.sourceColumn.columnLetter, cellRange: cell.mergedCell.range } });
    });
    if (classification === "DATA" && !candidateProductIdentity.SKU && !candidateProductIdentity.PRODUCT_NAME && !candidateProductIdentity.MODEL_NUMBER) {
      classification = "MALFORMED";
      rowDiagnostics.push({ code: "MALFORMED_ROW", severity: "ERROR", message: "No candidate SKU, model, or product name is present.", sourceLocator: { sheet: sheet.name, row: rowNumber } });
    }
    recordPreviews.push({ sheetName: sheet.name, rowNumber, classification, sourceLocator: { sheet: sheet.name, row: rowNumber, cellRange: `A${rowNumber}:${columnLetter(sheet.rows[0]?.length ?? 1)}${rowNumber}` }, rawValues, candidateProductIdentity, candidateAttributeValues, candidateMediaReferences, candidateDocumentReferences, diagnostics: rowDiagnostics });
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
  return { sheetName: sheet.name, sheetIndex: sheet.index, usedRange: sheet.rows.length && sheet.rows[0]?.length ? `A1:${columnLetter(sheet.rows[0].length)}${sheet.rows.length}` : null, rowCount: sheet.rows.length, columnCount: sheet.rows[0]?.length ?? 0, nonEmptyRowCount: sheet.rows.filter((row) => row.some((cell) => cell.text.trim())).length, mergedRanges: sheet.mergedRanges, headerSelection, columnMappings: mappings, attributeCandidates, recordPreviews, diagnostics };
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
  if (input.buffer.length > CATALOG_IMPORT_LIMITS.maximumFileSizeBytes) throw new CatalogPreviewError("FILE_TOO_LARGE", "Input exceeds the configured file-size limit.");
  const fileType = validateFileType(input);
  const contentHash = createCanonicalContentHash(input.buffer.toString("base64"));
  const parsedSheets = await parseInput(input, fileType);
  if (!parsedSheets.length) throw new CatalogPreviewError("PARSER_ERROR", "No usable sheet was found.");
  const sheets = parsedSheets.map((sheet) => inspectSheet(sheet, mappingOverrides));
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
    mappedColumnCount: columnMappings.filter((mapping) => !["UNMAPPED", "IGNORE"].includes(mapping.suggestedTarget)).length,
    unmappedColumnCount: columnMappings.filter((mapping) => mapping.suggestedTarget === "UNMAPPED").length,
    ambiguousMappingCount: columnMappings.filter((mapping) => mapping.reviewRequired).length,
    candidateProductCount: structureInference.candidateProductCount,
    candidateVariantCount: structureInference.candidateVariantCount,
    attributeCandidateCount: attributeCandidates.length,
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