/**
 * BuildSummary.ts
 *
 * The canonical Genesis Build Report.
 *
 * Immutable, deterministic record of repository health and compiler output.
 * This is the artifact that all governance tooling consumes.
 */

import type { BuildError } from './models/BuildError';
import type { ErrorStatistics } from './models/ErrorStatistics';
import type { RepositoryHealth } from './models/RepositoryHealth';

/**
 * Complete build report for a repository.
 *
 * All fields are immutable and deeply frozen at creation.
 *
 * This is the canonical engineering artifact used by governance
 * tools to measure and track repository health.
 */
export interface BuildSummary {
  /**
   * Repository root path (normalized).
   */
  readonly repositoryRoot: string;

  /**
   * Repository health assessment.
   */
  readonly health: RepositoryHealth;

  /**
   * All discovered errors.
   */
  readonly errors: readonly BuildError[];

  /**
   * Aggregated error statistics.
   */
  readonly statistics: ErrorStatistics;

  /**
   * Total number of errors.
   */
  readonly totalErrors: number;

  /**
   * TypeScript compiler version (if available).
   */
  readonly compilerVersion?: string;

  /**
   * Diagnostic messages from parsing.
   */
  readonly diagnostics: readonly string[];

  /**
   * Deterministic checksum of the report.
   *
   * Excludes timestamps and environment-specific values.
   * Identical repositories always produce identical checksums.
   */
  readonly checksum: string;

  /**
   * ISO 8601 timestamp of report generation (not included in checksum).
   */
  readonly generatedAt: string;

  /**
   * Human-readable summary.
   */
  readonly summary: string;
}

/**
 * Factory to create an immutable BuildSummary.
 *
 * @param repositoryRoot - Repository root path
 * @param health - Health assessment
 * @param errors - All discovered errors
 * @param statistics - Error statistics
 * @param checksum - Deterministic checksum
 * @param compilerVersion - TS compiler version if available
 * @param diagnostics - Parse diagnostics
 * @returns Deeply frozen BuildSummary
 */
export function createBuildSummary(
  repositoryRoot: string,
  health: RepositoryHealth,
  errors: readonly BuildError[],
  statistics: ErrorStatistics,
  checksum: string,
  compilerVersion?: string,
  diagnostics?: string[]
): BuildSummary {
  const summary = Object.freeze({
    repositoryRoot: repositoryRoot.replace(/\\/g, '/'),
    health,
    errors: Object.freeze([...errors]),
    statistics,
    totalErrors: errors.length,
    compilerVersion,
    diagnostics: Object.freeze(diagnostics || []),
    checksum,
    generatedAt: new Date().toISOString(),
    summary: `Build Report: ${health.grade} (${health.score} points) - ${errors.length} error(s)`,
  });

  return summary;
}
