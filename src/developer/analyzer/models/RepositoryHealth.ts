/**
 * RepositoryHealth.ts
 * Represents the overall health and quality metrics of the repository.
 *
 * Health metrics provide a comprehensive view of repository quality,
 * including document coverage, conflict distribution, authority alignment,
 * and determinism verification.
 */

/**
 * Represents overall repository health assessment.
 *
 * Health metrics are computed from document statistics, conflict data,
 * and authority alignment checks. The overall health score is derived from
 * weighted component scores.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface RepositoryHealth {
  /**
   * Overall health score (0-100, inclusive).
   * Higher values indicate better health.
   * Calculated as weighted average of component scores.
   * @readonly
   */
  readonly overallScore: number;

  /**
   * Count of critical conflicts (publication blockers).
   * @readonly
   */
  readonly criticalConflictCount: number;

  /**
   * Count of major conflicts (should be addressed soon).
   * @readonly
   */
  readonly majorConflictCount: number;

  /**
   * Count of moderate conflicts (should be addressed).
   * @readonly
   */
  readonly moderateConflictCount: number;

  /**
   * Count of minor conflicts (nice to address).
   * @readonly
   */
  readonly minorConflictCount: number;

  /**
   * Percentage of documents with authority classification (0-100).
   * @readonly
   */
  readonly authorityClassificationCoverage: number;

  /**
   * Percentage of documents that are frozen/immutable (0-100).
   * @readonly
   */
  readonly frozenDocumentPercentage: number;

  /**
   * Percentage of documents with version information (0-100).
   * @readonly
   */
  readonly versionedDocumentPercentage: number;

  /**
   * Percentage of documents with titles extracted (0-100).
   * @readonly
   */
  readonly documentedTitlePercentage: number;

  /**
   * Percentage of documents with descriptions extracted (0-100).
   * @readonly
   */
  readonly documentedDescriptionPercentage: number;

  /**
   * Count of dangling references (broken links).
   * @readonly
   */
  readonly danglingReferenceCount: number;

  /**
   * Count of detected circular dependencies.
   * @readonly
   */
  readonly circularDependencyCount: number;

  /**
   * Average number of references per document.
   * @readonly
   */
  readonly averageReferencesPerDocument: number;

  /**
   * Total count of analyzed documents.
   * @readonly
   */
  readonly totalDocumentCount: number;

  /**
   * Total lines of analyzed documentation.
   * @readonly
   */
  readonly totalLineCount: number;

  /**
   * Total size of analyzed documentation in bytes.
   * @readonly
   */
  readonly totalSizeBytes: number;

  /**
   * Whether repository is in publishable state (no critical conflicts).
   * @readonly
   */
  readonly isPublishable: boolean;

  /**
   * Whether all analysis passed determinism verification.
   * @readonly
   */
  readonly isDeterministic: boolean;

  /**
   * UTC timestamp when health was calculated (ISO 8601).
   * @readonly
   */
  readonly calculatedAt: string;

  /**
   * SHA256 checksum of health snapshot for change detection.
   * @readonly
   */
  readonly checksum: string;
}

/**
 * Creates a RepositoryHealth object with default/empty state.
 *
 * @returns RepositoryHealth with zero conflicts and baseline metrics
 */
export function createRepositoryHealth(): RepositoryHealth {
  return {
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
    totalDocumentCount: 0,
    totalLineCount: 0,
    totalSizeBytes: 0,
    isPublishable: true,
    isDeterministic: true,
    calculatedAt: new Date().toISOString(),
    checksum: 'sha256_placeholder',
  };
}
