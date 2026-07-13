/**
 * RepositoryScanner.ts
 * Scans repository structure and discovers documents.
 *
 * The RepositoryScanner discovers all documents in a repository,
 * extracts basic file information, and produces deterministically
 * ordered document lists for repository compilation.
 */

import { promises as fs } from 'fs';
import { basename, extname, resolve, relative } from 'path';
import type { IRepositoryScanner } from './interfaces/Scanner';
import type { RepositoryDocument } from './models/RepositoryDocument';
import { createRepositoryDocument } from './models/RepositoryDocument';
import { deepFreeze } from './utils/deepFreeze';

/**
 * Implementation of repository scanner.
 *
 * Scans repository file system, discovers documents, and extracts
 * basic file metadata. All results are ordered deterministically.
 *
 * Determinism Guarantees:
 * - Identical directory structures produce identical results
 * - Results are sorted lexicographically by workspace-relative path
 * - No filesystem enumeration order dependence
 * - No timestamps or randomness
 * - Repeated scans of identical content produce identical collections
 *
 * @readonly Constructor parameters are private and immutable.
 */
export class RepositoryScanner implements IRepositoryScanner {
  /**
   * Recognized file extensions for scanning.
   */
  private readonly supportedExtensions: readonly string[];

  /**
   * Directory names to exclude from scanning.
   */
  private readonly excludedDirectories: readonly string[];

  /**
   * Creates a new RepositoryScanner instance.
   */
  constructor() {
    // Supported file types (in canonical order)
    this.supportedExtensions = Object.freeze([
      '.json',
      '.md',
      '.mjs',
      '.mts',
      '.ts',
      '.tsx',
      '.yaml',
      '.yml',
    ]);
    // Directories to exclude (in canonical order)
    this.excludedDirectories = Object.freeze([
      '.git',
      '.next',
      'build',
      'coverage',
      'dist',
      'generated',
      'node_modules',
    ]);
  }

  /**
   * Scans the repository and discovers all documents.
   *
   * Traverses the directory tree, discovers all supported documents,
   * normalizes paths to repository-relative form, and returns them
   * in deterministic (lexicographic) order.
   *
   * Results are immutable and do not expose internal state.
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to list of discovered RepositoryDocuments
   * @throws Error if repository root is invalid or inaccessible
   */
  async scan(repositoryRoot: string): Promise<readonly RepositoryDocument[]> {
    // Resolve and validate repository root
    const normalizedRoot = resolve(repositoryRoot);

    try {
      await fs.access(normalizedRoot);
    } catch {
      throw new Error(`Repository root not accessible: ${repositoryRoot}`);
    }

    // Recursively discover all files
    const allFiles = await this.walkDirectory(normalizedRoot);

    // Filter by supported extensions
    const supportedFiles = allFiles.filter(filePath =>
      this.supportedExtensions.includes(extname(filePath).toLowerCase()),
    );

    // Convert to repository-relative paths (normalized to forward slashes)
    const documentPaths = supportedFiles.map(filePath => {
      const relPath = relative(normalizedRoot, filePath);
      // Normalize separators to forward slashes
      return relPath.replace(/\\/g, '/');
    });

    // Sort deterministically (lexicographic order)
    documentPaths.sort();

    // Create RepositoryDocument for each file
    const documents: RepositoryDocument[] = [];

    for (const path of documentPaths) {
      const absolutePath = resolve(normalizedRoot, path.replace(/\//g, '\\'));

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const doc = createRepositoryDocument(path, content, normalizedRoot);
        documents.push(deepFreeze(doc));
      } catch {
        // Skip files that cannot be read
        continue;
      }
    }

    // Return frozen immutable array with frozen documents
    return deepFreeze(documents);
  }

  /**
   * Recursively walks directory tree and returns all file paths.
   *
   * Traverses recursively, respects exclude patterns, and handles
   * errors gracefully (skips inaccessible directories).
   *
   * @param dirPath - Directory to walk
   * @returns Array of absolute file paths
   */
  private async walkDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = resolve(dirPath, entry.name);

        // Skip excluded directories
        if (entry.isDirectory()) {
          if (this.excludedDirectories.includes(entry.name.toLowerCase())) {
            continue;
          }

          // Recursively walk subdirectories
          const subFiles = await this.walkDirectory(entryPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(entryPath);
        }
        // Ignore symbolic links and other special file types
      }
    } catch {
      // Silently skip directories that cannot be read
    }

    return files;
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
   * @returns Array of directory names, sorted ascending
   */
  getExcludedPatterns(): readonly string[] {
    return this.excludedDirectories;
  }
}
