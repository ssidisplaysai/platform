import type { CompilerDiagnostic } from "../core/types";
import type { EvidenceIR } from "../evidence/EvidenceIR";
import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "../core/stableStringify";
import type { BusinessGenomeCompilerInput } from "./types";

export const BGC_ARCHITECTURAL_PASS_ORDER = [
  "bgc.input-validation",
  "bgc.canonical-verification",
  "bgc.evidence-grouping",
  "bgc.evidence-correlation",
  "bgc.semantic-resolution",
  "bgc.semantic-consolidation",
  "bgc.relationship-resolution",
  "bgc.identity-assignment",
  "bgc.graph-construction",
  "bgc.consistency-validation",
  "bgc.business-genome-publication",
] as const;

export type BusinessGenomePassId = (typeof BGC_ARCHITECTURAL_PASS_ORDER)[number];

export interface BusinessGenomePipelineState {
  readonly input: BusinessGenomeCompilerInput;
  readonly sourceEvidenceIrIdentity: string;
  readonly evidenceIR: EvidenceIR;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly deterministicOrderingContext: {
    readonly evidenceNodeOrder: readonly string[];
    readonly evidenceRelationshipOrder: readonly string[];
  };
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly canonicalMetadata: BusinessGenomeCompilerInput["canonicalMetadata"];
}

export interface ValidatedEvidenceReference {
  readonly evidenceNodeId: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly origin: string;
  readonly evidenceChecksum?: string;
  readonly metadataRef: Readonly<Record<string, unknown>>;
  readonly provenanceRef: {
    readonly sourceId: string;
    readonly parentNodeIds: readonly string[];
    readonly transformationSteps: readonly string[];
  };
}

export interface ValidatedEvidenceIRView {
  readonly sourceEvidenceIrIdentity: string;
  readonly evidenceIR: EvidenceIR;
  readonly evidenceItemIds: readonly string[];
  readonly evidenceReferences: readonly ValidatedEvidenceReference[];
  readonly sourceReferences: readonly string[];
  readonly canonicalMetadata: BusinessGenomePipelineState["canonicalMetadata"];
  readonly upstreamValidation: BusinessGenomePipelineState["input"]["upstreamValidation"];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passHistory: BusinessGenomePipelineState["passHistory"];
  readonly deterministicOrderingContext: BusinessGenomePipelineState["deterministicOrderingContext"];
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly validationStatus: "valid" | "invalid";
}

export interface CanonicalEvidenceAttestation {
  readonly sourceEvidenceIrIdentity: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly verificationStatus: "verified" | "verified-with-gaps" | "failed";
  readonly verifiedChecks: readonly string[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly checksumReferences: readonly string[];
  readonly passId: string;
  readonly passVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly validatedEvidence: ValidatedEvidenceIRView;
}

export interface GroupedEvidenceSet {
  readonly id: string;
  readonly groupingRuleId: string;
  readonly groupingRuleVersion: string;
  readonly deterministicGroupKey: string;
  readonly evidenceItemIds: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly sourceEvidenceIrIdentity: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly explicitConflictIndicators: readonly string[];
}

export interface GroupedEvidenceCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly groups: readonly GroupedEvidenceSet[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly groupingRuleId: string;
  readonly groupingRuleVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly canonicalAttestation: CanonicalEvidenceAttestation;
}

export interface CorrelationBasis {
  readonly ruleId: string;
  readonly participatingGroupIds: readonly string[];
  readonly details: Readonly<Record<string, unknown>>;
}

export interface EvidenceCluster {
  readonly id: string;
  readonly correlationRuleIds: readonly string[];
  readonly correlationRuleVersion: string;
  readonly deterministicClusterKey: string;
  readonly memberGroupIds: readonly string[];
  readonly evidenceItemIds: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly sourceEvidenceIrIdentity: string;
  readonly correlationBases: readonly CorrelationBasis[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly explicitConflictIndicators: readonly string[];
}

export interface CorrelatedEvidenceCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly clusters: readonly EvidenceCluster[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly correlationRuleVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly groupedEvidence: GroupedEvidenceCollection;
}

export interface BusinessGenomePassResult<TOutput> {
  readonly passId: string;
  readonly passVersion: string;
  readonly output: TOutput;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly fatal: boolean;
}

// ─── Semantic Resolution (BGC-PASS-005) ────────────────────────────────────

/**
 * A single explicit evidence signal that supports a semantic class assignment.
 * Recorded in every SemanticCandidate for full auditability.
 */
export interface SemanticEvidenceSignal {
  readonly evidenceItemId: string;
  readonly signalField: string;
  readonly signalValue: string;
  readonly semanticClass: string;
  readonly ruleId: string;
  /** Stable rationale code: BGC-RATIONALE-001 / BGC-RATIONALE-002 / BGC-RATIONALE-003 */
  readonly rationaleCode: string;
}

/**
 * A single evidence-backed assertion about a SemanticCandidate.
 */
export interface SemanticAssertion {
  readonly assertionId: string;
  readonly attribute: string;
  readonly value: unknown;
  readonly evidenceItemIds: readonly string[];
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rationaleCode: string;
}

/**
 * Records an irreconcilable conflict detected during Semantic Resolution.
 * Preserved for downstream governed resolution stages.
 */
export interface SemanticConflictReference {
  readonly conflictId: string;
  readonly conflictingSemanticClasses: readonly string[];
  readonly conflictingRuleIds: readonly string[];
  readonly evidenceClusterIds: readonly string[];
  readonly notes: readonly string[];
}

/**
 * Describes a semantic resolution rule: a stable, versioned, deterministic
 * rule that maps explicit evidence signals to a candidate semantic class.
 */
export interface SemanticResolutionRule {
  readonly id: string;
  readonly version: string;
  readonly targetSemanticClass: string;
  readonly description: string;
  readonly requiredSignalField: string;
  readonly requiredSignalValue: string;
  readonly rationaleCode: string;
}

/**
 * Context tracking which rule and compiler version produced this candidate.
 */
export interface SemanticResolutionContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rationaleCode: string;
}

/**
 * A provisional, evidence-backed semantic meaning candidate.
 *
 * Identity is stage-appropriate (bgc-sc prefix) and deterministic.
 * Not a final canonical Business Genome identity.
 */
export interface SemanticCandidate {
  readonly id: string;
  readonly semanticClass: string;
  readonly designation: string;
  readonly assertions: readonly SemanticAssertion[];
  readonly evidenceClusterIds: readonly string[];
  readonly evidenceGroupIds: readonly string[];
  readonly evidenceItemIds: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly sourceEvidenceIrIdentity: string;
  readonly resolutionRuleId: string;
  readonly resolutionRuleVersion: string;
  readonly certainty: {
    readonly state: "certain" | "uncertain";
    readonly confidence: number;
  };
  readonly conflictReferences: readonly SemanticConflictReference[];
  readonly validationStatus: {
    readonly valid: boolean;
    readonly violations: readonly string[];
  };
  readonly resolutionContext: SemanticResolutionContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Per-cluster semantic resolution result.
 * May contain zero or one candidates (no candidate on unsupported or conflict).
 */
export interface SemanticResolutionResult {
  readonly clusterId: string;
  readonly candidates: readonly SemanticCandidate[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly unsupported: boolean;
  readonly unsupportedReason?: string;
}

/**
 * The complete output of BGC-PASS-005 (Semantic Resolution).
 *
 * Contains all provisional semantic candidates and per-cluster resolution
 * results. Business Genome is NOT published here.
 */
export interface SemanticCandidateCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly candidates: readonly SemanticCandidate[];
  readonly resolutionResults: readonly SemanticResolutionResult[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly correlatedEvidence: CorrelatedEvidenceCollection;
}

// ─── Semantic Consolidation (BGC-PASS-006) ────────────────────────────────────

/**
 * A deterministic merge rule for consolidating equivalent semantic candidates.
 * Only supports explicit, governed, deterministic matching:
 * - identical semantic class
 * - identical normalized designation
 * - identical semantic identity hash
 * - explicit governed equivalence metadata
 */
export interface SemanticMergeRule {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly matchCriteria: "identical-class-and-designation" | "identical-semantic-identity" | "explicit-equivalence-metadata";
  readonly rationaleCode: string;
}

/**
 * Records which merge rule was applied to consolidate candidates.
 */
export interface SemanticMergeContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly matchCriteria: string;
  readonly mergedCandidateIds: readonly string[];
}

/**
 * A consolidated semantic entity representing multiple equivalent candidates.
 *
 * All contributing candidates are preserved in contributingCandidates[].
 * All evidence from all candidates is preserved.
 * Conflicts (if any) remain explicit.
 *
 * Identity is stage-appropriate (bgc-cse prefix) and deterministic.
 * NOT a final canonical Business Genome identity.
 */
export interface ConsolidatedSemantic {
  readonly id: string;
  readonly semanticClass: string;
  readonly designation: string;
  readonly canonicalDesignation?: string;
  readonly assertions: readonly SemanticAssertion[];
  readonly contributingCandidates: readonly SemanticCandidate[];
  readonly mergedCandidateCount: number;
  readonly evidenceClusterIds: readonly string[];
  readonly evidenceGroupIds: readonly string[];
  readonly evidenceItemIds: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly sourceEvidenceIrIdentity: string;
  readonly conflictReferences: readonly SemanticConflictReference[];
  readonly hasConflicts: boolean;
  readonly consolidationRuleId: string;
  readonly consolidationRuleVersion: string;
  readonly certainty: {
    readonly state: "certain" | "uncertain";
    readonly confidence: number;
  };
  readonly validationStatus: {
    readonly valid: boolean;
    readonly violations: readonly string[];
  };
  readonly consolidationContext: SemanticMergeContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Per-consolidation result showing which candidates were merged and why.
 */
export interface SemanticMergeResult {
  readonly consolidatedSemanticId: string;
  readonly mergedCandidateIds: readonly string[];
  readonly mergeRuleId: string;
  readonly matchCriteria: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * The complete output of BGC-PASS-006 (Semantic Consolidation).
 *
 * Contains all consolidated semantic entities (each may represent one or more
 * equivalent candidates). All evidence, provenance, and conflicts preserved.
 *
 * Business Genome is NOT published here.
 */
export interface ConsolidatedSemanticCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly consolidatedSemantics: readonly ConsolidatedSemantic[];
  readonly mergeResults: readonly SemanticMergeResult[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly consolidationRuleVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly semanticCandidates: SemanticCandidateCollection;
}

// ─── Relationship Resolution (BGC-PASS-007) ───────────────────────────────

/**
 * A single relationship rule: versioned, deterministic, auditable.
 * Rules are evidence-backed and independently testable.
 */
export interface RelationshipRule {
  readonly id: string;
  readonly version: string;
  readonly relationshipType: string;
  readonly sourceSemanticClass: string;
  readonly targetSemanticClass: string;
  readonly description: string;
  readonly requiredEvidenceSignal: string;
  readonly rationaleCode: string;
}

/**
 * Context tracking which rule and compiler version produced this relationship.
 */
export interface RelationshipResolutionContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rationaleCode: string;
}

/**
 * Per-relationship merge result tracking which consolidation operation occurred.
 */
export interface RelationshipResolutionResult {
  readonly relationshipId: string;
  readonly sourceConsolidatedSemanticId: string;
  readonly targetConsolidatedSemanticId: string;
  readonly relationshipType: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly applied: boolean;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * An explicit, evidence-backed semantic relationship between consolidated concepts.
 *
 * Identity is stage-appropriate (bgc-rel prefix) and deterministic.
 * Not a final canonical Business Genome identity.
 */
export interface ResolvedRelationship {
  readonly id: string;
  readonly relationshipType: string;
  readonly sourceConsolidatedSemanticId: string;
  readonly targetConsolidatedSemanticId: string;
  readonly sourceSemanticClass: string;
  readonly targetSemanticClass: string;
  readonly resolutionRuleId: string;
  readonly resolutionRuleVersion: string;
  readonly evidenceClusterIds: readonly string[];
  readonly evidenceGroupIds: readonly string[];
  readonly evidenceItemIds: readonly string[];
  readonly provenanceReferences: readonly string[];
  readonly sourceEvidenceIrIdentity: string;
  readonly certainty: {
    readonly state: "certain" | "uncertain";
    readonly confidence: number;
  };
  readonly conflictReferences: readonly SemanticConflictReference[];
  readonly validationStatus: {
    readonly valid: boolean;
    readonly violations: readonly string[];
  };
  readonly resolutionContext: RelationshipResolutionContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * The complete output of BGC-PASS-007 (Relationship Resolution).
 *
 * Contains all explicit, evidence-backed relationships between consolidated
 * semantic concepts. Business Genome graph NOT constructed here.
 */
export interface ResolvedRelationshipCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly relationships: readonly ResolvedRelationship[];
  readonly resolutionResults: readonly RelationshipResolutionResult[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly relationshipRuleVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly consolidatedSemantics: ConsolidatedSemanticCollection;
}

// ─── Identity Assignment (BGC-PASS-008) ───────────────────────────────────

/**
 * A canonical Business Genome identity assigned to a semantic object or relationship.
 * Follows GPS-0001 and GPS-0002 standards. Immutable and deterministic.
 */
export interface BusinessGenomeIdentity {
  readonly id: string;  // Canonical identity (bg.object.class.hash or bg.relationship.type.hash)
  readonly kind: "semantic-object" | "semantic-relationship";
  readonly semanticClass?: string;  // For objects: customer, supplier, product, etc.
  readonly relationshipType?: string;  // For relationships: purchased, governs, owns, etc.
  readonly sourceConsolidatedSemanticId: string;  // Object: which consolidated semantic
  readonly sourceRelationshipId?: string;  // Relationship: which resolved relationship
  readonly assignedAt: string;  // ISO timestamp of assignment
  readonly assignmentRuleId: string;  // Which rule assigned this identity
  readonly assignmentRuleVersion: string;  // Rule version
  readonly assignmentVersion: string;  // GPS-0001 version
  readonly evidenceLineage: readonly string[];  // All evidence items backing this identity
  readonly provenanceReferences: readonly string[];  // Full provenance trail
  readonly sourceEvidenceIrIdentity: string;  // Root evidence ID
  readonly certainty: { state: "certain" | "uncertain"; confidence: number };
  readonly validationStatus: { valid: boolean; violations: readonly string[] };
  readonly assignmentContext: IdentityAssignmentContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * An identity assignment rule: versioned, deterministic, auditable.
 * Rules follow GPS-0001 canonical identity standards.
 */
export interface IdentityAssignmentRule {
  readonly id: string;
  readonly version: string;
  readonly applicableTo: "semantic-object" | "semantic-relationship";
  readonly description: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly rationaleCode: string;
}

/**
 * Context tracking which rule and compiler version assigned this identity.
 */
export interface IdentityAssignmentContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rationaleCode: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
}

/**
 * Per-identity assignment result tracking outcome.
 */
export interface IdentityAssignmentResult {
  readonly canonicalId: string;
  readonly sourceSemanticId: string;
  readonly assigned: boolean;
  readonly assignmentRuleId: string;
  readonly assignmentRuleVersion: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * The complete output of BGC-PASS-008 (Identity Assignment).
 *
 * Contains all assigned canonical Business Genome identities for semantic
 * objects and relationships. Graph construction is NOT performed here.
 */
export interface BusinessGenomeIdentityCollection {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly semanticObjectIdentities: readonly BusinessGenomeIdentity[];
  readonly relationshipIdentities: readonly BusinessGenomeIdentity[];
  readonly assignmentResults: readonly IdentityAssignmentResult[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly identityAssignmentVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly resolvedRelationships: ResolvedRelationshipCollection;
}

// ─── Graph Construction (BGC-PASS-009) ────────────────────────────────────

/**
 * A Business Genome Graph node representing a canonical semantic object.
 *
 * Each node originates directly from a BusinessGenomeIdentity of kind
 * "semantic-object". Nodes are immutable projections of canonical semantics.
 *
 * No nodes are synthesized; every node has a source in the identities.
 */
export interface BusinessGenomeNode {
  readonly id: string;  // Canonical identity from BusinessGenomeIdentity
  readonly semanticClass: string;  // From BusinessGenomeIdentity.semanticClass
  readonly canonicalDesignation: string;  // From consolidated semantic designation
  readonly sourceIdentityId: string;  // Which BusinessGenomeIdentity created this node
  readonly sourceConsolidatedSemanticId: string;  // Traced to original semantic
  readonly provenanceReferences: readonly string[];  // Full provenance trail
  readonly evidenceLineage: readonly string[];  // All evidence items
  readonly sourceEvidenceIrIdentity: string;  // Root evidence IR
  readonly constructedAt: string;  // ISO timestamp of construction (deterministic)
  readonly certainty: {
    readonly state: "certain" | "uncertain";
    readonly confidence: number;
  };
  readonly validationStatus: {
    readonly valid: boolean;
    readonly violations: readonly string[];
  };
  readonly graphConstructionContext: GraphConstructionContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * A Business Genome Graph edge representing a canonical semantic relationship.
 *
 * Each edge originates directly from a BusinessGenomeIdentity of kind
 * "semantic-relationship". Edges link two nodes and are immutable.
 *
 * No edges are synthesized; every edge has a source in the identities.
 */
export interface BusinessGenomeEdge {
  readonly id: string;  // Canonical identity from BusinessGenomeIdentity
  readonly relationshipType: string;  // From BusinessGenomeIdentity.relationshipType
  readonly sourceNodeId: string;  // Target node canonical ID
  readonly targetNodeId: string;  // Target node canonical ID
  readonly sourceIdentityId: string;  // Which BusinessGenomeIdentity created this edge
  readonly sourceRelationshipId: string;  // Traced to original relationship
  readonly provenanceReferences: readonly string[];  // Full provenance trail
  readonly evidenceLineage: readonly string[];  // All evidence items
  readonly sourceEvidenceIrIdentity: string;  // Root evidence IR
  readonly constructedAt: string;  // ISO timestamp of construction (deterministic)
  readonly certainty: {
    readonly state: "certain" | "uncertain";
    readonly confidence: number;
  };
  readonly validationStatus: {
    readonly valid: boolean;
    readonly violations: readonly string[];
  };
  readonly graphConstructionContext: GraphConstructionContext;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Context tracking which rule and compiler version constructed this graph.
 */
export interface GraphConstructionContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rationaleCode: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
}

/**
 * Per-node construction result tracking outcome.
 */
export interface NodeConstructionResult {
  readonly canonicalNodeId: string;
  readonly sourceIdentityId: string;
  readonly constructed: boolean;
  readonly constructionRuleId: string;
  readonly constructionRuleVersion: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Per-edge construction result tracking outcome.
 */
export interface EdgeConstructionResult {
  readonly canonicalEdgeId: string;
  readonly sourceIdentityId: string;
  readonly constructed: boolean;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly constructionRuleId: string;
  readonly constructionRuleVersion: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * The complete output of BGC-PASS-009 (Graph Construction).
 *
 * Contains the Business Genome Graph: a deterministic, immutable, ordered
 * projection of all canonical semantic objects and relationships.
 *
 * Graph is NOT validated or published in this pass.
 */
export interface BusinessGenomeGraph {
  readonly id: string;
  readonly sourceEvidenceIrIdentity: string;
  readonly nodes: readonly BusinessGenomeNode[];  // Sorted deterministically
  readonly edges: readonly BusinessGenomeEdge[];  // Sorted deterministically
  readonly nodeConstructionResults: readonly NodeConstructionResult[];
  readonly edgeConstructionResults: readonly EdgeConstructionResult[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly graphConstructionVersion: string;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly businessGenomeIdentityCollection: BusinessGenomeIdentityCollection;
}

// ─── Consistency Validation (BGC-PASS-010) ─────────────────────────────────

/**
 * A single structural violation found during graph validation.
 * Violations are diagnosed but NOT repaired.
 */
export interface GraphInvariantViolation {
  readonly violationCode: string;
  readonly violationSeverity: "error" | "warning" | "info";
  readonly invariantType:
    | "unique-node-identities"
    | "unique-edge-identities"
    | "source-node-exists"
    | "target-node-exists"
    | "node-provenance-present"
    | "edge-provenance-present"
    | "lineage-preserved"
    | "deterministic-ordering"
    | "graph-identity-reproducible"
    | "graph-checksum-reproducible"
    | "no-orphan-references"
    | "compiler-metadata-present";
  readonly description: string;
  readonly affectedNodeIds?: readonly string[];
  readonly affectedEdgeIds?: readonly string[];
  readonly diagnosticDetails?: Readonly<Record<string, unknown>>;
}

/**
 * Aggregate validation statistics across all invariants.
 */
export interface ValidationSummary {
  readonly totalInvariants: number;
  readonly invariantsPassed: number;
  readonly invariantsFailed: number;
  readonly violationCount: number;
  readonly errorViolations: number;
  readonly warningViolations: number;
  readonly infoViolations: number;
  readonly validationStatus: "passed" | "failed" | "warnings";
}

/**
 * Validation rule version tracking and metadata.
 */
export interface ValidationContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly validationTimestamp: string; // Deterministic: "2024-01-01T00:00:00Z"
  readonly validationRuleId: string;
  readonly validationRuleVersion: string;
}

/**
 * Complete validation result for BusinessGenomeGraph.
 * Graph is NOT modified. All violations are documented.
 * Validation is deterministic and reproducible.
 */
export interface BusinessGenomeValidationResult {
  readonly graphId: string; // Original graph ID (unchanged)
  readonly sourceEvidenceIrIdentity: string;
  readonly validationStatus: "valid" | "invalid" | "valid-with-warnings";
  readonly violations: readonly GraphInvariantViolation[]; // Sorted deterministically
  readonly summary: ValidationSummary;
  readonly context: ValidationContext;
  readonly diagnostics: readonly CompilerDiagnostic[]; // Sorted deterministically
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly validationHistoryChecksum: string; // Deterministic checksum of all validations
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
  readonly businessGenomeGraph: BusinessGenomeGraph; // Original graph preserved
}

export function deterministicIdentity(prefix: string, value: unknown): string {
  const checksum = SourceHash.sha256(stableStringify(value));
  return `${prefix}_${checksum}_v1`;
}

export function createInitialPipelineState(input: BusinessGenomeCompilerInput): BusinessGenomePipelineState {
  return {
    input,
    sourceEvidenceIrIdentity: input.evidenceIrIdentity,
    evidenceIR: input.evidenceIR,
    diagnostics: [],
    passHistory: BGC_ARCHITECTURAL_PASS_ORDER.map((passId) => ({
      passId,
      version: "1.0.0",
      status: "planned",
      diagnosticCount: 0,
    })),
    deterministicOrderingContext: {
      evidenceNodeOrder: [...input.evidenceIR.graph.nodes].map((node) => node.id).sort(),
      evidenceRelationshipOrder: [...input.evidenceIR.graph.relationships].map((rel) => rel.id).sort(),
    },
    specificationVersion: input.specificationVersion,
    compilerVersion: input.compilerVersion,
    canonicalMetadata: input.canonicalMetadata,
  };
}

export function updatePassHistory(
  passHistory: BusinessGenomePipelineState["passHistory"],
  passId: string,
  version: string,
  status: "completed" | "failed",
  diagnosticCount: number,
): BusinessGenomePipelineState["passHistory"] {
  return passHistory.map((entry) => {
    if (entry.passId !== passId) {
      return entry;
    }

    return {
      passId,
      version,
      status,
      diagnosticCount,
    };
  });
}

// ─── Business Genome Publication (BGC-PASS-011) ────────────────────────────────

/**
 * Publication status for Business Genome Artifact.
 * Explicit states indicating whether publication proceeded or was blocked.
 */
export type BusinessGenomePublicationStatus = "published" | "blocked" | "failed";

/**
 * Deterministic checksums for BusinessGenomeArtifact verification.
 */
export interface BusinessGenomeChecksumSet {
  readonly graphChecksum: string; // SHA256 of graph content (unchanged)
  readonly artifactChecksum: string; // SHA256 of entire artifact
  readonly manifestChecksum: string; // SHA256 of manifest only
}

/**
 * Deterministic mapping from semantic elements to evidence sources.
 * Supports traceability from Business Genome back to discovery evidence.
 */
export interface BusinessGenomeProvenanceIndex {
  readonly entries: readonly {
    readonly nodeId: string;
    readonly evidenceReferences: readonly string[];
    readonly sourceDocuments: readonly string[];
    readonly discoveryReferences: readonly string[];
  }[];
  readonly edgeEntries: readonly {
    readonly edgeId: string;
    readonly evidenceReferences: readonly string[];
    readonly sourceDocuments: readonly string[];
  }[];
}

/**
 * Lineage trace from reality source through compiler passes to artifact.
 * Preserves complete traceability chain.
 */
export interface BusinessGenomeLineageIndex {
  readonly entries: readonly {
    readonly artifactId: string;
    readonly traceChain: readonly {
      readonly stage: string;
      readonly stageIdentity: string;
      readonly stageVersion: string;
      readonly timestamp: string;
    }[];
  }[];
}

/**
 * Publication manifest metadata: versions, passes, standards, configuration.
 */
export interface BusinessGenomeArtifactManifest {
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly specificationVersion: string;
  readonly businessGenomeSpecificationVersion: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly passListAndVersions: readonly {
    readonly passId: string;
    readonly version: string;
  }[];
  readonly sourceManifestReferences: readonly string[];
  readonly graphIdentity: string;
  readonly artifactIdentity: string;
  readonly graphChecksum: string;
  readonly artifactChecksum: string;
  readonly validationStatus: "valid" | "invalid" | "valid-with-warnings";
  readonly diagnosticSummary: {
    readonly totalDiagnostics: number;
    readonly errors: number;
    readonly warnings: number;
    readonly infos: number;
  };
  readonly publicationStatus: BusinessGenomePublicationStatus;
  readonly publicationTimestamp: string;
}

/**
 * Metadata context for publication operation.
 */
export interface BusinessGenomePublicationContext {
  readonly passId: string;
  readonly passVersion: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly businessGenomeSpecificationVersion: string;
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly publicationTimestamp: string; // Deterministic: "2024-01-01T00:00:00Z"
  readonly publicationRuleId: string;
  readonly publicationRuleVersion: string;
}

/**
 * Complete canonical Business Genome Artifact.
 * Published only when validation permits publication.
 * Preserves all graph structure, provenance, and lineage.
 */
export interface BusinessGenomeArtifact {
  readonly artifactIdentity: string;
  readonly artifactVersion: string;
  readonly schemaVersion: string;
  readonly businessGenomeSpecificationVersion: string;
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly businessGenomeGraph: BusinessGenomeGraph;
  readonly validationResult: BusinessGenomeValidationResult;
  readonly compilationDiagnostics: readonly CompilerDiagnostic[];
  readonly provenanceIndex: BusinessGenomeProvenanceIndex;
  readonly lineageIndex: BusinessGenomeLineageIndex;
  readonly manifest: BusinessGenomeArtifactManifest;
  readonly graphChecksum: string;
  readonly artifactChecksum: string;
  readonly sourceManifestReferences: readonly string[];
  readonly gps0001Version: string;
  readonly gps0002Version: string;
  readonly publicationMetadata: BusinessGenomePublicationContext;
  readonly passHistory: readonly {
    readonly passId: string;
    readonly version: string;
    readonly status: "completed" | "failed" | "planned";
    readonly diagnosticCount: number;
  }[];
}

/**
 * Result of Business Genome Publication operation.
 * Contains artifact only if publication succeeded.
 * Always contains diagnostics and publication status.
 */
export interface BusinessGenomePublicationResult {
  readonly publicationStatus: BusinessGenomePublicationStatus;
  readonly artifact: BusinessGenomeArtifact | null;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly passId: string;
  readonly passVersion: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly validationResult: BusinessGenomeValidationResult;
  readonly graph: BusinessGenomeGraph; // Always preserved
}
