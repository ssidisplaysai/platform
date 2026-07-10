/**
 * Genesis Discovery Engine — Importer Interface
 *
 * The importer is the top-level orchestrator for the Discovery Import Pipeline.
 * It accepts a binary source file, routes it through the correct raw parser,
 * applies structure parsing, validates the results, and returns a complete
 * DiscoveryImportResult.
 *
 * Future importers (DOCX, Markdown, Audio) implement this interface
 * and plug into the same DiscoveryPipeline.
 *
 * The importer knows nothing about Evidence IR. Its only job is producing
 * DiscoveryDocument and DiscoveryInterview from external sources.
 */

import type { DiscoveryImportResult, DiscoverySource } from '../models';

// ---------------------------------------------------------------------------
// Import input
// ---------------------------------------------------------------------------

/**
 * Input to an importer: the binary file plus its provenance.
 */
export interface DiscoveryImportInput {
  /** Absolute or relative path to the source file, for reference only. */
  readonly filePath: string;

  /** Original file name (used for type detection and ID generation). */
  readonly fileName: string;

  /** Raw file bytes. */
  readonly buffer: Buffer;
}

// ---------------------------------------------------------------------------
// Importer interface
// ---------------------------------------------------------------------------

/**
 * Converts a DiscoveryImportInput into a DiscoveryImportResult.
 *
 * A failed import MUST still return a result with `success: false`
 * and populated `diagnostics`. It must never silently discard source data.
 */
export interface IDiscoveryImporter {
  /**
   * Human-readable name for this importer.
   * Example: "PDF Discovery Importer v1"
   */
  readonly name: string;

  /**
   * Whether this importer can handle the given file name.
   */
  canImport(fileName: string): boolean;

  /**
   * Run the full import pipeline on the given input.
   */
  import(input: DiscoveryImportInput): Promise<DiscoveryImportResult>;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Resolve a DiscoverySource from an import input.
 * The sourceId is deterministically derived from fileName + fileSize.
 */
export function buildDiscoverySource(input: DiscoveryImportInput): DiscoverySource {
  const { filePath, fileName, buffer } = input;
  const fileSize = buffer.length;
  const mimeType = resolveMimeType(fileName);
  const sourceType = resolveSourceType(fileName);

  // Deterministic source ID: stable hash of (fileName + fileSize).
  const rawId = `${fileName}::${fileSize}`;
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    const c = rawId.charCodeAt(i);
    hash = (Math.imul(31, hash) + c) | 0;
  }
  const sourceId = `src_${(hash >>> 0).toString(16).padStart(8, '0')}`;

  return {
    sourceId,
    sourceType,
    fileName,
    filePath,
    fileSize,
    mimeType,
    importedAt: new Date().toISOString(),
  };
}

function resolveMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

import type { DiscoverySourceType } from '../models';

function resolveSourceType(fileName: string): DiscoverySourceType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.txt')) return 'transcript';
  return 'unknown';
}
