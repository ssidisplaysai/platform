import type { EvidenceLifecycleState } from "../evidence/contracts";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";

export type ManifestRuntimeCheckStatus = "pass" | "warn" | "fail";

export type ManifestRuntimeOutcome = "READY" | "WARN" | "BLOCKED";

export interface ManifestRuntimeRuleResult {
  readonly status: ManifestRuntimeCheckStatus;
  readonly code: string;
  readonly message: string;
}

export interface ManifestRuntimeRule {
  readonly name: string;
  validate(records: readonly EvidenceValidationRuntimeRecord[]): ManifestRuntimeRuleResult;
}

export interface ManifestRuntimeCheck extends ManifestRuntimeRuleResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface ManifestRuntimeEntry {
  readonly evidenceId: string;
  readonly evidenceObjectId: string;
  readonly evidenceVersionId: string;
  readonly validationId: string;
  readonly validationOutcome: "VALID" | "WARN" | "INVALID";
  readonly validationDigest: string;
  readonly sourceManifestId: string;
  readonly sourceReplayId: string;
  readonly sourceCertificationId: string;
  readonly lifecycleState: EvidenceLifecycleState;
  readonly versionOrdinal: number;
}

export interface ManifestRuntimeReplayTrace {
  readonly sourceReplayIds: readonly string[];
  readonly sourceManifestIds: readonly string[];
  readonly deterministicFingerprint: string;
}

export interface ManifestRuntimeCertificationTrace {
  readonly sourceCertificationIds: readonly string[];
  readonly sourceValidationDigests: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly readiness: "PENDING" | "READY";
}

export interface ManifestRuntimeLifecycleIntegrity {
  readonly sourceLifecycleStates: readonly EvidenceLifecycleState[];
  readonly highestSourceVersionOrdinal: number;
  readonly immutableInputPreserved: true;
}

export interface ManifestRuntimeVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface ManifestRuntimeRecord {
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly outcome: ManifestRuntimeOutcome;
  readonly checks: readonly ManifestRuntimeCheck[];
  readonly entries: readonly ManifestRuntimeEntry[];
  readonly replayTrace: ManifestRuntimeReplayTrace;
  readonly certificationTrace: ManifestRuntimeCertificationTrace;
  readonly lifecycleIntegrity: ManifestRuntimeLifecycleIntegrity;
  readonly version: ManifestRuntimeVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManifestRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface ManifestRuntimeFactoryOptions {
  readonly configuration: ManifestRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface ManifestRuntimeCreateOptions {
  readonly reason: string;
  readonly previousRecord?: ManifestRuntimeRecord;
}

export interface ManifestRuntimeRegistryOptions {
  readonly factory: {
    createManifestRecord(
      records: readonly EvidenceValidationRuntimeRecord[],
      rules: readonly ManifestRuntimeRule[],
      options: ManifestRuntimeCreateOptions,
    ): ManifestRuntimeRecord;
  };
  readonly rules: readonly ManifestRuntimeRule[];
  readonly clock?: () => string;
}

export interface RegisteredManifestRuntime {
  readonly record: ManifestRuntimeRecord;
  readonly sources: readonly EvidenceValidationRuntimeRecord[];
  readonly registeredAt: string;
}
