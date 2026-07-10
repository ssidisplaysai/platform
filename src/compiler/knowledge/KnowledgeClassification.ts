/**
 * IMPLEMENTS:
 * - GCS-0001 Stage 2 Evidence Compiler
 * - EKM-1.0 Enterprise Knowledge Model
 */

/**
 * Knowledge Classification
 *
 * Categorizes the nature of knowledge for organizational purposes.
 */
export enum KnowledgeClassification {
  /**
   * Extracted directly from evidence (highest confidence source)
   */
  EXTRACTED = 'extracted',

  /**
   * Inferred from multiple evidence sources
   */
  INFERRED = 'inferred',

  /**
   * Derived through logical reasoning
   */
  DERIVED = 'derived',

  /**
   * Observed behavior or outcomes
   */
  OBSERVED = 'observed',

  /**
   * Stated belief or opinion
   */
  STATED = 'stated',
}

/**
 * Knowledge Verification State
 *
 * Tracks the verification status of a knowledge object.
 */
export enum VerificationState {
  /**
   * Initial state - no verification performed
   */
  UNVERIFIED = 'unverified',

  /**
   * Verification in progress
   */
  VERIFYING = 'verifying',

  /**
   * Verified - no issues found
   */
  VERIFIED = 'verified',

  /**
   * Verified with conditions or caveats
   */
  VERIFIED_WITH_CAVEATS = 'verified_with_caveats',

  /**
   * Conflicting evidence found
   */
  CONFLICTED = 'conflicted',

  /**
   * Verification failed
   */
  VERIFICATION_FAILED = 'verification_failed',

  /**
   * Flagged for manual review
   */
  FLAGGED = 'flagged',
}

/**
 * Knowledge Scope
 *
 * Defines the applicability scope of knowledge.
 */
export interface KnowledgeScope {
  /**
   * Organizational unit or department
   */
  organization?: string;

  /**
   * Specific role or position
   */
  role?: string;

  /**
   * Geographic location
   */
  location?: string;

  /**
   * Time period or version
   */
  timeframe?: string;

  /**
   * Business domain
   */
  domain?: string;

  /**
   * Custom scope tags
   */
  tags?: string[];
}

/**
 * Knowledge Confidence
 *
 * Represents the confidence level in a knowledge object.
 * Range: [0, 1] where 0 = no confidence, 1 = complete confidence
 */
export interface KnowledgeConfidence {
  /**
   * Initial confidence level when created
   */
  initial: number;

  /**
   * Current confidence level after verification
   */
  current: number;

  /**
   * Confidence calculation method
   */
  method?: string;

  /**
   * Factors affecting confidence
   */
  factors?: {
    [key: string]: number;
  };

  /**
   * Last updated timestamp
   */
  lastUpdated?: string;
}

/**
 * Validate confidence value
 */
export function isValidConfidence(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

/**
 * Knowledge Lineage
 *
 * Traces the knowledge back to its source.
 */
export interface KnowledgeLineage {
  /**
   * Immediate source: Evidence ID that created this knowledge
   */
  sourceEvidenceId: string;

  /**
   * All contributing evidence IDs (for derived knowledge)
   */
  contributingEvidenceIds?: string[];

  /**
   * Compiler version that created this
   */
  compilerVersion: string;

  /**
   * Compilation timestamp
   */
  compiledAt: string;

  /**
   * Processing stage that created this
   */
  stage: string;

  /**
   * Trace path from reality to this knowledge object
   */
  tracePath?: string[];
}

/**
 * Knowledge Version
 *
 * Tracks versioning of knowledge objects.
 */
export interface KnowledgeVersion {
  /**
   * Semantic version (major.minor.patch)
   */
  semver: string;

  /**
   * Revision number
   */
  revision: number;

  /**
   * Timestamp of this version
   */
  timestamp: string;

  /**
   * Reason for version change
   */
  reason?: string;

  /**
   * Previous version ID
   */
  previousVersionId?: string;
}

/**
 * Knowledge Metadata
 *
 * Additional metadata about the knowledge object.
 */
export interface KnowledgeMetadata {
  /**
   * Canonical name (human-readable)
   */
  canonicalName: string;

  /**
   * Full description
   */
  description?: string;

  /**
   * Owner or responsible party
   */
  owner?: string;

  /**
   * Semantic references (related concepts)
   */
  semanticReferences?: {
    [key: string]: string;
  };

  /**
   * Source references
   */
  sourceReferences?: {
    document?: string;
    interview?: string;
    page?: number;
    block?: string;
  };

  /**
   * Custom attributes
   */
  attributes?: {
    [key: string]: unknown;
  };
}
