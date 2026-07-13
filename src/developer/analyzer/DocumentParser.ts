/**
 * DocumentParser.ts
 * Parses document content and extracts metadata.
 *
 * The DocumentParser extracts structured information from document
 * content including titles, descriptions, versions, and cross-references.
 *
 * Parsing is deterministic: identical content always produces identical
 * extracted metadata. Missing metadata remains explicitly absent.
 */

import type { RepositoryDocument } from './models/RepositoryDocument';
import { deepFreeze } from './utils/deepFreeze';

/**
 * Represents extracted document metadata.
 * @readonly
 */
interface DocumentMetadata {
  readonly title: string | null;
  readonly version: string | null;
  readonly status: string | null;
  readonly program: string | null;
  readonly milestone: string | null;
  readonly owner: string | null;
  readonly references: readonly string[];
  readonly supersedes: readonly string[];
  readonly extends: readonly string[];
  readonly implements: readonly string[];
}

/**
 * Parses documents and extracts metadata.
 *
 * Extraction strategy (in order):
 * 1. YAML frontmatter (if present)
 * 2. Top-level H1 heading
 * 3. Labeled fields (with or without bold)
 * 4. Filename patterns
 * 5. Cross-reference detection
 *
 * Parsing is deterministic and produces stable output.
 * Missing metadata remains explicitly absent (null/empty).
 */
export class DocumentParser {
  /**
   * Creates a new DocumentParser instance.
   */
  constructor() {}

  /**
   * Parses a document and extracts metadata.
   *
   * Analyzes document content to extract:
   * - Title (from H1 header or filename)
   * - Version (from metadata or filename)
   * - Status (from metadata or content markers)
   * - Program, Milestone, Owner (from metadata)
   * - References (cross-references in content)
   *
   * Missing metadata is preserved as null/empty rather than invented.
   *
   * @param document - Document to parse
   * @returns Enriched RepositoryDocument with extracted metadata (frozen)
   */
  parse(document: RepositoryDocument): RepositoryDocument {
    const metadata = this.extractMetadata(document.content, document.fileName);

    const enriched = {
      ...document,
      title: metadata.title,
      version: metadata.version,
      status: metadata.status,
      externalReferences: [...metadata.references],
    };

    return deepFreeze(enriched);
  }

  /**
   * Extracts all metadata from document content.
   *
   * @param content - Document content
   * @param filename - Document filename
   * @returns Extracted metadata object
   */
  private extractMetadata(content: string, filename: string): DocumentMetadata {
    // Try YAML frontmatter first
    const frontmatter = this.extractFrontmatter(content);

    return {
      title: frontmatter.title ?? this.extractTitle(content),
      version: frontmatter.version ?? this.extractVersionFromFilename(filename),
      status: frontmatter.status ?? this.extractStatus(content),
      program: frontmatter.program ?? null,
      milestone: frontmatter.milestone ?? null,
      owner: frontmatter.owner ?? null,
      references: [...(frontmatter.references ?? []), ...this.extractReferences(content)],
      supersedes: frontmatter.supersedes ?? [],
      extends: frontmatter.extends ?? [],
      implements: frontmatter.implements ?? [],
    };
  }

  /**
   * Extracts YAML frontmatter from document.
   *
   * Frontmatter must be at the very beginning, between --- markers.
   * Example:
   * ```
   * ---
   * title: My Document
   * version: 1.0
   * status: DRAFT
   * ---
   * ```
   *
   * @param content - Document content
   * @returns Parsed frontmatter fields or empty object if not present
   */
  private extractFrontmatter(
    content: string,
  ): Partial<DocumentMetadata> & Record<string, unknown> {
    const lines = content.split('\n');

    // Must start with ---
    if (!lines[0]?.trim().startsWith('---')) {
      return {};
    }

    // Find closing ---
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim().startsWith('---')) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return {};
    }

    // Parse YAML-like format (simple key: value parsing)
    const frontmatterLines = lines.slice(1, endIndex);
    const result: Record<string, unknown> = {};

    for (const line of frontmatterLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Extracts title from document content.
   *
   * Looks for top-level H1 heading (# Title).
   *
   * @param content - Document content
   * @returns Extracted title or null if not found
   */
  private extractTitle(content: string): string | null {
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ') && !trimmed.startsWith('# #')) {
        return trimmed.substring(2).trim();
      }
    }

    return null;
  }

  /**
   * Extracts version from filename.
   *
   * Looks for version patterns like:
   * - v1.0.0
   * - v1
   * - _v1
   * - -v1
   *
   * @param filename - Document filename
   * @returns Version string or null if not found
   */
  private extractVersionFromFilename(filename: string): string | null {
    // Match patterns like v1.0.0, v1, etc.
    const match = filename.match(/[_-]?(v\d+(?:\.\d+)*)/i);
    return match ? match[1] : null;
  }

  /**
   * Extracts status from document content.
   *
   * Looks for labeled fields like:
   * - Status: DRAFT
   * - **Status:** APPROVED
   *
   * @param content - Document content
   * @returns Status string or null if not found
   */
  private extractStatus(content: string): string | null {
    return this.extractLabeledField(content, 'status');
  }

  /**
   * Extracts a labeled field from document content.
   *
   * Supports patterns like:
   * - Label: value
   * - **Label:** value
   * - **Label**: value
   *
   * @param content - Document content
   * @param fieldName - Name of the field to extract
   * @returns Field value or null if not found
   */
  private extractLabeledField(content: string, fieldName: string): string | null {
    const lines = content.split('\n');
    const fieldPattern = new RegExp(
      `^\\*?\\*?${fieldName}\\*?\\*?\\s*:\\s*(.+?)\\s*$`,
      'i',
    );

    for (const line of lines) {
      const match = line.match(fieldPattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extracts references from document content.
   *
   * Looks for:
   * - Specification IDs (e.g., GCF-0001, BGC-001)
   * - Document references
   * - Cross-document links
   *
   * @param content - Document content
   * @returns Array of reference strings (deduplicated, sorted)
   */
  private extractReferences(content: string): string[] {
    const references = new Set<string>();

    // Extract specification IDs (e.g., GCF-0001, BGC-001, EBS-0001)
    const specPattern = /\b([A-Z]{2,}-\d{4})\b/g;
    let match: RegExpExecArray | null;
    while ((match = specPattern.exec(content)) !== null) {
      references.add(match[1]);
    }

    return Array.from(references).sort();
  }
}
