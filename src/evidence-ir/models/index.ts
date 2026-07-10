/**
 * Genesis Evidence IR — Evidence Intermediate Representation Models
 *
 * These are the canonical data structures for Stage 2 of the
 * Genesis Enterprise Compiler. They represent discovered evidence
 * in canonical form — suitable for deterministic compilation into
 * Business Genome.
 *
 * Pipeline position:
 *   Discovery Evidence → Evidence IR → Business Genome
 *
 * Requirements:
 *   • Fully compliant with EIR-0001 specification
 *   • Deterministic identity per GPS-0001
 *   • Canonical form per GPS-0002
 *   • Complete provenance preservation
 *   • No business inference or classification
 */

// ============================================================================
// Evidence Types (Form Types)
// ============================================================================

/**
 * The semantic category of a piece of evidence.
 * These are explicit evidence types, NOT business classifications.
 *
 * Per EIR-0001 Section 4: 12 semantic forms that evidence can take.
 * Compiler uses these to structure evidence semantics.
 */
export type EvidenceFormType =
  | 'statement'      // Direct fact: "I do X"
  | 'assertion'      // Claim: "This is required"
  | 'description'    // Definition: "A website is..."
  | 'constraint'     // Boundary: "We cannot do X"
  | 'decision'       // Choice: "We chose X over Y"
  | 'pain_point'     // Problem: "This is difficult because..."
  | 'capability'     // Ability: "We can do X"
  | 'need'           // Requirement: "We need X"
  | 'measurement'    // Metric: "We process X per day"
  | 'interaction'    // Process: "X happens, then Y happens"
  | 'obstacle'       // Barrier: "We are blocked by X"
  | 'opportunity';   // Potential: "We could do X";

/**
 * Severity levels for Evidence IR validation and diagnostics.
 */
export type EvidenceDiagnosticSeverity = 'info' | 'warning' | 'error';

/**
 * Standard diagnostic codes for Evidence IR compiler.
 */
export enum EvidenceDiagnosticCode {
  // Identity errors
  IDENTITY_MISMATCH = 'EIR_001',
  IDENTITY_INVALID = 'EIR_002',
  DUPLICATE_IDENTITY = 'EIR_003',

  // Canonicalization errors
  CANONICALIZATION_FAILED = 'EIR_010',
  INVALID_ENCODING = 'EIR_011',
  NORMALIZATION_FAILED = 'EIR_012',

  // Provenance errors
  MISSING_PROVENANCE = 'EIR_020',
  BROKEN_PROVENANCE = 'EIR_021',
  PROVENANCE_MISMATCH = 'EIR_022',

  // Relationship errors
  INVALID_REFERENCE = 'EIR_030',
  CIRCULAR_REFERENCE = 'EIR_031',
  MISSING_REFERENCE_TARGET = 'EIR_032',

  // Validation errors
  INVALID_FORM_TYPE = 'EIR_040',
  MISSING_REQUIRED_FIELD = 'EIR_041',
  INVALID_METADATA = 'EIR_042',
  INVALID_CONTENT = 'EIR_043',

  // Compiler errors
  TRANSFORMATION_FAILED = 'EIR_050',
  INVALID_INPUT = 'EIR_051',
  SCHEMA_VIOLATION = 'EIR_052',

  // Info messages
  EVIDENCE_CREATED = 'EIR_100',
  EVIDENCE_DEDUPLICATED = 'EIR_101',
  COLLECTION_CREATED = 'EIR_102',
}

// ============================================================================
// Provenance Models
// ============================================================================

/**
 * Reference to the Discovery Evidence that sourced this Evidence IR item.
 * Enables traceability back through all transformation stages.
 */
export interface EvidenceProvenance {
  /**
   * ID of the Discovery Question this evidence came from.
   * References: DiscoveryQuestion.id
   */
  discoveryQuestionId: string;

  /**
   * ID of the Discovery Answer this evidence came from.
   * References: DiscoveryAnswer.id
   */
  discoveryAnswerId: string;

  /**
   * ID of the Discovery Section containing this evidence.
   * References: DiscoverySection.id
   */
  discoverySectionId: string;

  /**
   * ID of the Discovery Interview this evidence came from.
   * References: DiscoveryInterview.id
   */
  discoveryInterviewId: string;

  /**
   * Source metadata from Discovery (participant, date, role, etc.)
   * Preserved exactly as discovered.
   */
  discoverySourceMetadata: {
    participant?: string;
    role?: string;
    department?: string;
    interviewDate?: string;
    interviewer?: string;
  };

  /**
   * Page number in original source where this evidence appears.
   */
  sourcePage: number;

  /**
   * Character offset within the source page (0-based).
   */
  sourceOffset: number;

  /**
   * Length of source text in characters.
   */
  sourceLength: number;

  /**
   * Version of Discovery Engine that produced the source evidence.
   */
  discoveryVersion: string;

  /**
   * Version of Evidence IR compiler that transformed this item.
   */
  evidenceIRCompilerVersion: string;

  /**
   * Version of Evidence IR schema.
   */
  evidenceIRSchemaVersion: string;

  /**
   * Timestamp of compilation (ISO 8601 UTC).
   * Note: Included for audit trails, not for determinism.
   */
  compiledAt: string;
}

// ============================================================================
// Metadata Models
// ============================================================================

/**
 * Standard metadata fields for all Evidence IR objects.
 * Per GPS-0002, metadata fields are ordered consistently.
 */
export interface EvidenceIRMetadata {
  /**
   * When this Evidence IR object was created (ISO 8601 UTC).
   * Not used for determinism; present for audit trails.
   */
  created: string;

  /**
   * Unique identity of this object per GPS-0001.
   * Format: <type>_<hash>_v<version>
   */
  identity: string;

  /**
   * Scope of this evidence (if applicable).
   * Examples: "department", "process", "role", null if unscoped
   */
  scope: string | null;

  /**
   * Version of this evidence item (v1, v2 if corrected).
   */
  version: number;
}

// ============================================================================
// Core Evidence Models
// ============================================================================

/**
 * An atomic piece of evidence — the fundamental unit of Evidence IR.
 *
 * Per EIR-0001 Section 4: An Evidence Item is a single, coherent
 * statement about discovered fact. It has:
 * • Canonical content (normalized per GPS-0002)
 * • Form type (statement, decision, constraint, etc.)
 * • Deterministic identity (per GPS-0001)
 * • Complete provenance back to discovery source
 * • Immutable representation
 */
export interface EvidenceItem {
  /**
   * Standard metadata (identity, version, created, scope).
   */
  metadata: EvidenceIRMetadata;

  /**
   * The semantic form of this evidence.
   * Per GPS-0002 canonicalization, form is normalized from discovery context.
   */
  formType: EvidenceFormType;

  /**
   * The canonical content of this evidence.
   * Normalized per GPS-0002:
   * • UTF-8 encoded
   * • Unicode NFC normalization
   * • Whitespace normalized
   * • Line endings normalized to LF
   * This is the EXACT content from discovery, not interpreted.
   */
  content: string;

  /**
   * Original raw content before any canonicalization.
   * Preserved for forensic analysis and re-canonicalization verification.
   */
  rawContent: string;

  /**
   * Complete provenance chain back to discovery source.
   * Enables forensic traceability.
   */
  provenance: EvidenceProvenance;

  /**
   * Relationships to other Evidence Items.
   * Enables Evidence Item connectivity.
   * Empty if no relationships.
   */
  relationships: {
    /**
     * IDs of related evidence items (per GPS-0001 identity format).
     */
    relatedItemIds: string[];

    /**
     * Implicit relationships derived from structure (not explicit facts).
     * Examples: "from_same_interview", "from_same_section"
     */
    structuralRelationships: string[];
  };

  /**
   * Validation results for this item.
   * Empty if no violations.
   */
  validationResults: {
    isValid: boolean;
    violations: Array<{
      code: EvidenceDiagnosticCode;
      severity: EvidenceDiagnosticSeverity;
      message: string;
    }>;
  };
}

/**
 * A collection of Evidence Items from a single discovery source.
 *
 * Per EIR-0001 Section 4: An Evidence Collection groups Evidence Items
 * from the same discovery source (e.g., one interview). All items
 * have same provenance origin but different items within collection.
 */
export interface EvidenceCollection {
  /**
   * Standard metadata.
   */
  metadata: EvidenceIRMetadata;

  /**
   * Reference to source interview (discovery evidence).
   */
  sourceInterviewId: string;

  /**
   * Source participant information.
   */
  sourceParticipant: {
    name?: string;
    role?: string;
    department?: string;
  };

  /**
   * All Evidence Items in this collection (deterministically ordered).
   */
  items: EvidenceItem[];

  /**
   * Statistics about this collection.
   */
  statistics: {
    totalItems: number;
    itemsByFormType: Record<EvidenceFormType, number>;
    validItems: number;
    itemsWithViolations: number;
  };

  /**
   * Collection-level validation results.
   */
  validationResults: {
    isValid: boolean;
    violations: Array<{
      code: EvidenceDiagnosticCode;
      severity: EvidenceDiagnosticSeverity;
      message: string;
    }>;
  };
}

/**
 * A processed Evidence Collection ready for downstream compilation.
 *
 * Per EIR-0001 Section 4: An Evidence Package is a validated,
 * deduplicated Evidence Collection ready for Business Genome compilation.
 */
export interface EvidencePackage {
  /**
   * Standard metadata.
   */
  metadata: EvidenceIRMetadata;

  /**
   * Source collections that were merged into this package.
   */
  sourceCollectionIds: string[];

  /**
   * Deduplicated evidence items (canonical identities guarantee no duplicates).
   */
  items: EvidenceItem[];

  /**
   * Deduplication results.
   */
  deduplicationResults: {
    totalInputItems: number;
    totalDeduplicatedItems: number;
    duplicateGroupsFound: number;
    duplicateMapping: Record<string, string>; // duplicate ID → canonical ID
  };

  /**
   * Cross-collection relationships discovered.
   */
  crossCollectionRelationships: Array<{
    fromCollectionId: string;
    toCollectionId: string;
    relationshipType: string;
    itemCount: number;
  }>;

  /**
   * Package-level validation.
   */
  validationResults: {
    isValid: boolean;
    violations: Array<{
      code: EvidenceDiagnosticCode;
      severity: EvidenceDiagnosticSeverity;
      message: string;
    }>;
  };
}

/**
 * The complete set of Evidence IR produced by the compiler.
 *
 * Per EIR-0001 Section 4: An Evidence Set is the complete canonical
 * evidence ready for Business Genome compilation. It includes all items,
 * collections, packages, metadata, and compiler results.
 */
export interface EvidenceSet {
  /**
   * Standard metadata.
   */
  metadata: EvidenceIRMetadata;

  /**
   * All collections produced.
   */
  collections: EvidenceCollection[];

  /**
   * All packages produced (deduplicated).
   */
  packages: EvidencePackage[];

  /**
   * All individual items (flattened for reference).
   */
  allItems: EvidenceItem[];

  /**
   * Global cross-reference information.
   */
  crossReferences: {
    totalItems: number;
    totalCollections: number;
    totalPackages: number;
    duplicatesRemoved: number;
    relationshipsFound: number;
  };

  /**
   * Set-level validation.
   */
  validationResults: {
    isValid: boolean;
    violations: Array<{
      code: EvidenceDiagnosticCode;
      severity: EvidenceDiagnosticSeverity;
      message: string;
    }>;
  };
}

/**
 * Manifest of compiled Evidence IR.
 * Documents all inputs, outputs, and compiler configuration.
 */
export interface EvidenceManifest {
  /**
   * Compiler version (e.g., "2.0.0").
   */
  compilerVersion: string;

  /**
   * Evidence IR schema version this was compiled against.
   */
  schemaVersion: string;

  /**
   * Compilation timestamp (ISO 8601 UTC).
   */
  compiledAt: string;

  /**
   * Input discovery evidence sources (e.g., "Zach", "Madison").
   */
  inputSources: Array<{
    name: string;
    interviewId: string;
    itemCount: number;
  }>;

  /**
   * Output artifacts produced.
   */
  outputArtifacts: {
    totalItems: number;
    totalCollections: number;
    totalPackages: number;
    totalDuplicatesRemoved: number;
    totalRelationshipsFound: number;
  };

  /**
   * Validation summary.
   */
  validationSummary: {
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    warningsIssued: number;
    errorsIssued: number;
  };

  /**
   * Canonicalization summary.
   */
  canonicalizationSummary: {
    totalItems: number;
    itemsCanonicalizedSuccessfully: number;
    canonicalizationErrors: number;
  };

  /**
   * Identity generation summary.
   */
  identitySummary: {
    totalIdentitiesGenerated: number;
    identityCollisions: number;
    hashAlgorithm: string;
    hashLength: number;
  };

  /**
   * Determinism verification.
   */
  determinismVerification: {
    executionCount: number;
    outputConsistent: boolean;
    outputHash: string;
  };
}

/**
 * Complete compiler result for Evidence IR transformation.
 */
export interface EvidenceIRCompilerResult {
  /**
   * Overall compilation success.
   */
  success: boolean;

  /**
   * Compiler version.
   */
  compilerVersion: string;

  /**
   * Compilation timestamp.
   */
  compiledAt: string;

  /**
   * Input evidence source.
   */
  inputSource: {
    type: string;
    sourceId: string;
    interviewId: string;
  };

  /**
   * Produced Evidence Set (if successful).
   */
  evidenceSet?: EvidenceSet;

  /**
   * Produced Manifest.
   */
  manifest: EvidenceManifest;

  /**
   * All compiler diagnostics (not just errors).
   */
  diagnostics: Array<{
    code: EvidenceDiagnosticCode;
    severity: EvidenceDiagnosticSeverity;
    message: string;
    context?: Record<string, unknown>;
  }>;

  /**
   * Compilation statistics.
   */
  statistics: {
    executionTimeMs: number;
    itemsProcessed: number;
    itemsSuccessful: number;
    itemsFailed: number;
    canonicalizationErrors: number;
    identityErrors: number;
    validationErrors: number;
  };

  /**
   * Any fatal errors that prevented compilation.
   */
  fatalErrors?: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isEvidenceItem(obj: unknown): obj is EvidenceItem {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as any;
  return (
    e.metadata &&
    e.formType &&
    typeof e.content === 'string' &&
    e.provenance
  );
}

export function isEvidenceCollection(obj: unknown): obj is EvidenceCollection {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as any;
  return (
    e.metadata &&
    Array.isArray(e.items) &&
    e.sourceInterviewId
  );
}

export function isEvidencePackage(obj: unknown): obj is EvidencePackage {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as any;
  return (
    e.metadata &&
    Array.isArray(e.items) &&
    Array.isArray(e.sourceCollectionIds)
  );
}

export function isEvidenceSet(obj: unknown): obj is EvidenceSet {
  if (typeof obj !== 'object' || obj === null) return false;
  const e = obj as any;
  return (
    e.metadata &&
    Array.isArray(e.collections) &&
    Array.isArray(e.packages) &&
    Array.isArray(e.allItems)
  );
}
