import type { EvidenceLifecycleState, EvidenceRuntimeObject } from "../evidence/contracts";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type { ManifestRuntimeRecord } from "../manifest/contracts";
import type { ReplayRuntimeRecord } from "../replay/contracts";

export type IBRRuntimeCheckStatus = "pass" | "warn" | "fail";

export type IBRRuntimeOutcome = "READY" | "WARN" | "BLOCKED";

export type IBRRuntimeLifecycleState = "DECLARED" | "INTEGRATED" | "BLOCKED" | "SUPERSEDED" | "RETIRED";

export type IBRRuntimeGraphNodeType = "manifest" | "replay" | "validation" | "evidence" | "certification";

export type IBRRuntimeGraphEdgeRelation = "CONTAINS" | "DERIVES_FROM" | "CERTIFIES";

export interface IBRRuntimeLifecycleEvent {
  readonly state: IBRRuntimeLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface IBRRuntimeLifecycle {
  readonly currentState: IBRRuntimeLifecycleState;
  readonly history: readonly IBRRuntimeLifecycleEvent[];
}

export interface IBRRuntimeRuleResult {
  readonly status: IBRRuntimeCheckStatus;
  readonly code: string;
  readonly message: string;
}

export interface IBRRuntimeRule {
  readonly name: string;
  validate(input: IBRRuntimeCreateInput): IBRRuntimeRuleResult;
}

export interface IBRRuntimeCheck extends IBRRuntimeRuleResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface IBRRuntimeGraphNode {
  readonly nodeId: string;
  readonly nodeType: IBRRuntimeGraphNodeType;
  readonly referenceId: string;
  readonly digest: string;
}

export interface IBRRuntimeGraphEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relation: IBRRuntimeGraphEdgeRelation;
}

export interface IBRRuntimeGraph {
  readonly nodes: readonly IBRRuntimeGraphNode[];
  readonly edges: readonly IBRRuntimeGraphEdge[];
  readonly deterministicFingerprint: string;
}

export interface IBRRuntimeTrace {
  readonly sourceManifestIds: readonly string[];
  readonly sourceReplayIds: readonly string[];
  readonly sourceValidationIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceCertificationIds: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly deterministicFingerprint: string;
}

export interface IBRRuntimeCertificationTrace {
  readonly sourceCertificationIds: readonly string[];
  readonly sourceValidationDigests: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly readiness: "PENDING" | "READY";
}

export interface IBRRuntimeLineageIntegrity {
  readonly sourceLifecycleStates: readonly EvidenceLifecycleState[];
  readonly highestSourceVersionOrdinal: number;
  readonly immutableInputPreserved: true;
}

export interface IBRRuntimeVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface IBRRuntimeRecord {
  readonly ibrId: string;
  readonly ibrDigest: string;
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly replayId: string;
  readonly replayDigest: string;
  readonly outcome: IBRRuntimeOutcome;
  readonly lifecycle: IBRRuntimeLifecycle;
  readonly checks: readonly IBRRuntimeCheck[];
  readonly graph: IBRRuntimeGraph;
  readonly trace: IBRRuntimeTrace;
  readonly certificationTrace: IBRRuntimeCertificationTrace;
  readonly lineageIntegrity: IBRRuntimeLineageIntegrity;
  readonly version: IBRRuntimeVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IBRRuntimeCreateInput {
  readonly manifest: ManifestRuntimeRecord;
  readonly replayRecord: ReplayRuntimeRecord;
  readonly validationRecords: readonly EvidenceValidationRuntimeRecord[];
  readonly evidenceObjects: readonly EvidenceRuntimeObject[];
}

export interface IBRRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface IBRRuntimeFactoryOptions {
  readonly configuration: IBRRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface IBRRuntimeCreateOptions {
  readonly reason: string;
  readonly previousRecord?: IBRRuntimeRecord;
}

export interface IBRRuntimeRegistryOptions {
  readonly factory: {
    createIBRRecord(input: IBRRuntimeCreateInput, rules: readonly IBRRuntimeRule[], options: IBRRuntimeCreateOptions): IBRRuntimeRecord;
  };
  readonly rules: readonly IBRRuntimeRule[];
  readonly clock?: () => string;
}

export interface RegisteredIBRRuntime {
  readonly record: IBRRuntimeRecord;
  readonly manifest: ManifestRuntimeRecord;
  readonly replayRecord: ReplayRuntimeRecord;
  readonly validationRecords: readonly EvidenceValidationRuntimeRecord[];
  readonly evidenceObjects: readonly EvidenceRuntimeObject[];
  readonly registeredAt: string;
}
