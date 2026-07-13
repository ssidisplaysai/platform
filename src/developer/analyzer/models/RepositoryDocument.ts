/**
 * RepositoryDocument.ts
 * Represents a single document discovered and parsed from the repository.
 *
 * A RepositoryDocument is an immutable snapshot of a document artifact
 * extracted from the repository structure. It captures the document's
 * location, content metadata, and analytical properties.
 */

import type { Authority } from './Authority';
import { AuthorityLevel, createAuthority } from './Authority';

/**
 * Represents a single document discovered in the repository.
 *
 * Documents are identified by their workspace-relative path and are
 * immutable after extraction. Each document maintains a snapshot of
 * its content, structure, and discovered relationships.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface RepositoryDocument {
  /**
   * Deterministic document identifier.
   * Derived from canonical path normalization.
   * Format: `doc_<sha256-of-canonical-path>_v1`
   * @readonly
   */
  readonly id: string;

  /**
   * Workspace-relative file path (forward slashes, no drive letter).
   * Example: "docs/architecture/GCF-0001_Genesis_Compiler_Framework_Specification_v1.md"
   * @readonly
   */
  readonly path: string;

  /**
   * Absolute file system path.
   * @readonly
   */
  readonly absolutePath: string;

  /**
   * File extension (including dot).
   * Example: ".md", ".ts", ".json"
   * @readonly
   */
  readonly extension: string;

  /**
   * File name without extension.
   * Example: "GCF-0001_Genesis_Compiler_Framework_Specification_v1"
   * @readonly
   */
  readonly nameWithoutExtension: string;

  /**
   * Full file name including extension.
   * @readonly
   */
  readonly fileName: string;

  /**
   * Parent directory path (workspace-relative).
   * @readonly
   */
  readonly parentDirectory: string;

  /**
   * Raw file content (complete, unmodified).
   * @readonly
   */
  readonly content: string;

  /**
   * Size of file in bytes.
   * @readonly
   */
  readonly sizeBytes: number;

  /**
   * Line count in the document.
   * @readonly
   */
  readonly lineCount: number;

  /**
   * SHA256 checksum of canonical file content.
   * Used for deterministic identification and change detection.
   * @readonly
   */
  readonly contentChecksum: string;

  /**
   * Classification authority of this document (e.g., Constitutional, Normative).
   * @readonly
   */
  readonly authority: Authority;

  /**
   * Whether this document is marked as frozen/immutable in repository.
   * @readonly
   */
  readonly isFrozen: boolean;

  /**
   * Extracted document title (from H1, filename, or metadata).
   * @readonly
   */
  readonly title: string | null;

  /**
   * Extracted document description or summary.
   * @readonly
   */
  readonly description: string | null;

  /**
   * Document version string if present in metadata or filename.
   * Example: "1.0", "v1.0", "1.0.0"
   * @readonly
   */
  readonly version: string | null;

  /**
   * Document status if declared (e.g., "DRAFT", "APPROVED", "DEPRECATED").
   * @readonly
   */
  readonly status: string | null;

  /**
   * List of all document identifiers referenced by this document.
   * References are extracted from content (links, cross-references, citations).
   * @readonly
   */
  readonly referencedDocumentIds: readonly string[];

  /**
   * List of referenced external identifiers (specifications, standards, etc).
   * Example: ["GPS-0001", "BGC-0001", "GCF-0002"]
   * @readonly
   */
  readonly externalReferences: readonly string[];

  /**
   * Tags or categories applied to this document.
   * @readonly
   */
  readonly tags: readonly string[];

  /**
   * UTC timestamp when document was extracted (ISO 8601).
   * @readonly
   */
  readonly extractedAt: string;

  /**
   * SHA256 checksum of document snapshot metadata.
   * Used to detect analytical changes.
   * @readonly
   */
  readonly metadataChecksum: string;
}

/**
 * Creates a minimal RepositoryDocument for testing or initialization.
 *
 * @param path - Workspace-relative path
 * @param content - File content
 * @param repositoryRoot - Repository root path (for absolutePath construction)
 * @returns RepositoryDocument with derived properties
 */
export function createRepositoryDocument(
  path: string,
  content: string,
  repositoryRoot: string,
): RepositoryDocument {
  const fileName = path.split('/').pop() || '';
  const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  const nameWithoutExtension = fileName.slice(0, -(extension.length));
  const parentDirectory = path.substring(0, path.lastIndexOf('/'));

  return {
    id: `doc_${path.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v1`,
    path,
    absolutePath: `${repositoryRoot}/${path}`,
    extension,
    nameWithoutExtension,
    fileName,
    parentDirectory,
    content,
    sizeBytes: new Blob([content]).size,
    lineCount: content.split('\n').length,
    contentChecksum: 'sha256_placeholder',
    authority: createAuthority(AuthorityLevel.UNCLASSIFIED),
    isFrozen: false,
    title: null,
    description: null,
    version: null,
    status: null,
    referencedDocumentIds: [],
    externalReferences: [],
    tags: [],
    extractedAt: new Date().toISOString(),
    metadataChecksum: 'sha256_placeholder',
  };
}
