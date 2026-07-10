/**
 * Genesis Discovery Engine — PDF Discovery Importer
 *
 * Orchestrates the full pipeline for PDF-sourced Discovery Interviews:
 *
 *   Buffer (PDF bytes)
 *     ↓ PdfRawParser       → IRawParseResult    (raw per-page text)
 *     ↓ InterviewStructureParser.parseDocument  → DiscoveryDocument
 *     ↓ InterviewStructureParser.parseInterview → DiscoveryInterview
 *     ↓ DiscoveryValidator                      → DiscoveryValidationResult
 *     ↓ DiscoveryImportResult
 *
 * This importer has no knowledge of Evidence IR or any downstream stage.
 */

import { DiagnosticsCollector } from '../diagnostics';
import { DiagnosticCode, DiscoveryImportResult } from '../models';
import { InterviewStructureParser, PdfRawParser } from '../parser';
import { DiscoveryValidator } from '../validation/DiscoveryValidator';
import {
  buildDiscoverySource,
  DiscoveryImportInput,
  IDiscoveryImporter,
} from './IDiscoveryImporter';

export class PdfDiscoveryImporter implements IDiscoveryImporter {
  readonly name = 'PDF Discovery Importer v1';

  private readonly rawParser = new PdfRawParser();
  private readonly structureParser = new InterviewStructureParser();
  private readonly validator = new DiscoveryValidator();

  canImport(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.pdf');
  }

  async import(input: DiscoveryImportInput): Promise<DiscoveryImportResult> {
    const diag = new DiagnosticsCollector();
    const timestamp = new Date().toISOString();

    // Build the source record first — it always exists, even on failure.
    const source = buildDiscoverySource(input);

    // ------------------------------------------------------------------
    // Guard: source type must be supported
    // ------------------------------------------------------------------
    if (!this.rawParser.canParse(source.sourceType)) {
      diag.error(DiagnosticCode.SOURCE_TYPE_UNSUPPORTED, `Source type "${source.sourceType}" is not supported by PdfDiscoveryImporter.`, {
        context: `File: ${input.fileName}`,
      });
      return this.failResult(source, diag, timestamp);
    }

    // ------------------------------------------------------------------
    // Guard: buffer must not be empty
    // ------------------------------------------------------------------
    if (!input.buffer || input.buffer.length === 0) {
      diag.error(DiagnosticCode.SOURCE_FILE_EMPTY, `Source file "${input.fileName}" is empty.`);
      return this.failResult(source, diag, timestamp);
    }

    // ------------------------------------------------------------------
    // Stage 1: Raw PDF extraction
    // ------------------------------------------------------------------
    let rawResult;
    try {
      rawResult = await this.rawParser.parse(input.buffer, input.fileName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diag.error(DiagnosticCode.INVALID_PDF, `Failed to parse PDF: ${message}`, {
        context: `File: ${input.fileName}`,
      });
      return this.failResult(source, diag, timestamp);
    }

    diag.info(DiagnosticCode.SOURCE_NOT_FOUND, // reusing INFO as a progress log
      `PDF parsed successfully: ${rawResult.totalPages} page(s), ${input.fileName}`,
    );

    // ------------------------------------------------------------------
    // Stage 2: Document structure
    // ------------------------------------------------------------------
    let document;
    try {
      document = this.structureParser.parseDocument(rawResult, source.sourceId, input.fileName);
      diag.absorb(document.diagnostics);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diag.error(DiagnosticCode.DOCUMENT_LOAD_FAILED, `Document structure parsing failed: ${message}`);
      return this.failResult(source, diag, timestamp);
    }

    // ------------------------------------------------------------------
    // Stage 3: Interview structure
    // ------------------------------------------------------------------
    let interview;
    try {
      interview = this.structureParser.parseInterview(document);
      diag.absorb(interview.diagnostics);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diag.error(DiagnosticCode.SECTION_DETECTION_FAILED, `Interview structure extraction failed: ${message}`);
      return this.failResult(source, diag, timestamp);
    }

    // ------------------------------------------------------------------
    // Stage 4: Validation
    // ------------------------------------------------------------------
    const validation = this.validator.validate(document, interview);
    diag.absorb([...validation.errors, ...validation.warnings, ...validation.infos]);

    // ------------------------------------------------------------------
    // Result
    // ------------------------------------------------------------------
    const success = !diag.hasErrors();

    return {
      success,
      source,
      document,
      interview,
      validation,
      diagnostics: diag.getAll(),
      timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private failResult(
    source: DiscoveryImportResult['source'],
    diag: DiagnosticsCollector,
    timestamp: string,
  ): DiscoveryImportResult {
    return {
      success: false,
      source,
      document: undefined,
      interview: undefined,
      validation: {
        valid: false,
        errors: diag.getErrors(),
        warnings: diag.getWarnings(),
        infos: diag.getInfos(),
      },
      diagnostics: diag.getAll(),
      timestamp,
    };
  }
}
