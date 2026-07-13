/**
 * Analyzer.ts
 * Public interface contract for the RepositoryAnalyzer.
 *
 * The RepositoryAnalyzer interface defines the analysis orchestration contract.
 * It coordinates all analysis stages: scanning, parsing, classification,
 * dependency discovery, conflict detection, and reporting.
 */

import type { RepositoryReport } from '../models/RepositoryReport';

/**
 * Public interface for repository analysis orchestration.
 *
 * The RepositoryAnalyzer coordinates the complete analysis workflow:
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
export interface IRepositoryAnalyzer {
  /**
   * Analyzes the repository at the given root path.
   *
   * Performs complete end-to-end analysis:
   * - Discovers all documents in repository tree
   * - Extracts content and metadata
   * - Classifies authority levels
   * - Builds dependency graph
   * - Detects conflicts
   * - Calculates health metrics
   *
   * Analysis is deterministic: identical repository structures
   * always produce identical reports.
   *
   * @param repositoryRoot - Absolute path to repository root
   * @returns Promise resolving to complete RepositoryReport
   * @throws Error if repository root is invalid or inaccessible
   */
  analyze(repositoryRoot: string): Promise<RepositoryReport>;

  /**
   * Gets the current analyzer version.
   *
   * @returns Version string (e.g., "1.0.0")
   */
  getVersion(): string;

  /**
   * Validates that the analyzer is properly configured.
   *
   * @returns true if all dependencies and configuration are valid
   */
  isConfigured(): boolean;
}
