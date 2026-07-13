/**
 * RepositoryReport.ts
 * Represents the complete analysis report of the repository.
 *
 * A RepositoryReport is the final immutable output of repository analysis.
 * It aggregates all discovered documents, detected conflicts, health metrics,
 * and dependency information into a single comprehensive view.
 */

import type { RepositoryDocument } from './RepositoryDocument';
import type { RepositoryConflict } from './RepositoryConflict';
import type { RepositoryHealth } from './RepositoryHealth';

/**
 * Represents a dependency edge in the repository dependency graph.
 *
 * A dependency indicates that one document depends on or references another.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface DependencyEdge {
  /** Source document ID. @readonly */
  readonly sourceDocumentId: string;

  /** Target document ID. @readonly */
  readonly targetDocumentId: string;

  /** Type of dependency (e.g., "references", "requires", "overrides"). @readonly */
  readonly dependencyType: string;

  /** Whether this dependency is direct or transitive. @readonly */
  readonly isTransitive: boolean;
}

/**
 * Represents the complete analysis report of the repository.
 *
 * Reports are immutable snapshots of repository state at a specific point in time.
 * They contain all discovered documents, identified conflicts, health metrics,
 * and derived dependency information.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface RepositoryReport {
  /**
   * Deterministic report identifier.
   * Format: `report_<timestamp>_<sha256-of-corpus-checksum>_v1`
   * @readonly
   */
  readonly id: string;

  /**
   * Title of this analysis report.
   * @readonly
   */
  readonly title: string;

  /**
   * Detailed description of what was analyzed.
   * @readonly
   */
  readonly description: string;

  /**
   * Repository root path analyzed.
   * @readonly
   */
  readonly repositoryRoot: string;

  /**
   * All discovered documents.
   * Ordered deterministically by document ID (ascending).
   * @readonly
   */
  readonly documents: readonly RepositoryDocument[];

  /**
   * All detected conflicts.
   * Ordered deterministically: first by severity (descending),
   * then by category (ascending), then by ID (ascending).
   * @readonly
   */
  readonly conflicts: readonly RepositoryConflict[];

  /**
   * Overall repository health assessment.
   * @readonly
   */
  readonly health: RepositoryHealth;

  /**
   * Dependency graph edges.
   * Ordered deterministically by source ID, then target ID.
   * @readonly
   */
  readonly dependencies: readonly DependencyEdge[];

  /**
   * Discovered tags used in repository documents.
   * Ordered deterministically (ascending).
   * @readonly
   */
  readonly discoveredTags: readonly string[];

  /**
   * Count of distinct external references (specifications, standards).
   * @readonly
   */
  readonly externalReferenceCount: number;

  /**
   * Count of documents with missing versions.
   * @readonly
   */
  readonly unversionedDocumentCount: number;

  /**
   * Count of documents with missing titles.
   * @readonly
   */
  readonly untitledDocumentCount: number;

  /**
   * Count of documents with missing descriptions.
   * @readonly
   */
  readonly undescribedDocumentCount: number;

  /**
   * Analysis duration in milliseconds.
   * @readonly
   */
  readonly analysisDurationMs: number;

  /**
   * UTC timestamp when analysis began (ISO 8601).
   * @readonly
   */
  readonly analyzedAt: string;

  /**
   * The version of the analyzer that produced this report.
   * Format: "1.0.0"
   * @readonly
   */
  readonly analyzerVersion: string;

  /**
   * SHA256 checksum of complete report content.
   * Used for integrity verification and change detection.
   * @readonly
   */
  readonly reportChecksum: string;

  /**
   * Whether report generation completed successfully.
   * @readonly
   */
  readonly isValid: boolean;

  /**
   * Any errors or warnings that occurred during analysis.
   * @readonly
   */
  readonly diagnostics: readonly string[];
}

/**
 * Creates a minimal RepositoryReport for testing or initialization.
 *
 * @param repositoryRoot - Repository root path
 * @param documents - Analyzed documents
 * @returns RepositoryReport with default metrics
 */
export function createRepositoryReport(
  repositoryRoot: string,
  documents: readonly RepositoryDocument[],
): RepositoryReport {
  return {
    id: `report_${Date.now()}_v1`,
    title: 'Repository Analysis Report',
    description: 'Complete repository analysis',
    repositoryRoot,
    documents,
    conflicts: [],
    health: {
      overallScore: 100,
      criticalConflictCount: 0,
      majorConflictCount: 0,
      moderateConflictCount: 0,
      minorConflictCount: 0,
      authorityClassificationCoverage: 0,
      frozenDocumentPercentage: 0,
      versionedDocumentPercentage: 0,
      documentedTitlePercentage: 0,
      documentedDescriptionPercentage: 0,
      danglingReferenceCount: 0,
      circularDependencyCount: 0,
      averageReferencesPerDocument: 0,
      totalDocumentCount: documents.length,
      totalLineCount: documents.reduce((sum, doc) => sum + doc.lineCount, 0),
      totalSizeBytes: documents.reduce((sum, doc) => sum + doc.sizeBytes, 0),
      isPublishable: true,
      isDeterministic: true,
      calculatedAt: new Date().toISOString(),
      checksum: 'sha256_placeholder',
    },
    dependencies: [],
    discoveredTags: [],
    externalReferenceCount: 0,
    unversionedDocumentCount: 0,
    untitledDocumentCount: 0,
    undescribedDocumentCount: 0,
    analysisDurationMs: 0,
    analyzedAt: new Date().toISOString(),
    analyzerVersion: '1.0.0',
    reportChecksum: 'sha256_placeholder',
    isValid: true,
    diagnostics: [],
  };
}
