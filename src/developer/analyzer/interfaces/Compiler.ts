/**
 * Compiler.ts
 * Public interface contract for the RepositoryCompiler.
 *
 * The RepositoryCompiler interface defines the compilation orchestration contract.
 * It coordinates all compilation stages: scanning, parsing, classification,
 * dependency discovery, conflict detection, and reporting.
 */

import type { RepositoryReport } from '../models/RepositoryReport';

/**
 * Public interface for repository compilation orchestration.
 *
 * The RepositoryCompiler coordinates the complete compilation workflow:
 * 1. Scans repository for documents
 * 2. Parses document content and metadata
 * 3. Classifies document authority
 * 4. Builds dependency graph
 * 5. Detects conflicts and issues
 * 6. Calculates health metrics
 * 7. Generates comprehensive report
 *
 * All methods are deterministic and produce identical output for
 * identical input repositories.
 *
 * @readonly All properties are read-only to prevent mutation.
 */
export interface IRepositoryCompiler {
  /**
   * Compiles the repository at the given root path.
   *
   * Performs complete end-to-end compilation:
   * - Discovers all documents in repository tree
   * - Extracts content and metadata
   * - Classifies authority levels
   * - Builds dependency graph
   * - Detects conflicts
   * - Calculates health metrics
   *
   * Compilation is deterministic: identical repository structures
   * always produce identical reports.
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to complete RepositoryReport
   * @throws Error if repository root is invalid or inaccessible
   */
  compile(repositoryRoot: string): Promise<RepositoryReport>;

  /**
   * Gets the current compiler version.
   *
   * @returns Version string (e.g., "1.0.0")
   */
  getVersion(): string;

  /**
   * Validates that the compiler is properly configured.
   *
   * @returns true if all dependencies and configuration are valid
   */
  isConfigured(): boolean;
}
