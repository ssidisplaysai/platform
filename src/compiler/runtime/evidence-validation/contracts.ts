import type { EvidenceLifecycleState, EvidenceRuntimeObject } from "../evidence/contracts";

export type EvidenceValidationRuntimeCheckStatus = "pass" | "warn" | "fail";

export type EvidenceValidationRuntimeOutcome = "VALID" | "WARN" | "INVALID";

export interface EvidenceValidationRuntimeRuleResult {
  readonly status: EvidenceValidationRuntimeCheckStatus;
  readonly code: string;
  readonly message: string;
}

export interface EvidenceValidationRuntimeRule {
  readonly name: string;
  validate(evidence: EvidenceRuntimeObject): EvidenceValidationRuntimeRuleResult;
}

export interface EvidenceValidationRuntimeCheck extends EvidenceValidationRuntimeRuleResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface EvidenceValidationReplayTrace {
  readonly sourceReplayId: string;
  readonly sourceManifestId: string;
  readonly sourceDeterministicFingerprint: string;
  readonly validationDeterministicFingerprint: string;
}

export interface EvidenceValidationCertificationTrace {
  readonly sourceCertificationId: string;
  readonly readiness: "PENDING" | "READY";
  readonly evidenceReferences: readonly string[];
  readonly validationDigest: string;
}

export interface EvidenceValidationLifecycleIntegrity {
  readonly lifecycleState: EvidenceLifecycleState;
  readonly versionOrdinal: number;
  readonly immutableInputPreserved: true;
}

export interface EvidenceValidationRuntimeRecord {
  readonly validationId: string;
  readonly evidenceId: string;
  readonly evidenceObjectId: string;
  readonly evidenceVersionId: string;
  readonly outcome: EvidenceValidationRuntimeOutcome;
  readonly checks: readonly EvidenceValidationRuntimeCheck[];
  readonly replayTrace: EvidenceValidationReplayTrace;
  readonly certificationTrace: EvidenceValidationCertificationTrace;
  readonly lifecycleIntegrity: EvidenceValidationLifecycleIntegrity;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvidenceValidationRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface EvidenceValidationRuntimeFactoryOptions {
  readonly configuration: EvidenceValidationRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface EvidenceValidationRuntimeRegistryOptions {
  readonly factory: {
    createValidationRecord(
      evidence: EvidenceRuntimeObject,
      rules: readonly EvidenceValidationRuntimeRule[],
    ): EvidenceValidationRuntimeRecord;
  };
  readonly rules: readonly EvidenceValidationRuntimeRule[];
  readonly clock?: () => string;
}

export interface RegisteredEvidenceValidationRuntime {
  readonly record: EvidenceValidationRuntimeRecord;
  readonly evidence: EvidenceRuntimeObject;
  readonly registeredAt: string;
}
