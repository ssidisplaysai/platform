export type RelationshipDirectionality = "UNIDIRECTIONAL" | "BIDIRECTIONAL";

export type RelationshipCardinality = "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY";

export type RelationshipClassification =
  | "PARENT_CHILD"
  | "OWNERSHIP"
  | "MEMBERSHIP"
  | "CONTAINMENT"
  | "DEPENDENCY"
  | "REFERENCE"
  | "ASSOCIATION";

export type RelationshipValidationStatus = "pass" | "warn" | "fail";

export interface RelationshipIdentity {
  readonly relationshipId: string;
  readonly identityVersion: string;
}

export interface RelationshipEntityLinkage {
  readonly fromEntityId: string;
  readonly toEntityId: string;
}

export interface RelationshipConfidence {
  readonly score: number;
  readonly method: string;
  readonly rationale?: string;
}

export interface RelationshipProvenanceLink {
  readonly provenanceId: string;
  readonly sourceSystem: string;
  readonly sourceLocator: string;
  readonly recordedAt: string;
}

export interface RelationshipLineageLink {
  readonly lineageId: string;
  readonly parentRelationshipId?: string;
  readonly rootRelationshipId: string;
  readonly capturedAt: string;
}

export interface RelationshipReplayLink {
  readonly replayId: string;
  readonly deterministicFingerprint: string;
  readonly sourceManifestId: string;
  readonly createdAt: string;
}

export interface RelationshipRuntimeObject {
  readonly objectId: string;
  readonly identity: RelationshipIdentity;
  readonly entityLinkage: RelationshipEntityLinkage;
  readonly directionality: RelationshipDirectionality;
  readonly cardinality: RelationshipCardinality;
  readonly classification: RelationshipClassification;
  readonly confidence: RelationshipConfidence;
  readonly provenance: readonly RelationshipProvenanceLink[];
  readonly lineage: RelationshipLineageLink;
  readonly replayLink: RelationshipReplayLink;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RelationshipValidatorResult {
  readonly status: RelationshipValidationStatus;
  readonly code: string;
  readonly message: string;
}

export interface RelationshipValidationResult extends RelationshipValidatorResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface RelationshipValidator {
  readonly name: string;
  validate(relationship: RelationshipRuntimeObject): RelationshipValidatorResult;
}

export interface RelationshipRuntimeCreateInput {
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly directionality: RelationshipDirectionality;
  readonly cardinality: RelationshipCardinality;
  readonly classification: RelationshipClassification;
  readonly confidence: RelationshipConfidence;
  readonly provenance?: readonly Omit<RelationshipProvenanceLink, "provenanceId">[];
  readonly lineage?: {
    readonly parentRelationshipId?: string;
    readonly rootRelationshipId?: string;
    readonly capturedAt?: string;
  };
  readonly replay?: {
    readonly sourceManifestId: string;
    readonly replaySalt?: string;
  };
}

export interface RelationshipRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface RelationshipRuntimeFactoryOptions {
  readonly configuration: RelationshipRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface RelationshipRuntimeRegistryOptions {
  readonly factory: {
    validateRelationship(
      relationship: RelationshipRuntimeObject,
      validators: readonly RelationshipValidator[],
    ): readonly RelationshipValidationResult[];
  };
  readonly validators?: readonly RelationshipValidator[];
  readonly clock?: () => string;
}

export interface RegisteredRelationshipRuntime {
  readonly relationship: RelationshipRuntimeObject;
  readonly validation: readonly RelationshipValidationResult[];
  readonly registeredAt: string;
}
