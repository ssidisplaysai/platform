import type { IBRRuntimeRecord } from "../ibr/contracts";

export type EntityRuntimeCheckStatus = "pass" | "warn" | "fail";

export type EntityRuntimeOutcome = "READY" | "WARN" | "BLOCKED";

export type EntityRuntimeLifecycleState = "DECLARED" | "ACTIVE" | "BLOCKED" | "SUPERSEDED" | "RETIRED";

export type EntityIdentityResolutionStatus = "RESOLVED" | "UNRESOLVED" | "CONFLICTED";

export type EntityNameType =
  | "LEGAL"
  | "TRADE"
  | "HISTORICAL"
  | "ABBREVIATION"
  | "LOCALIZED"
  | "TRANSLATED"
  | "BRAND"
  | "ALIAS"
  | "UNKNOWN";

export type EntityClass =
  | "Organization"
  | "Division"
  | "Department"
  | "Team"
  | "Person"
  | "Role"
  | "Customer"
  | "Vendor"
  | "Supplier"
  | "Partner"
  | "Product"
  | "Service"
  | "Asset"
  | "Facility"
  | "Process"
  | "Policy"
  | "Document"
  | "Application"
  | "System"
  | "Dataset"
  | "Project"
  | "Capability"
  | "Unknown";

export type EntityObservationStance = "supporting" | "contradicting" | "unknown";

export interface EntityRuntimeLifecycleEvent {
  readonly state: EntityRuntimeLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface EntityRuntimeLifecycle {
  readonly currentState: EntityRuntimeLifecycleState;
  readonly history: readonly EntityRuntimeLifecycleEvent[];
}

export interface EntityRuntimeRuleResult {
  readonly status: EntityRuntimeCheckStatus;
  readonly code: string;
  readonly message: string;
}

export interface EntityRuntimeRule {
  readonly name: string;
  validate(input: EntityRuntimeCreateInput): EntityRuntimeRuleResult;
}

export interface EntityRuntimeCheck extends EntityRuntimeRuleResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface EntityIdentityObservation {
  readonly observationId: string;
  readonly sourceEvidenceId: string;
  readonly sourceValidationId: string;
  readonly sourceCertificationId: string;
  readonly nameType: EntityNameType;
  readonly rawName: string;
  readonly confidence: number;
  readonly stance: EntityObservationStance;
  readonly contradictsObservationIds?: readonly string[];
}

export interface EntityAlias {
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly nameType: EntityNameType;
}

export interface EntityDuplicateLink {
  readonly candidateId: string;
  readonly matchType: "duplicate" | "near-duplicate";
  readonly score: number;
}

export interface EntityConfidenceRecord {
  readonly score: number;
  readonly supportingCount: number;
  readonly contradictingCount: number;
  readonly unknownCount: number;
  readonly reproducible: true;
}

export interface EntityLineage {
  readonly sourceIbrId: string;
  readonly sourceIbrDigest: string;
  readonly sourceManifestId: string;
  readonly sourceReplayId: string;
  readonly sourceValidationIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceCertificationIds: readonly string[];
  readonly deterministicFingerprint: string;
}

export interface EntityVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface EntityRuntimeRecord {
  readonly entityId: string;
  readonly entityDigest: string;
  readonly candidateId: string;
  readonly entityClass: EntityClass;
  readonly identityStatus: EntityIdentityResolutionStatus;
  readonly canonicalName: string;
  readonly normalizedCanonicalName: string;
  readonly aliases: readonly EntityAlias[];
  readonly duplicateLinks: readonly EntityDuplicateLink[];
  readonly confidence: EntityConfidenceRecord;
  readonly contradictionObservationIds: readonly string[];
  readonly unresolvedReason?: string;
  readonly outcome: EntityRuntimeOutcome;
  readonly checks: readonly EntityRuntimeCheck[];
  readonly lifecycle: EntityRuntimeLifecycle;
  readonly lineage: EntityLineage;
  readonly version: EntityVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EntityRuntimeCreateInput {
  readonly ibrRecord: IBRRuntimeRecord;
  readonly entityClass: EntityClass;
  readonly observations: readonly EntityIdentityObservation[];
}

export interface EntityRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface EntityRuntimeFactoryOptions {
  readonly configuration: EntityRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface EntityRuntimeCreateOptions {
  readonly reason: string;
  readonly previousRecord?: EntityRuntimeRecord;
  readonly lifecycleTransition?: "ACTIVE" | "SUPERSEDED" | "RETIRED";
}

export interface EntityRuntimeRegistryOptions {
  readonly factory: {
    createEntityRecord(
      input: EntityRuntimeCreateInput,
      rules: readonly EntityRuntimeRule[],
      options: EntityRuntimeCreateOptions,
    ): EntityRuntimeRecord;
  };
  readonly rules: readonly EntityRuntimeRule[];
  readonly clock?: () => string;
}

export interface RegisteredEntityRuntime {
  readonly record: EntityRuntimeRecord;
  readonly ibrRecord: IBRRuntimeRecord;
  readonly observations: readonly EntityIdentityObservation[];
  readonly registeredAt: string;
}
