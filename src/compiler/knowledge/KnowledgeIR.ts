import type { KnowledgeClaim } from "./KnowledgeClaim";
import type { KnowledgeGraph } from "./KnowledgeGraph";
import type { KnowledgeNode } from "./KnowledgeNode";
import type {
  KnowledgeConfidence,
  KnowledgeLineage,
  KnowledgeVersion,
} from "./KnowledgeClassification";

export type KnowledgeDiagnosticSeverity = "info" | "warning" | "error";

export interface KnowledgeDiagnostic {
  code: string;
  severity: KnowledgeDiagnosticSeverity;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeTemporalValidity {
  validFrom: string;
  validTo: string | null;
  observedAt: string;
  compiledAt: string;
  supersedes: string | null;
  supersededBy: string | null;
}

export interface KnowledgeProvenance {
  sourceEvidenceId: string;
  sourceEvidenceIdentity: string;
  sourceDocument?: string;
  sourceInterviewId?: string;
  sourceType?: string;
  sourceOrigin?: string;
  compilerStage: string;
  compilerVersion: string;
  transformationVersion: string;
  validationResult: "valid" | "warning" | "invalid" | "unknown";
}

export type KnowledgeObjectKind = "entity" | "fact" | "relationship" | "cluster" | "conflict";

export interface CanonicalKnowledgeObject {
  kind: KnowledgeObjectKind;
  knowledgeId: string;
  identity: string;
  canonicalName: string;
  canonicalContent: string;
  evidenceIds: readonly string[];
  provenance: KnowledgeProvenance;
  lineage: KnowledgeLineage;
  confidence: KnowledgeConfidence;
  temporalValidity: KnowledgeTemporalValidity;
  version: KnowledgeVersion;
  metadata: Readonly<Record<string, unknown>>;
}

export interface KnowledgeEntity extends CanonicalKnowledgeObject {
  kind: "entity";
  entityType: string;
  factIds: readonly string[];
  relationshipIds: readonly string[];
  clusterIds: readonly string[];
}

export interface KnowledgeFact extends CanonicalKnowledgeObject {
  kind: "fact";
  subjectEntityId: string;
  canonicalStatement: string;
  evidenceNodeIds: readonly string[];
  relationshipIds: readonly string[];
  conflictIds: readonly string[];
}

export interface KnowledgeRelationship {
  kind: "relationship";
  knowledgeId: string;
  identity: string;
  canonicalName: string;
  canonicalContent: string;
  evidenceIds: readonly string[];
  provenance: KnowledgeProvenance;
  lineage: KnowledgeLineage & {
    parentKnowledgeRelationshipIds?: readonly string[];
    parentEvidenceRelationshipIds?: readonly string[];
  };
  confidence: KnowledgeConfidence;
  temporalValidity: KnowledgeTemporalValidity;
  version: KnowledgeVersion;
  metadata: Readonly<Record<string, unknown>>;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: "supports" | "contradicts" | "supersedes" | "related_to" | "derived_from";
  relationshipId: string;
  conflictIds: readonly string[];
}

export interface KnowledgeCluster extends CanonicalKnowledgeObject {
  kind: "cluster";
  entityIds: readonly string[];
  factIds: readonly string[];
  evidenceNodeIds: readonly string[];
  relationshipIds: readonly string[];
  conflictIds: readonly string[];
  resolved: boolean;
  resolutionState: "resolved" | "unresolved" | "non_blocking" | "blocking";
}

export interface KnowledgeConflict extends CanonicalKnowledgeObject {
  kind: "conflict";
  conflictType:
    | "duplicate_claim"
    | "contradictory_fact"
    | "temporal_disagreement"
    | "confidence_disagreement"
    | "entity_ambiguity";
  status: "resolved" | "unresolved" | "non_blocking" | "blocking";
  required: boolean;
  blocking: boolean;
  evidenceIds: readonly string[];
  entityIds: readonly string[];
  relationshipIds: readonly string[];
  resolution?: string;
}

export interface KnowledgeCompilationContext {
  compilerVersion: string;
  pipelineVersion: string;
  compiledAt: string;
  sourceEvidenceHash: string;
  sourceEvidenceCount: number;
  sourceTypes: readonly string[];
  sourceIds: readonly string[];
}

export interface KnowledgeCompilationMetrics {
  inputEvidenceNodes: number;
  evidenceArtifacts: number;
  entitiesCreated: number;
  factsCreated: number;
  relationshipsCreated: number;
  clustersCreated: number;
  conflictsCreated: number;
  duplicateClaimsConsolidated: number;
  blockingConflicts: number;
  validationErrors: number;
  validationWarnings: number;
  executionTimeMs: number;
}

export interface KnowledgeCompilationResult {
  success: boolean;
  knowledgeIR: KnowledgeIR;
  diagnostics: readonly KnowledgeDiagnostic[];
  metrics: KnowledgeCompilationMetrics;
}

export interface KnowledgeIR {
  schemaVersion: "1.0.0";
  graph: KnowledgeGraph;
  claimCount: number;
  compiledFromEvidenceHash: string;
  generatedAt: string;
  deterministicHash: string;
  compilationContext?: KnowledgeCompilationContext;
  entities?: readonly KnowledgeEntity[];
  facts?: readonly KnowledgeFact[];
  relationships?: readonly KnowledgeRelationship[];
  clusters?: readonly KnowledgeCluster[];
  conflicts?: readonly KnowledgeConflict[];
  temporalValidity?: readonly KnowledgeTemporalValidity[];
  diagnostics?: readonly KnowledgeDiagnostic[];
  metrics?: KnowledgeCompilationMetrics;
  claims?: readonly KnowledgeClaim[];
  sourceNodes?: readonly KnowledgeNode[];
}