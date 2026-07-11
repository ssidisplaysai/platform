/**
 * Genesis Discovery Engine — Exporter Interface
 *
 * Exporters convert DiscoveryDocument and DiscoveryInterview artifacts
 * into serialized formats (JSON, YAML, etc.).
 *
 * The pipeline boundary remains here. Exporters produce files for human
 * review or for downstream pipeline stages to read. They do not implement
 * Evidence IR or any higher abstraction.
 */

import type {
  DiscoveryDocument,
  DiscoveryImportResult,
  DiscoveryInterview,
} from '../models';

// ---------------------------------------------------------------------------
// Exporter output
// ---------------------------------------------------------------------------

export interface ExporterOutput {
  /** The serialized content. */
  readonly content: string;

  /** Suggested file extension, e.g. "json" or "yaml". */
  readonly extension: string;

  /** MIME type for the content. */
  readonly mimeType: string;

  /** Suggested base file name (without extension). */
  readonly suggestedFileName: string;
}

// ---------------------------------------------------------------------------
// Exporter interface
// ---------------------------------------------------------------------------

/**
 * Converts Discovery artifacts into a serialized representation.
 * Implementations must produce deterministic, lossless output.
 */
export interface IDiscoveryExporter {
  readonly name: string;

  /** Export only the DiscoveryDocument. */
  exportDocument(document: DiscoveryDocument): ExporterOutput;

  /** Export only the DiscoveryInterview. */
  exportInterview(interview: DiscoveryInterview): ExporterOutput;

  /** Export the complete DiscoveryImportResult. */
  exportResult(result: DiscoveryImportResult): ExporterOutput;
}
