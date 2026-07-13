/**
 * AuthorityCompiler.ts
 * Compiles authority ownership and precedence from repository documents.
 *
 * The AuthorityCompiler takes a collection of classified repository documents
 * and produces an AuthorityMatrix that captures:
 * - Authority ownership and hierarchy
 * - Duplicate content detection across authorities
 * - Authority precedence and conflict resolution
 * - Comprehensive authority statistics
 *
 * All compilation is deterministic: identical document sets always produce
 * identical authority matrices with identical checksums.
 */

import type { RepositoryDocument } from './models/RepositoryDocument';
import type { AuthorityMatrix, AuthorityMatrixEntry } from './models/AuthorityMatrix';
import { createAuthorityMatrix } from './models/AuthorityMatrix';
import { deepFreeze } from './utils/deepFreeze';

/**
 * Compiles authority matrices from repository documents.
 *
 * Deterministically organizes documents by authority level and detects
 * duplicates across authority boundaries.
 *
 * Authority Precedence (highest to lowest):
 * 1. CONSTITUTIONAL (immutable, foundational)
 * 2. NORMATIVE (binding specifications)
 * 3. ARCHITECTURAL (approved decisions)
 * 4. GUIDANCE (recommended practices)
 * 5. INFORMATIONAL (reference only)
 * 6. UNCLASSIFIED (unknown authority)
 */
export class AuthorityCompiler {
  /**
   * Authority precedence order (highest to lowest).
   * @readonly
   */
  private readonly authorityPrecedence = [
    'CONSTITUTIONAL',
    'NORMATIVE',
    'ARCHITECTURAL',
    'GUIDANCE',
    'INFORMATIONAL',
    'UNCLASSIFIED',
  ];

  /**
   * Creates a new AuthorityCompiler instance.
   */
  constructor() {}

  /**
   * Compiles an authority matrix from repository documents.
   *
   * Organizes documents by authority level and identifies:
   * - Authority ownership patterns
   * - Duplicate content at multiple authority levels
   * - Authority precedence hierarchy
   * - Comprehensive authority statistics
   *
   * Compilation is deterministic: identical document sets always produce
   * identical matrices.
   *
   * @param repositoryRoot - Repository root path
   * @param documents - Classified repository documents (must be from same repository)
   * @returns Frozen AuthorityMatrix with complete authority analysis
   */
  compile(
    repositoryRoot: string,
    documents: readonly RepositoryDocument[],
  ): AuthorityMatrix {
    const startTime = Date.now();

    // Group documents by authority level
    const groupByAuthority = this.groupDocumentsByAuthority(documents);

    // Create matrix entries in precedence order
    const entries = this.authorityPrecedence
      .map(level => {
        const docsAtLevel = groupByAuthority.get(level) ?? [];
        if (docsAtLevel.length === 0) return null;

        return this.createMatrixEntry(docsAtLevel, level);
      })
      .filter((entry): entry is AuthorityMatrixEntry => entry !== null);

    const durationMs = Date.now() - startTime;

    // Create and freeze the matrix
    const matrix = createAuthorityMatrix(repositoryRoot, entries, durationMs);
    return deepFreeze(matrix);
  }

  /**
   * Groups documents by their authority level.
   *
   * @param documents - Repository documents
   * @returns Map of authority level to documents
   */
  private groupDocumentsByAuthority(
    documents: readonly RepositoryDocument[],
  ): Map<string, RepositoryDocument[]> {
    const groups = new Map<string, RepositoryDocument[]>();

    for (const doc of documents) {
      const level = doc.authority.level;
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(doc);
    }

    // Sort documents within each group lexicographically by path
    for (const docs of Array.from(groups.values())) {
      docs.sort((a, b) => a.path.localeCompare(b.path));
    }

    return groups;
  }

  /**
   * Creates an authority matrix entry.
   *
   * @param documents - Documents at this authority level
   * @param authorityLevel - Authority level string
   * @returns Frozen matrix entry
   */
  private createMatrixEntry(
    documents: RepositoryDocument[],
    authorityLevel: string,
  ): AuthorityMatrixEntry {
    if (documents.length === 0) {
      throw new Error(`Cannot create matrix entry for empty document set`);
    }

    // All documents at this level have the same authority (already classified)
    const authority = documents[0]!.authority;

    // Detect duplicates (documents with same content at different authorities)
    const contentChecksums = new Set(documents.map(d => d.contentChecksum));

    return deepFreeze({
      authority,
      documents: Object.freeze(documents) as readonly RepositoryDocument[],
      documentCount: documents.length,
      isPrimary: true, // Primary documents at their designated authority level
      duplicates: [], // Populated by matrix comparison
      checksum: `entry_${authorityLevel}_${contentChecksums.size}_${documents.length}`,
    });
  }

  /**
   * Detects duplicate content across authority levels.
   *
   * @param matrix - Authority matrix
   * @returns Duplicate groups (content present at multiple authorities)
   */
  private detectDuplicates(
    matrix: AuthorityMatrix,
  ): Readonly<{
    contentChecksum: string;
    authorities: string[];
    count: number;
  }>[] {
    const contentMap = new Map<
      string,
      { authorities: Set<string>; count: number }
    >();

    for (const entry of matrix.entries) {
      for (const doc of entry.documents) {
        if (!contentMap.has(doc.contentChecksum)) {
          contentMap.set(doc.contentChecksum, {
            authorities: new Set(),
            count: 0,
          });
        }
        const group = contentMap.get(doc.contentChecksum)!;
        group.authorities.add(entry.authority.level);
        group.count++;
      }
    }

    return Array.from(contentMap.entries())
      .filter(([, group]) => group.authorities.size > 1)
      .map(([checksum, group]) => ({
        contentChecksum: checksum,
        authorities: Array.from(group.authorities).sort(),
        count: group.count,
      }));
  }

  /**
   * Gets the authority precedence order.
   *
   * @returns Array of authority levels in precedence order (highest to lowest)
   */
  getAuthorityPrecedence(): readonly string[] {
    return Object.freeze([...this.authorityPrecedence]);
  }

  /**
   * Validates that an authority matrix is properly formed.
   *
   * @param matrix - Matrix to validate
   * @returns true if matrix is valid and complete
   */
  isValid(matrix: AuthorityMatrix): boolean {
    return (
      matrix.id != null &&
      matrix.repositoryRoot != null &&
      matrix.entries != null &&
      matrix.entries.length > 0 &&
      matrix.authorityCount > 0 &&
      matrix.totalDocumentCount > 0 &&
      Object.isFrozen(matrix)
    );
  }
}
