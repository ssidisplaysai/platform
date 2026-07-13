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
  "bgc.genome-validation",
  "bgc.artifact-generation",
  "bgc.compiler-diagnostics",
  "bgc.manifest-generation",
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
