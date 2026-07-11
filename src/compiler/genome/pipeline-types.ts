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

export interface BusinessGenomePassResult<TOutput> {
  readonly passId: string;
  readonly passVersion: string;
  readonly output: TOutput;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly fatal: boolean;
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
