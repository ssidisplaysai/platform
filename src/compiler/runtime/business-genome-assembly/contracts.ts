export type BusinessGenomeAssemblyLifecycleState = "DECLARED" | "ACTIVE" | "SUPERSEDED" | "RETIRED";

export interface BusinessGenomeAssemblyLifecycleEvent {
  readonly state: BusinessGenomeAssemblyLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface BusinessGenomeAssemblyLifecycle {
  readonly currentState: BusinessGenomeAssemblyLifecycleState;
  readonly history: readonly BusinessGenomeAssemblyLifecycleEvent[];
}

export interface BusinessGenomeAssemblyIdentity {
  readonly genomeId: string;
  readonly identityVersion: string;
  readonly canonicalCode: string;
}

export interface BusinessGenomeAssemblyVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface BusinessGenomeAssemblyLineage {
  readonly lineageId: string;
  readonly rootGenomeId: string;
  readonly parentVersionId?: string;
  readonly supersedesVersionId?: string;
  readonly retiredVersionId?: string;
  readonly appendOnly: true;
}

export interface BusinessGenomeAssemblyReplayLink {
  readonly replayId: string;
  readonly sourceManifestId: string;
  readonly deterministicFingerprint: string;
}

export interface BusinessGenomeAssemblyEvidenceLink {
  readonly evidenceId: string;
  readonly validationId: string;
  readonly certificationId: string;
}

export interface BusinessGenomeAssemblyProvenanceLink {
  readonly provenanceId: string;
  readonly sourceSystem: string;
  readonly sourceLocator: string;
  readonly recordedAt: string;
}

export interface BusinessGenomeAssemblyUpstreamLinks {
  readonly evidenceRuntimeObjectIds: readonly string[];
  readonly evidenceValidationRecordIds: readonly string[];
  readonly manifestRecordIds: readonly string[];
  readonly replayRecordIds: readonly string[];
  readonly ibrRecordIds: readonly string[];
  readonly entityRecordIds: readonly string[];
  readonly relationshipRecordIds: readonly string[];
  readonly businessRuleRecordIds: readonly string[];
}

export interface BusinessGenomeAssemblyOutput {
  readonly objectId: string;
  readonly identity: BusinessGenomeAssemblyIdentity;
  readonly title: string;
  readonly description?: string;
  readonly replayLink: BusinessGenomeAssemblyReplayLink;
  readonly evidenceLinks: readonly BusinessGenomeAssemblyEvidenceLink[];
  readonly provenance: readonly BusinessGenomeAssemblyProvenanceLink[];
  readonly unresolvedStateIds: readonly string[];
  readonly contradictoryEvidenceIds: readonly string[];
  readonly upstreamLinks: BusinessGenomeAssemblyUpstreamLinks;
  readonly lifecycle: BusinessGenomeAssemblyLifecycle;
  readonly lineage: BusinessGenomeAssemblyLineage;
  readonly version: BusinessGenomeAssemblyVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessGenomeAssemblyRuntimeCreateInput {
  readonly canonicalCode: string;
  readonly title: string;
  readonly description?: string;
  readonly replayLink: {
    readonly replayId: string;
    readonly sourceManifestId: string;
  };
  readonly evidenceLinks?: readonly BusinessGenomeAssemblyEvidenceLink[];
  readonly provenance?: readonly Omit<BusinessGenomeAssemblyProvenanceLink, "provenanceId">[];
  readonly unresolvedStateIds?: readonly string[];
  readonly contradictoryEvidenceIds?: readonly string[];
  readonly upstreamLinks: BusinessGenomeAssemblyUpstreamLinks;
}

export interface BusinessGenomeAssemblyRuntimeVersionChangeInput {
  readonly reason: string;
  readonly lifecycleTransition?: "ACTIVE" | "SUPERSEDED" | "RETIRED";
}

export interface BusinessGenomeAssemblyValidationResult {
  readonly validatorName: string;
  readonly checkedAt: string;
  readonly status: "pass" | "warn" | "fail";
  readonly code: string;
  readonly message: string;
}

export interface BusinessGenomeAssemblyValidatorResult {
  readonly status: "pass" | "warn" | "fail";
  readonly code: string;
  readonly message: string;
}

export interface BusinessGenomeAssemblyValidator {
  readonly name: string;
  validate(output: BusinessGenomeAssemblyOutput): BusinessGenomeAssemblyValidatorResult;
}

export interface BusinessGenomeAssemblyRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface BusinessGenomeAssemblyRuntimeFactoryOptions {
  readonly configuration: BusinessGenomeAssemblyRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface BusinessGenomeAssemblyRuntimeRegistryOptions {
  readonly factory: {
    validateGenome(
      output: BusinessGenomeAssemblyOutput,
      validators: readonly BusinessGenomeAssemblyValidator[],
    ): readonly BusinessGenomeAssemblyValidationResult[];
  };
  readonly validators?: readonly BusinessGenomeAssemblyValidator[];
  readonly clock?: () => string;
}

export interface RegisteredBusinessGenomeAssemblyRuntime {
  readonly output: BusinessGenomeAssemblyOutput;
  readonly validation: readonly BusinessGenomeAssemblyValidationResult[];
  readonly registeredAt: string;
}
