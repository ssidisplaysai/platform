/**
 * RepositoryConflict.ts
 * Represents a detected conflict in repository documentation.
 *
 * Conflicts represent inconsistencies, contradictions, or alignment issues
 * discovered during repository analysis. Each conflict is categorized by
 * severity and includes actionable diagnostic information.
 */

/**
 * Severity level of a repository conflict.
 */
export enum ConflictSeverity {
  /** Critical conflict that blocks publication. */
  CRITICAL = 'CRITICAL',

  /** Major conflict requiring resolution. */
  MAJOR = 'MAJOR',

  /** Moderate conflict needing attention. */
  MODERATE = 'MODERATE',

  /** Minor conflict that may be deferred. */
  MINOR = 'MINOR',

  /** Informational conflict for awareness. */
  INFORMATIONAL = 'INFORMATIONAL',
}

/**
 * Category classification for repository conflicts.
 */
export enum ConflictCategory {
  /** Contradictory statements in different documents. */
  CONTRADICTION = 'CONTRADICTION',

  /** Incomplete or missing information. */
  INCOMPLETENESS = 'INCOMPLETENESS',

  /** Ambiguous or unclear specification. */
  AMBIGUITY = 'AMBIGUITY',

  /** Missing or broken reference. */
  DANGLING_REFERENCE = 'DANGLING_REFERENCE',

  /** Circular dependency detected. */
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',

  /** Authority or governance violation. */
  AUTHORITY_CONFLICT = 'AUTHORITY_CONFLICT',

  /** Schema or format violation. */
  SCHEMA_VIOLATION = 'SCHEMA_VIOLATION',

  /** Version or compatibility issue. */
  VERSION_CONFLICT = 'VERSION_CONFLICT',

  /** Naming or identifier conflict. */
  IDENTIFIER_CONFLICT = 'IDENTIFIER_CONFLICT',

  /** Unclassified conflict. */
  OTHER = 'OTHER',
}

/**
 * Represents a detected conflict in the repository.
 *
 * Conflicts are immutable records of inconsistencies or issues discovered
 * during analysis. They include the affected documents, conflict description,
 * and recommended resolution path.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface RepositoryConflict {
  /**
   * Deterministic conflict identifier.
   * Format: `conflict_<sha256-of-canonical-description>_v1`
   * @readonly
   */
  readonly id: string;

  /**
   * Primary conflict category.
   * @readonly
   */
  readonly category: ConflictCategory;

  /**
   * Severity level of this conflict.
   * @readonly
   */
  readonly severity: ConflictSeverity;

  /**
   * Human-readable title describing the conflict.
   * @readonly
   */
  readonly title: string;

  /**
   * Detailed description of the conflict and why it was flagged.
   * @readonly
   */
  readonly description: string;

  /**
   * IDs of the primary document(s) involved in the conflict.
   * @readonly
   */
  readonly affectedDocumentIds: readonly string[];

  /**
   * IDs of any secondary documents involved or referenced.
   * @readonly
   */
  readonly relatedDocumentIds: readonly string[];

  /**
   * Specific line numbers in primary document(s) where conflict occurs.
   * Format: "filepath:lineNumber" or "filepath:startLine-endLine"
   * @readonly
   */
  readonly locations: readonly string[];

  /**
   * Suggested remediation or resolution step.
   * @readonly
   */
  readonly suggestedResolution: string;

  /**
   * Classification tags for filtering or grouping conflicts.
   * @readonly
   */
  readonly tags: readonly string[];

  /**
   * Whether this conflict has been acknowledged/addressed.
   * @readonly
   */
  readonly isResolved: boolean;

  /**
   * If resolved, the resolution method applied.
   * @readonly
   */
  readonly resolutionMethod: string | null;

  /**
   * If resolved, the timestamp when resolved (ISO 8601).
   * @readonly
   */
  readonly resolvedAt: string | null;

  /**
   * UTC timestamp when conflict was detected (ISO 8601).
   * @readonly
   */
  readonly detectedAt: string;
}

/**
 * Creates a RepositoryConflict for testing or diagnostics.
 *
 * @param category - Conflict category
 * @param severity - Conflict severity
 * @param title - Conflict title
 * @param affectedDocumentIds - Document IDs involved
 * @returns RepositoryConflict
 */
export function createRepositoryConflict(
  category: ConflictCategory,
  severity: ConflictSeverity,
  title: string,
  affectedDocumentIds: readonly string[],
): RepositoryConflict {
  return {
    id: `conflict_${title.toLowerCase().replace(/\s+/g, '_')}_v1`,
    category,
    severity,
    title,
    description: '',
    affectedDocumentIds,
    relatedDocumentIds: [],
    locations: [],
    suggestedResolution: '',
    tags: [],
    isResolved: false,
    resolutionMethod: null,
    resolvedAt: null,
    detectedAt: new Date().toISOString(),
  };
}
