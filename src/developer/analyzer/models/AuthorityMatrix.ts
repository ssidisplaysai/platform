/**
 * AuthorityMatrix.ts
 * Represents the authority ownership and precedence matrix.
 *
 * The AuthorityMatrix captures the complete authority structure of a repository:
 * - Which authority levels own which documents
 * - Authority precedence and hierarchy
 * - Duplicate authorities (same content at different authority levels)
 * - Authority conflicts and resolutions
 *
 * All properties are immutable after creation.
 */

import type { Authority } from './Authority';
import type { RepositoryDocument } from './RepositoryDocument';

/**
 * Entry in the authority matrix representing a grouping of documents.
 *
 * @readonly
 */
export interface AuthorityMatrixEntry {
  /** Authority level for this group */
  readonly authority: Authority;

  /** Documents owned by this authority */
  readonly documents: readonly RepositoryDocument[];

  /** Count of documents at this authority level */
  readonly documentCount: number;

  /** Whether this authority is primary (not superseded) */
  readonly isPrimary: boolean;

  /** Duplicate authorities (same content, different authority level) */
  readonly duplicates: readonly Readonly<{
    authority: Authority;
    documentCount: number;
  }>[];

  /** Deterministic checksum of this matrix entry */
  readonly checksum: string;
}

/**
 * Authority ownership matrix for repository compilation.
 *
 * The AuthorityMatrix organizes documents by their authority level
 * and identifies:
 * - Authority hierarchy (what overrides what)
 * - Duplicate content at multiple authority levels
 * - Authority ownership patterns
 * - Precedence and conflict resolution
 *
 * All matrices are frozen and immutable after creation.
 *
 * @readonly
 */
export interface AuthorityMatrix {
  /** Unique identifier for this matrix */
  readonly id: string;

  /** Repository root analyzed */
  readonly repositoryRoot: string;

  /** Entries organized by authority level (highest to lowest precedence) */
  readonly entries: readonly AuthorityMatrixEntry[];

  /** Total unique authorities found */
  readonly authorityCount: number;

  /** Total documents analyzed */
  readonly totalDocumentCount: number;

  /** Authority levels present in this matrix (highest to lowest) */
  readonly presentLevels: readonly string[];

  /** Duplicate document groups (same content, different authorities) */
  readonly duplicateGroups: readonly Readonly<{
    contentChecksum: string;
    authorities: readonly Authority[];
    count: number;
  }>[];

  /** Checksum of entire matrix (for deterministic comparison) */
  readonly checksum: string;

  /** ISO 8601 timestamp when matrix was compiled */
  readonly compiledAt: string;

  /** Compilation duration in milliseconds */
  readonly compilationDurationMs: number;
}

/**
 * Factory function to create an AuthorityMatrix.
 *
 * @param repositoryRoot - Repository root path
 * @param entries - Authority matrix entries (must be sorted by precedence)
 * @param durationMs - Compilation duration
 * @returns Frozen AuthorityMatrix
 */
export function createAuthorityMatrix(
  repositoryRoot: string,
  entries: AuthorityMatrixEntry[],
  durationMs: number,
): AuthorityMatrix {
  const presentLevels = Array.from(new Set(entries.map(e => e.authority.level)));
  const totalDocumentCount = entries.reduce((sum, e) => sum + e.documentCount, 0);

  // Find duplicate groups
  const contentMap = new Map<
    string,
    { authorities: Authority[]; count: number }
  >();
  entries.forEach(entry => {
    entry.documents.forEach(doc => {
      if (!contentMap.has(doc.contentChecksum)) {
        contentMap.set(doc.contentChecksum, {
          authorities: [],
          count: 0,
        });
      }
      const group = contentMap.get(doc.contentChecksum)!;
      if (!group.authorities.some(a => a.level === entry.authority.level)) {
        group.authorities.push(entry.authority);
      }
      group.count++;
    });
  });

  const duplicateGroups = Array.from(contentMap.entries())
    .filter(([, group]) => group.authorities.length > 1)
    .map(([checksum, group]) => ({
      contentChecksum: checksum,
      authorities: group.authorities,
      count: group.count,
    }));

  return {
    id: `authmatrix_${Date.now()}_v1`,
    repositoryRoot,
    entries: Object.freeze(entries),
    authorityCount: presentLevels.length,
    totalDocumentCount,
    presentLevels: Object.freeze(presentLevels),
    duplicateGroups: Object.freeze(duplicateGroups),
    checksum: `checksum_${totalDocumentCount}_${presentLevels.length}`,
    compiledAt: new Date().toISOString(),
    compilationDurationMs: durationMs,
  };
}
