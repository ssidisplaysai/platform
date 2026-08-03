import type { EvidenceLifecycleState, EvidenceRuntimeObject } from "../evidence/contracts";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type { ManifestRuntimeRecord } from "../manifest/contracts";

export type ReplayRuntimeCheckStatus = "pass" | "warn" | "fail";

export type ReplayRuntimeOutcome = "READY" | "WARN" | "BLOCKED";

export type ReplayRuntimeLifecycleState = "DECLARED" | "REPLAYED" | "BLOCKED" | "SUPERSEDED" | "RETIRED";

export type ReplayRuntimeGraphNodeType = "manifest" | "validation" | "evidence" | "certification";

export type ReplayRuntimeGraphEdgeRelation = "CONTAINS" | "DERIVES_FROM" | "CERTIFIES";

export interface ReplayRuntimeLifecycleEvent {
  readonly state: ReplayRuntimeLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface ReplayRuntimeLifecycle {
  readonly currentState: ReplayRuntimeLifecycleState;
  readonly history: readonly ReplayRuntimeLifecycleEvent[];
}

export interface ReplayRuntimeRuleResult {
  readonly status: ReplayRuntimeCheckStatus;
  readonly code: string;
  readonly message: string;
}

export interface ReplayRuntimeRule {
  readonly name: string;
  validate(input: ReplayRuntimeCreateInput): ReplayRuntimeRuleResult;
}

export interface ReplayRuntimeCheck extends ReplayRuntimeRuleResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface ReplayRuntimeGraphNode {
  readonly nodeId: string;
  readonly nodeType: ReplayRuntimeGraphNodeType;
  readonly referenceId: string;
  readonly digest: string;
}

export interface ReplayRuntimeGraphEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relation: ReplayRuntimeGraphEdgeRelation;
}

export interface ReplayRuntimeGraph {
  readonly nodes: readonly ReplayRuntimeGraphNode[];
  readonly edges: readonly ReplayRuntimeGraphEdge[];
  readonly deterministicFingerprint: string;
}

export interface ReplayRuntimeTrace {
  readonly sourceManifestIds: readonly string[];
  readonly sourceValidationIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceReplayIds: readonly string[];
  readonly sourceCertificationIds: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly deterministicFingerprint: string;
}

export interface ReplayRuntimeCertificationTrace {
  readonly sourceCertificationIds: readonly string[];
  readonly sourceValidationDigests: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly readiness: "PENDING" | "READY";
}

export interface ReplayRuntimeLineageIntegrity {
  readonly sourceLifecycleStates: readonly EvidenceLifecycleState[];
  readonly highestSourceVersionOrdinal: number;
  readonly immutableInputPreserved: true;
}

export interface ReplayRuntimeVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface ReplayRuntimeRecord {
  readonly replayId: string;
  readonly replayDigest: string;
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly outcome: ReplayRuntimeOutcome;
  readonly lifecycle: ReplayRuntimeLifecycle;
  readonly checks: readonly ReplayRuntimeCheck[];
  readonly graph: ReplayRuntimeGraph;
  readonly trace: ReplayRuntimeTrace;
  readonly certificationTrace: ReplayRuntimeCertificationTrace;
  readonly lineageIntegrity: ReplayRuntimeLineageIntegrity;
  readonly version: ReplayRuntimeVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReplayRuntimeCreateInput {
  readonly manifest: ManifestRuntimeRecord;
  readonly validationRecords: readonly EvidenceValidationRuntimeRecord[];
  readonly evidenceObjects: readonly EvidenceRuntimeObject[];
}

export interface ReplayRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface ReplayRuntimeFactoryOptions {
  readonly configuration: ReplayRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface ReplayRuntimeCreateOptions {
  readonly reason: string;
  readonly previousRecord?: ReplayRuntimeRecord;
}

export interface ReplayRuntimeRegistryOptions {
  readonly factory: {
    createReplayRecord(
      input: ReplayRuntimeCreateInput,
      rules: readonly ReplayRuntimeRule[],
      options: ReplayRuntimeCreateOptions,
    ): ReplayRuntimeRecord;
  };
  readonly rules: readonly ReplayRuntimeRule[];
  readonly clock?: () => string;
}

export interface RegisteredReplayRuntime {
  readonly record: ReplayRuntimeRecord;
  readonly manifest: ManifestRuntimeRecord;
  readonly validationRecords: readonly EvidenceValidationRuntimeRecord[];
  readonly evidenceObjects: readonly EvidenceRuntimeObject[];
  readonly registeredAt: string;
}