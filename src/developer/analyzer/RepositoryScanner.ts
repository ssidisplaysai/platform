/**
 * RepositoryScanner.ts
 * Scans repository structure and discovers documents.
 *
 * The RepositoryScanner discovers all documents in a repository,
 * extracts basic file information, and produces deterministically
 * ordered document lists.
 */

import type { IRepositoryScanner } from './interfaces/Scanner';
import type { RepositoryDocument } from './models/RepositoryDocument';

/**
 * Implementation of repository scanner.
 *
 * Scans repository file system, discovers documents, and extracts
 * basic file metadata. All results are ordered deterministically.
 *
 * @readonly Constructor parameters are private and immutable.
 */
export class RepositoryScanner implements IRepositoryScanner {
  /**
   * Recognized file extensions for scanning.
   */
  private readonly supportedExtensions: readonly string[];

  /**
   * Directory patterns to exclude from scanning.
   */
  private readonly excludedPatterns: readonly string[];

  /**
   * Creates a new RepositoryScanner instance.
   */
  constructor() {
    this.supportedExtensions = Object.freeze([
      '.md',
      '.ts',
      '.js',
      '.json',
      '.yaml',
      '.yml',
      '.txt',
    ]);
    this.excludedPatterns = Object.freeze([
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.next/**',
      'out/**',
    ]);
  }

  /**
   * Scans the repository and discovers all documents.
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to list of discovered RepositoryDocuments
   */
  async scan(repositoryRoot: string): Promise<readonly RepositoryDocument[]> {
    // Scaffold implementation - to be filled in
    return Object.freeze([]);
  }

  /**
   * Gets the list of file extensions that will be scanned.
   *
   * @returns Array of extensions (including dots), sorted ascending
   */
  getSupportedExtensions(): readonly string[] {
    return this.supportedExtensions;
  }

  /**
   * Gets the list of directory patterns that will be excluded from scanning.
   *
   * @returns Array of glob patterns, sorted ascending
   */
  getExcludedPatterns(): readonly string[] {
    return this.excludedPatterns;
  }
}
