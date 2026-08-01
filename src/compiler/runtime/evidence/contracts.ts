export type EvidenceLifecycleState =
  | "DECLARED"
  | "VALIDATED"
  | "CERTIFIED"
  | "SUPERSEDED"
  | "RETIRED"
  | "REJECTED";

export type EvidenceState = "PENDING_VALIDATION" | "READY" | "QUARANTINED" | "ARCHIVED";

export type EvidenceClassificationLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export type ValidationStatus = "pass" | "warn" | "fail";

export type EvidenceHealthLevel = "healthy" | "degraded" | "unhealthy";

export interface EvidenceLifecycleEvent {
  readonly state: EvidenceLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface EvidenceLifecycle {
  readonly currentState: EvidenceLifecycleState;
  readonly history: readonly EvidenceLifecycleEvent[];
}

export interface EvidenceIdentity {
  readonly evidenceId: string;
  readonly sourceNamespace: string;
  readonly sourceReference: string;
  readonly canonicalLocator: string;
}

export interface EvidenceMetadata {
  readonly title: string;
  readonly mediaType: string;
  readonly producer: string;
  readonly capturedAt: string;
  readonly language?: string;
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
}

export interface EvidenceClassification {
  readonly level: EvidenceClassificationLevel;
  readonly domain: string;
  readonly handlingRequirements: readonly string[];
}

export interface EvidenceVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly schemaVersion: string;
  readonly previousVersionId?: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface EvidenceHash {
  readonly algorithm: "sha256";
  readonly digest: string;
  readonly payloadReference: string;
}

export interface EvidenceManifestReference {
  readonly manifestId: string;
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly createdAt: string;
}

export interface EvidenceReplayReference {
  readonly replayId: string;
  readonly deterministicFingerprint: string;
  readonly sourceManifestId: string;
  readonly createdAt: string;
}

export interface EvidenceProvenanceReference {
  readonly provenanceId: string;
  readonly sourceSystem: string;
  readonly sourceLocator: string;
  readonly recordedAt: string;
}

export interface EvidenceCertificationReference {
  readonly certificationId: string;
  readonly readiness: "PENDING" | "READY";
  readonly evidenceReferences: readonly string[];
}

export interface EvidenceRuntimeObject {
  readonly objectId: string;
  readonly identity: EvidenceIdentity;
  readonly metadata: EvidenceMetadata;
  readonly state: EvidenceState;
  readonly lifecycle: EvidenceLifecycle;
  readonly classification: EvidenceClassification;
  readonly version: EvidenceVersion;
  readonly hash: EvidenceHash;
  readonly provenance: readonly EvidenceProvenanceReference[];
  readonly manifestReference: EvidenceManifestReference;
  readonly replayReference: EvidenceReplayReference;
  readonly certification: EvidenceCertificationReference;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvidenceValidationResult {
  readonly validatorName: string;
  readonly status: ValidationStatus;
  readonly code: string;
  readonly message: string;
  readonly checkedAt: string;
}

export interface EvidenceValidator {
  readonly name: string;
  validate(evidence: EvidenceRuntimeObject): Omit<EvidenceValidationResult, "validatorName" | "checkedAt">;
}

export interface EvidenceHealthCheck {
  readonly name: string;
  readonly status: ValidationStatus;
  readonly detail: string;
}

export interface EvidenceHealthStatus {
  readonly status: EvidenceHealthLevel;
  readonly checkedAt: string;
  readonly checks: readonly EvidenceHealthCheck[];
}

export interface EvidenceRuntimeCreateInput {
  readonly sourceNamespace: string;
  readonly sourceReference: string;
  readonly canonicalLocator: string;
  readonly title: string;
  readonly mediaType: string;
  readonly producer: string;
  readonly capturedAt: string;
  readonly payloadReference: string;
  readonly language?: string;
  readonly tags?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
  readonly classification?: {
    readonly level?: EvidenceClassificationLevel;
    readonly domain?: string;
    readonly handlingRequirements?: readonly string[];
  };
  readonly provenance?: readonly Omit<EvidenceProvenanceReference, "provenanceId">[];
  readonly certificationEvidenceReferences?: readonly string[];
}

export interface EvidenceVersionChangeInput {
  readonly reason: string;
  readonly payloadReference: string;
  readonly title?: string;
  readonly mediaType?: string;
  readonly producer?: string;
  readonly capturedAt?: string;
  readonly language?: string;
  readonly tags?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
  readonly classification?: {
    readonly level?: EvidenceClassificationLevel;
    readonly domain?: string;
    readonly handlingRequirements?: readonly string[];
  };
  readonly state?: EvidenceState;
  readonly lifecycleReason?: string;
  readonly lifecycleState?: EvidenceLifecycleState;
}

export interface EvidenceRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface EvidenceRuntimeFactoryOptions {
  readonly configuration: EvidenceRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}