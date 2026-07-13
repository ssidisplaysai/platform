/**
 * Scanner.ts
 * Public interface contract for repository scanning.
 *
 * The RepositoryScanner interface defines the contract for discovering
 * and enumerating documents in the repository structure.
 */

import type { RepositoryDocument } from '../models/RepositoryDocument';

/**
 * Public interface for repository scanning and document discovery.
 *
 * The RepositoryScanner discovers all documents in a repository tree,
 * enumerates their paths, and extracts basic file information.
 *
 * Scanning is deterministic: identical repositories always produce
 * identical document lists in the same order (sorted by path).
 *
 * @readonly All properties are read-only to prevent mutation.
 */
export interface IRepositoryScanner {
  /**
   * Scans the repository and discovers all documents.
   *
   * Returns all documents found in the repository tree, ordered
   * deterministically by their workspace-relative paths (ascending).
   *
   * File discovery follows these rules:
   * - All files in all directories are discovered
   * - Only files with recognized extensions are included
   * - Hidden files and directories are included
   * - Symbolic links are followed
   * - Results are deterministically ordered by path
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to list of discovered RepositoryDocuments
   * @throws Error if repository root is invalid or inaccessible
   */
  scan(repositoryRoot: string): Promise<readonly RepositoryDocument[]>;

  /**
   * Gets the list of file extensions that will be scanned.
   *
   * @returns Array of extensions (including dots), sorted ascending
   */
  getSupportedExtensions(): readonly string[];

  /**
   * Gets the list of directory patterns that will be excluded from scanning.
   *
   * @returns Array of glob patterns, sorted ascending
   */
  getExcludedPatterns(): readonly string[];
}
