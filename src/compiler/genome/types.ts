import type { EvidenceIR } from "../evidence/EvidenceIR";
import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "../core/stableStringify";
import type { CompilerDiagnostic, CompilerPassContext } from "../core/types";

export const BUSINESS_GENOME_SEMANTIC_CLASSES = [
  "actor",
  "organization",
  "capability",
  "policy",
  "process",
  "event",
  "resource",
  "asset",
  "product",
  "customer",
  "supplier",
  "responsibility",
  "constraint",
  "goal",
  "risk",
  "decision",
  "location",
  "time",
  "business-rule",
] as const;

export type BusinessGenomeSemanticClass = (typeof BUSINESS_GENOME_SEMANTIC_CLASSES)[number];

export const BUSINESS_GENOME_RELATIONSHIP_CLASSES = [
  "ownership",
  "dependency",
  "participation",
  "composition",
  "aggregation",
  "reference",
  "containment",
  "lifecycle",
  "influence",
] as const;

export type BusinessGenomeRelationshipClass = (typeof BUSINESS_GENOME_RELATIONSHIP_CLASSES)[number];

export const RELATIONSHIP_CLASS_GOVERNANCE_NOTE =
  "M1.1 uses BGS-0001 and BGC-0001 shared relationship class intersection pending governance clarification.";

export type SemanticCertaintyState = "certain" | "uncertain";

export interface SemanticCertainty {
  readonly state: SemanticCertaintyState;
  readonly confidence: number;
}

export interface SemanticConflictContext {
  readonly hasConflict: boolean;
  readonly conflictingEvidenceItemIds: readonly string[];
  readonly notes: readonly string[];
}

export interface SemanticValidationStatus {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export interface SemanticVersionContext {
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly evidenceIrSchemaVersion: string;
}

export interface SemanticProvenance {
  readonly evidenceItemIds: readonly string[];
  readonly discoveryQuestionIds: readonly string[];
  readonly discoveryAnswerIds: readonly string[];
  readonly sourceDocumentIds: readonly string[];
  readonly transformationSteps: readonly string[];
  readonly compilerStage: string;
  readonly validationStatus: SemanticValidationStatus;
  readonly versionContext: SemanticVersionContext;
}

export interface SemanticObject {
  readonly id: string;
  readonly semanticClass: BusinessGenomeSemanticClass;
  readonly canonicalName: string;
  readonly assertions: Readonly<Record<string, unknown>>;
  readonly certainty: SemanticCertainty;
  readonly conflict: SemanticConflictContext;
  readonly provenance: SemanticProvenance;
  readonly validationStatus: SemanticValidationStatus;
  readonly version: string;
}

export interface SemanticRelationship {
  readonly id: string;
  readonly relationshipClass: BusinessGenomeRelationshipClass;
  readonly sourceSemanticId: string;
  readonly targetSemanticId: string;
  readonly certainty: SemanticCertainty;
  readonly conflict: SemanticConflictContext;
  readonly provenance: SemanticProvenance;
  readonly validationStatus: SemanticValidationStatus;
  readonly version: string;
}

export interface SemanticGraph {
  readonly semanticObjects: readonly SemanticObject[];
  readonly semanticRelationships: readonly SemanticRelationship[];
}

export interface BusinessGenomeArtifact {
  readonly id: string;
  readonly version: string;
  readonly specificationVersion: string;
  readonly compilerVersion: string;
  readonly semanticGraph: SemanticGraph;
  readonly validationResult: SemanticValidationStatus;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly provenanceIndex: Readonly<Record<string, readonly string[]>>;
  readonly checksum: string;
  readonly manifestReference: string;
}

export interface BusinessGenomeCompilerInput {
  readonly evidenceIR: EvidenceIR;
  readonly compilerContext: CompilerPassContext;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
}

export interface BusinessGenomeCompilerOutput {
  readonly artifact: BusinessGenomeArtifact;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly success: boolean;
}

export function isBusinessGenomeSemanticClass(value: string): value is BusinessGenomeSemanticClass {
  return BUSINESS_GENOME_SEMANTIC_CLASSES.includes(value as BusinessGenomeSemanticClass);
}

export function isBusinessGenomeRelationshipClass(value: string): value is BusinessGenomeRelationshipClass {
  return BUSINESS_GENOME_RELATIONSHIP_CLASSES.includes(value as BusinessGenomeRelationshipClass);
}

export function toDeterministicSemanticGraph(graph: SemanticGraph): SemanticGraph {
  const semanticObjects = [...graph.semanticObjects].sort((a, b) => a.id.localeCompare(b.id));
  const semanticRelationships = [...graph.semanticRelationships].sort((a, b) => a.id.localeCompare(b.id));

  const semanticObjectIds = new Set(semanticObjects.map((entry) => entry.id));

  for (const relationship of semanticRelationships) {
    if (!semanticObjectIds.has(relationship.sourceSemanticId) || !semanticObjectIds.has(relationship.targetSemanticId)) {
      throw new Error(`Semantic relationship has unresolved endpoints: ${relationship.id}`);
    }
  }

  return {
    semanticObjects,
    semanticRelationships,
  };
}

export function deterministicSemanticGraphSerialization(graph: SemanticGraph): string {
  const normalizedGraph = toDeterministicSemanticGraph(graph);
  return stableStringify(normalizedGraph);
}

export function checksumBusinessGenomeArtifact(
  artifact: Omit<BusinessGenomeArtifact, "checksum" | "semanticGraph"> & { semanticGraph: SemanticGraph },
): string {
  const hashMaterial = {
    ...artifact,
    semanticGraph: toDeterministicSemanticGraph(artifact.semanticGraph),
  };

  return SourceHash.sha256(stableStringify(hashMaterial));
}
