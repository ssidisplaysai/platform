/**
 * Authority.ts
 * Represents the authority classification of a repository document.
 *
 * Authority classification determines the canonical weight and governance
 * authority of documentation artifacts within the repository. Documents are
 * classified into hierarchical authority levels that govern conflict resolution
 * and specification precedence.
 */

/**
 * Authority level classification for repository documents.
 *
 * Authority levels establish precedence hierarchies for specification conflicts.
 * Higher authority levels take precedence in conflict resolution.
 */
export enum AuthorityLevel {
  /** Constitutional or foundational standard (immutable). */
  CONSTITUTIONAL = 'CONSTITUTIONAL',

  /** Normative standard (binding specification). */
  NORMATIVE = 'NORMATIVE',

  /** Architecture decision (approved by review board). */
  ARCHITECTURAL = 'ARCHITECTURAL',

  /** Implementation guidance (recommended but not binding). */
  GUIDANCE = 'GUIDANCE',

  /** Informational documentation (for reference). */
  INFORMATIONAL = 'INFORMATIONAL',

  /** Unclassified or unknown authority. */
  UNCLASSIFIED = 'UNCLASSIFIED',
}

/**
 * Represents the authority classification of a document.
 *
 * Authority classification is deterministically derived from document
 * structure, location, and naming conventions. Documents at different
 * authority levels have different conflict resolution priority.
 *
 * @readonly All properties are read-only to prevent mutation after creation.
 */
export interface Authority {
  /**
   * The authority level classification.
   * @readonly
   */
  readonly level: AuthorityLevel;

  /**
   * Human-readable name of this authority level.
   * @readonly
   */
  readonly displayName: string;

  /**
   * Canonical namespace for this authority (e.g., "genesis/constitution").
   * Used for organizing related documents at this authority level.
   * @readonly
   */
  readonly namespace: string;

  /**
   * Whether documents at this level can override lower authority documents.
   * @readonly
   */
  readonly canOverride: readonly AuthorityLevel[];

  /**
   * Precedence number for deterministic ordering.
   * Higher values take precedence in conflicts.
   * Used for stable sorting when multiple authorities are involved.
   * @readonly
   */
  readonly precedence: number;

  /**
   * Whether this authority level is considered frozen/immutable.
   * @readonly
   */
  readonly isFrozen: boolean;

  /**
   * Human-readable description of this authority level.
   * @readonly
   */
  readonly description: string;
}

/**
 * Creates a canonical Authority object for the given level.
 *
 * Authority objects are created deterministically based on the
 * AuthorityLevel enum. Each level has a fixed definition.
 *
 * @param level - The authority level
 * @returns Authority object with complete definition
 */
export function createAuthority(level: AuthorityLevel): Authority {
  const authorities: Record<AuthorityLevel, Authority> = {
    [AuthorityLevel.CONSTITUTIONAL]: {
      level: AuthorityLevel.CONSTITUTIONAL,
      displayName: 'Constitutional',
      namespace: 'genesis/constitution',
      canOverride: [],
      precedence: 100,
      isFrozen: true,
      description: 'Constitutional or foundational standard (immutable)',
    },
    [AuthorityLevel.NORMATIVE]: {
      level: AuthorityLevel.NORMATIVE,
      displayName: 'Normative',
      namespace: 'genesis/standards',
      canOverride: [
        AuthorityLevel.ARCHITECTURAL,
        AuthorityLevel.GUIDANCE,
        AuthorityLevel.INFORMATIONAL,
        AuthorityLevel.UNCLASSIFIED,
      ],
      precedence: 80,
      isFrozen: true,
      description: 'Normative standard (binding specification)',
    },
    [AuthorityLevel.ARCHITECTURAL]: {
      level: AuthorityLevel.ARCHITECTURAL,
      displayName: 'Architectural',
      namespace: 'genesis/architecture',
      canOverride: [
        AuthorityLevel.GUIDANCE,
        AuthorityLevel.INFORMATIONAL,
        AuthorityLevel.UNCLASSIFIED,
      ],
      precedence: 60,
      isFrozen: false,
      description: 'Architecture decision (approved by review board)',
    },
    [AuthorityLevel.GUIDANCE]: {
      level: AuthorityLevel.GUIDANCE,
      displayName: 'Guidance',
      namespace: 'genesis/guidance',
      canOverride: [AuthorityLevel.INFORMATIONAL, AuthorityLevel.UNCLASSIFIED],
      precedence: 40,
      isFrozen: false,
      description: 'Implementation guidance (recommended but not binding)',
    },
    [AuthorityLevel.INFORMATIONAL]: {
      level: AuthorityLevel.INFORMATIONAL,
      displayName: 'Informational',
      namespace: 'genesis/info',
      canOverride: [AuthorityLevel.UNCLASSIFIED],
      precedence: 20,
      isFrozen: false,
      description: 'Informational documentation (for reference)',
    },
    [AuthorityLevel.UNCLASSIFIED]: {
      level: AuthorityLevel.UNCLASSIFIED,
      displayName: 'Unclassified',
      namespace: 'genesis/unclassified',
      canOverride: [],
      precedence: 0,
      isFrozen: false,
      description: 'Unclassified or unknown authority',
    },
  };

  return authorities[level];
}
