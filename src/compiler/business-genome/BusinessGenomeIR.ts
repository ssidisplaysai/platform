import type { KnowledgeDiagnosticSeverity, KnowledgeIR, KnowledgeTemporalValidity } from "../knowledge/KnowledgeIR";

export type GenomeDiagnosticSeverity = KnowledgeDiagnosticSeverity;

export interface GenomeDiagnostic {
  code: string;
  severity: GenomeDiagnosticSeverity;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface GenomeVersion {
  semver: string;
  revision: number;
  compiledAt: string;
  supersedes: string | null;
  supersededBy: string | null;
}

export interface GenomeLineage {
  sourceKnowledgeId: string;
  sourceEvidenceIds: readonly string[];
  sourceDocument?: string;
  sourceInterviewId?: string;
  compilerStage: string;
  transformationVersion: string;
  validationResult: "valid" | "warning" | "invalid" | "unknown";
  transformationPath: readonly string[];
}

export interface GenomeProvenance {
  sourceKnowledgeId: string;
  sourceEvidenceId: string;
  sourceEvidenceIdentity: string;
  sourceDocument?: string;
  sourceInterviewId?: string;
  sourceType?: string;
  sourceOrigin?: string;
  compilerStage: string;
  transformationVersion: string;
  validationResult: "valid" | "warning" | "invalid" | "unknown";
}

export interface GenomeTemporalValidity {
  validFrom: string;
  validTo: string | null;
  observedAt: string;
  compiledAt: string;
  supersedes: string | null;
  supersededBy: string | null;
}

export interface GenomeConfidence {
  initial: number;
  current: number;
  method: string;
  factors: Readonly<Record<string, number>>;
  rationale: readonly string[];
}

export interface GenomeIdentity {
  id: string;
  kind: string;
  objectType: string;
  enterpriseScope: string;
  relationshipScope: string;
  temporalScope: string;
  lineageSignature: string;
  versionSemantics: string;
}

export interface GenomeObjectBase {
  identity: GenomeIdentity;
  canonicalName: string;
  canonicalContent: string;
  confidence: GenomeConfidence;
  lineage: GenomeLineage;
  provenance: GenomeProvenance;
  temporalValidity: GenomeTemporalValidity;
  version: GenomeVersion;
  conflictIds: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface GenomeEntity extends GenomeObjectBase {
  entityType: string;
}

export interface GenomeRelationship extends GenomeObjectBase {
  relationshipType: string;
  sourceEntityId: string;
  targetEntityId: string;
}

export interface GenomeCapability extends GenomeObjectBase {
  capabilityType: string;
  entityId: string;
}

export interface GenomeProcess extends GenomeObjectBase {
  processType: string;
  relatedEntityIds: readonly string[];
}

export interface GenomePolicy extends GenomeObjectBase {
  policyType: string;
  ruleIds: readonly string[];
}

export interface GenomeRule extends GenomeObjectBase {
  ruleType: string;
  policyId: string | null;
}

export interface GenomeRole extends GenomeObjectBase {
  roleType: string;
  responsibilityIds: readonly string[];
}

export interface GenomeResponsibility extends GenomeObjectBase {
  responsibilityType: string;
  roleId: string;
  processId: string | null;
}

export interface GenomeResource extends GenomeObjectBase {
  resourceType: string;
  ownerRoleId: string | null;
}

export interface GenomeEvent extends GenomeObjectBase {
  eventType: string;
  workflowId: string | null;
}

export interface GenomeWorkflow extends GenomeObjectBase {
  workflowType: string;
  processIds: readonly string[];
  eventIds: readonly string[];
}

export interface GenomeConstraint extends GenomeObjectBase {
  constraintType: string;
  constrainedObjectIds: readonly string[];
}

export interface GenomeMetric extends GenomeObjectBase {
  metricType: string;
  targetObjectIds: readonly string[];
}

export interface GenomeObjective extends GenomeObjectBase {
  objectiveType: string;
  metricIds: readonly string[];
}

export interface GenomeConflict extends GenomeObjectBase {
  conflictType:
    | "contradictory_policy"
    | "incompatible_rule"
    | "role_ambiguity"
    | "responsibility_overlap"
    | "process_disagreement"
    | "temporal_disagreement"
    | "capability_ambiguity"
    | "entity_ambiguity"
    | "generic_conflict";
  status: "resolved" | "unresolved" | "non_blocking" | "blocking";
  required: boolean;
  blocking: boolean;
  relatedObjectIds: readonly string[];
}

export interface BusinessGenome {
  version: string;
  generatedAt: string;
  entities: readonly GenomeEntity[];
  relationships: readonly GenomeRelationship[];
  capabilities: readonly GenomeCapability[];
  processes: readonly GenomeProcess[];
  policies: readonly GenomePolicy[];
  rules: readonly GenomeRule[];
  roles: readonly GenomeRole[];
  responsibilities: readonly GenomeResponsibility[];
  resources: readonly GenomeResource[];
  events: readonly GenomeEvent[];
  workflows: readonly GenomeWorkflow[];
  constraints: readonly GenomeConstraint[];
  metrics: readonly GenomeMetric[];
  objectives: readonly GenomeObjective[];
  conflicts: readonly GenomeConflict[];
}

export interface BusinessGenomeCompilationContext {
  compilerVersion: string;
  pipelineVersion: string;
  compiledAt: string;
  sourceKnowledgeHash: string;
  sourceKnowledgeCount: number;
  sourceTypes: readonly string[];
  sourceIds: readonly string[];
  deterministicRunId: string;
}

export interface BusinessGenomeCompilationMetrics {
  inputKnowledgeEntities: number;
  inputKnowledgeFacts: number;
  inputKnowledgeRelationships: number;
  entitiesProjected: number;
  relationshipsProjected: number;
  capabilitiesExtracted: number;
  processesExtracted: number;
  policiesExtracted: number;
  rulesExtracted: number;
  rolesExtracted: number;
  responsibilitiesMapped: number;
  resourcesIdentified: number;
  eventsIdentified: number;
  workflowsConstructed: number;
  constraintsIdentified: number;
  metricsIdentified: number;
  objectivesIdentified: number;
  conflictsPreserved: number;
  blockingConflicts: number;
  diagnosticsCount: number;
  executionTimeMs: number;
}

export interface BusinessGenomeIR {
  schemaVersion: "1.0.0";
  businessGenome: BusinessGenome;
  compilationContext: BusinessGenomeCompilationContext;
  diagnostics: readonly GenomeDiagnostic[];
  metrics: BusinessGenomeCompilationMetrics;
  deterministicHash: string;
  deterministicSerialization: string;
  compiledFromKnowledgeHash: string;
  generatedAt: string;
}

export interface BusinessGenomeCompilationResult {
  success: boolean;
  businessGenomeIR: BusinessGenomeIR;
  diagnostics: readonly GenomeDiagnostic[];
  metrics: BusinessGenomeCompilationMetrics;
}

export interface BusinessGenomeCompilerOptions {
  compilerVersion?: string;
  pipelineVersion?: string;
  compiledAt?: string;
}

export function toGenomeTemporalValidity(temporal: KnowledgeTemporalValidity): GenomeTemporalValidity {
  return {
    validFrom: temporal.validFrom,
    validTo: temporal.validTo,
    observedAt: temporal.observedAt,
    compiledAt: temporal.compiledAt,
    supersedes: temporal.supersedes,
    supersededBy: temporal.supersededBy,
  };
}

export type BusinessGenomeInput = KnowledgeIR;
