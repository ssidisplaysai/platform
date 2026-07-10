/**
 * Genesis Discovery Engine — Discovery Pipeline
 *
 * The pipeline is the public façade for the entire Discovery Import stage.
 *
 * Usage:
 *
 *   const pipeline = new DiscoveryPipeline();
 *   const result = await pipeline.importFile('/path/to/interview.pdf');
 *
 *   // or from a buffer:
 *   const result = await pipeline.importBuffer(buffer, 'Interview.pdf', '/path/to/Interview.pdf');
 *
 * The pipeline:
 *   1. Selects the correct importer based on file type.
 *   2. Runs the full import pipeline.
 *   3. Returns a DiscoveryImportResult.
 *
 * Future importers (DOCX, Markdown, Audio) are registered via
 * `pipeline.registerImporter(importer)` and immediately become available
 * without any other code changes.
 *
 * The pipeline does NOT know about Evidence IR.
 * Its responsibility ends at DiscoveryImportResult.
 */

import { readFileSync } from 'fs';
import { basename } from 'path';
import type { IDiscoveryImporter, DiscoveryImportInput } from '../importer/IDiscoveryImporter';
import { PdfDiscoveryImporter } from '../importer/PdfDiscoveryImporter';
import type { DiscoveryImportResult } from '../models';
import { DiagnosticsCollector } from '../diagnostics';
import { DiagnosticCode } from '../models';

export class DiscoveryPipeline {
  private readonly importers: IDiscoveryImporter[];

  constructor(importers?: IDiscoveryImporter[]) {
    // Default: PDF importer registered out of the box.
    this.importers = importers ?? [new PdfDiscoveryImporter()];
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register an additional importer.
   * The first registered importer that returns `canImport(fileName) === true`
   * will be used.
   */
  registerImporter(importer: IDiscoveryImporter): this {
    this.importers.push(importer);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Import from file path (Node.js only)
  // ---------------------------------------------------------------------------

  /**
   * Import a Discovery Interview from a file path.
   * Reads the file synchronously, then delegates to `importBuffer`.
   */
  async importFile(filePath: string): Promise<DiscoveryImportResult> {
    const fileName = basename(filePath);
    let buffer: Buffer;

    try {
      buffer = readFileSync(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const diag = new DiagnosticsCollector();
      diag.error(DiagnosticCode.SOURCE_NOT_FOUND, `Cannot read file "${filePath}": ${message}`);

      return {
        success: false,
        source: {
          sourceId: '',
          sourceType: 'unknown',
          fileName,
          filePath,
          fileSize: 0,
          mimeType: 'application/octet-stream',
          importedAt: new Date().toISOString(),
        },
        document: undefined,
        interview: undefined,
        validation: {
          valid: false,
          errors: diag.getErrors(),
          warnings: [],
          infos: [],
        },
        diagnostics: diag.getAll(),
        timestamp: new Date().toISOString(),
      };
    }

    return this.importBuffer(buffer, fileName, filePath);
  }

  // ---------------------------------------------------------------------------
  // Import from buffer
  // ---------------------------------------------------------------------------

  /**
   * Import a Discovery Interview from an in-memory buffer.
   * This is the core method — `importFile` delegates here.
   */
  async importBuffer(
    buffer: Buffer,
    fileName: string,
    filePath = '',
  ): Promise<DiscoveryImportResult> {
    const importer = this.selectImporter(fileName);

    if (!importer) {
      const diag = new DiagnosticsCollector();
      diag.error(
        DiagnosticCode.SOURCE_TYPE_UNSUPPORTED,
        `No importer found for file "${fileName}". Registered importers: ${this.importers.map((i) => i.name).join(', ')}.`,
      );

      return {
        success: false,
        source: {
          sourceId: '',
          sourceType: 'unknown',
          fileName,
          filePath,
          fileSize: buffer.length,
          mimeType: 'application/octet-stream',
          importedAt: new Date().toISOString(),
        },
        document: undefined,
        interview: undefined,
        validation: {
          valid: false,
          errors: diag.getErrors(),
          warnings: [],
          infos: [],
        },
        diagnostics: diag.getAll(),
        timestamp: new Date().toISOString(),
      };
    }

    const input: DiscoveryImportInput = { filePath, fileName, buffer };
    return importer.import(input);
  }

  // ---------------------------------------------------------------------------
  // Batch import
  // ---------------------------------------------------------------------------

  /**
   * Import multiple files. Returns one result per file.
   * Files that fail are included with `success: false`.
   */
  async importFiles(filePaths: string[]): Promise<DiscoveryImportResult[]> {
    return Promise.all(filePaths.map((p) => this.importFile(p)));
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private selectImporter(fileName: string): IDiscoveryImporter | null {
    return this.importers.find((i) => i.canImport(fileName)) ?? null;
  }
}
