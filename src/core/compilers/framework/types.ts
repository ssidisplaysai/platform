/**
 * Genesis Compiler Framework Types
 *
 * Reusable type definitions for all Genesis compilers.
 * Pure framework types - no domain-specific knowledge.
 */

// ============================================================================
// PASS INTERFACE
// ============================================================================

export interface CompilerPass<TInput, TOutput> {
  /**
   * Unique pass identifier
   */
  passId: string;

  /**
   * Human-readable pass name
   */
  passName: string;

  /**
   * Pass version for tracking
   */
  passVersion: string;

  /**
   * IDs of passes this depends on
   */
  dependencies: string[];

  /**
   * Execute the pass
   *
   * @param state Current compilation state
   * @returns Pass result with output and diagnostics
   *
   * MUST NOT modify state.input
   * MUST NOT modify previous pass outputs
   */
  execute(state: CompilationState<TInput, any>): Promise<PassResult<TOutput>>;
}

// ============================================================================
// PASS RESULTS
// ============================================================================

export interface PassResult<TOutput> {
  passId: string;
  passVersion: string;
  output: TOutput;
  diagnostics: Diagnostic[];
  executionTimeMs: number;
  timestamp: string;
  status: "success" | "failed";
  error?: Error;
}

export interface PassMetrics {
  passId: string;
  executionOrder: number;
  executionTimeMs: number;
  diagnosticCounts: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  sourceElement?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
}

// ============================================================================
// ARTIFACT & VERSIONING
// ============================================================================

export interface ArtifactVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;

  toString(): string;
}

export interface ArtifactChecksum {
  algorithm: "SHA256";
  value: string;
}

export interface ArtifactIdentity {
  /**
   * Deterministic ID: prefix_hash_version
   * Example: BGC_abc123def456_v1
   */
  id: string;

  /**
   * Prefix (compiler name)
   */
  prefix: string;

  /**
   * Hash of canonical artifact
   */
  hash: string;

  /**
   * Identity schema version
   */
  schemaVersion: string;
}

// ============================================================================
// PROVENANCE & LINEAGE
// ============================================================================

export interface ProvenanceEntry {
  elementId: string;
  elementType: string;
  createdByPass: string;
  createdAtTimestamp: string;
  sourceElementIds: string[]; // Where this came from
}

export interface LineageEntry {
  fromElement: string;
  toElement: string;
  passId: string;
  timestamp: string;
  transformationType: string;
}

export interface ProvenanceIndex {
  entries: ProvenanceEntry[];
}

export interface LineageIndex {
  chain: LineageEntry[];
}

// ============================================================================
// MANIFEST
// ============================================================================

export interface CompilerManifest {
  compilerName: string;
  compilerVersion: string;
  compilationTimestamp: string;
  compilationDurationMs: number;
  passHistory: PassMetrics[];
  diagnosticSummary: DiagnosticSummary;
  checksums: Record<string, ArtifactChecksum>;
}

// ============================================================================
// PUBLICATION
// ============================================================================

export interface PublicationDecision {
  canPublish: boolean;
  blocked: boolean;
  reason?: string;
  blockedBy: string[]; // Validation rules that blocked publication
}

export interface PublicationResult {
  published: boolean;
  decision: PublicationDecision;
  timestamp: string;
  artifactId?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationRule {
  id: string;
  name: string;
  validate(artifact: any, context: any): Promise<ValidationRuleResult>;
}

export interface ValidationRuleResult {
  ruleId: string;
  passed: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export interface ValidationContext {
  compilerName: string;
  compilerVersion: string;
  previousPassResults?: Map<string, PassResult<any>>;
}

// ============================================================================
// EXECUTION METRICS
// ============================================================================

export interface CompilerExecutionMetrics {
  compilerName: string;
  compilerVersion: string;
  totalExecutionTimeMs: number;
  passMetrics: PassMetrics[];
  diagnosticSummary: DiagnosticSummary;
  qualityScore: number; // 0-100
}

// ============================================================================
// EXECUTION SUMMARY
// ============================================================================

export interface CompilerExecutionSummary {
  success: boolean;
  compilerName: string;
  compilerVersion: string;
  compilationStartTime: string;
  compilationEndTime: string;
  compilationDurationMs: number;
  passCount: number;
  passesCompleted: number;
  failedPassId?: string;
  failedPassError?: string;
  diagnosticSummary: DiagnosticSummary;
  metrics: CompilerExecutionMetrics;
  publicationDecision: PublicationDecision;
}

// ============================================================================
// COMPILATION STATE
// ============================================================================

/**
 * Immutable compilation state threaded through pipeline
 *
 * TInput: Type of input artifact
 * TIntermediate: Type of intermediate results map
 */
export interface CompilationState<TInput, TIntermediate = any> {
  /**
   * Original input artifact (immutable, never modified)
   */
  input: Readonly<TInput>;

  /**
   * Intermediate results from each pass
   * Key: passId, Value: PassResult<any>
   */
  intermediateResults: Map<string, PassResult<any>>;

  /**
   * Accumulated diagnostics
   */
  diagnostics: Diagnostic[];

  /**
   * Current pass being executed
   */
  currentPass: string | null;

  /**
   * Compilation metadata
   */
  metadata: CompilationStateMetadata;

  /**
   * Provenance tracking
   */
  provenance: ProvenanceIndex;

  /**
   * Lineage tracking
   */
  lineage: LineageIndex;
}

export interface CompilationStateMetadata {
  compilerName: string;
  compilerVersion: string;
  startTime: string;
  currentPassIndex: number;
  totalPasses: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CompilerConfiguration {
  /**
   * Enable diagnostic collection
   */
  collectDiagnostics: boolean;

  /**
   * Enable metrics collection
   */
  collectMetrics: boolean;

  /**
   * Enable provenance tracking
   */
  trackProvenance: boolean;

  /**
   * Enable lineage tracking
   */
  trackLineage: boolean;

  /**
   * Fail on first error
   */
  failFast: boolean;

  /**
   * Maximum allowed errors before stopping
   */
  maxErrors: number;

  /**
   * Compiler-specific configuration
   */
  extra?: Record<string, any>;
}

// ============================================================================
// CAPABILITIES
// ============================================================================

export interface CompilerCapabilities {
  /**
   * Does compiler guarantee deterministic execution?
   */
  deterministicExecution: boolean;

  /**
   * Does compiler guarantee input immutability?
   */
  immutableInput: boolean;

  /**
   * Does compiler support publication gating?
   */
  publicationGating: boolean;

  /**
   * Does compiler collect complete audit trail?
   */
  auditTrail: boolean;

  /**
   * Does compiler support incremental compilation?
   */
  incrementalCompilation: boolean;

  /**
   * Does compiler support parallel pass execution?
   */
  parallelExecution: boolean;

  /**
   * Custom capabilities
   */
  extra?: Record<string, boolean>;
}

// ============================================================================
// COMPILER RESULT
// ============================================================================

export interface CompilerResult<TArtifact> {
  /**
   * Compilation succeeded
   */
  success: boolean;

  /**
   * Output artifact (if successful)
   */
  artifact?: TArtifact;

  /**
   * Compilation metadata
   */
  metadata: CompilerMetadata;

  /**
   * Execution summary
   */
  summary: CompilerExecutionSummary;

  /**
   * Collected diagnostics
   */
  diagnostics: Diagnostic[];

  /**
   * Execution metrics
   */
  metrics: CompilerExecutionMetrics;

  /**
   * Provenance index
   */
  provenance: ProvenanceIndex;

  /**
   * Lineage index
   */
  lineage: LineageIndex;

  /**
   * Error (if failed)
   */
  error?: Error;
}

// ============================================================================
// COMPILER METADATA
// ============================================================================

export interface CompilerMetadata {
  /**
   * Unique artifact identity
   */
  artifactIdentity: ArtifactIdentity;

  /**
   * Artifact version
   */
  artifactVersion: ArtifactVersion;

  /**
   * Compilation manifest
   */
  manifest: CompilerManifest;

  /**
   * Schema version
   */
  schemaVersion: string;

  /**
   * Compiler version
   */
  compilerVersion: string;

  /**
   * Compilation timestamp
   */
  compilationTimestamp: string;

  /**
   * Input artifact checksum
   */
  inputChecksum: ArtifactChecksum;

  /**
   * Output artifact checksum (if available)
   */
  outputChecksum?: ArtifactChecksum;

  /**
   * Is artifact published?
   */
  published: boolean;

  /**
   * Publication metadata
   */
  publicationDecision: PublicationDecision;

  /**
   * Custom metadata
   */
  extra?: Record<string, any>;
}
