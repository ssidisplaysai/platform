import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type {
  RelationshipCardinality,
  RelationshipClassification,
  RelationshipDirectionality,
  RelationshipLineageLink,
  RelationshipProvenanceLink,
  RelationshipRuntimeCreateInput,
  RelationshipRuntimeFactoryOptions,
  RelationshipRuntimeObject,
  RelationshipValidationResult,
  RelationshipValidator,
} from "./contracts";

const CLASSIFICATION_DIRECTIONALITY: Readonly<Record<RelationshipClassification, readonly RelationshipDirectionality[]>> = {
  PARENT_CHILD: ["UNIDIRECTIONAL"],
  OWNERSHIP: ["UNIDIRECTIONAL"],
  MEMBERSHIP: ["UNIDIRECTIONAL", "BIDIRECTIONAL"],
  CONTAINMENT: ["UNIDIRECTIONAL"],
  DEPENDENCY: ["UNIDIRECTIONAL"],
  REFERENCE: ["UNIDIRECTIONAL", "BIDIRECTIONAL"],
  ASSOCIATION: ["UNIDIRECTIONAL", "BIDIRECTIONAL"],
};

const CLASSIFICATION_CARDINALITY: Readonly<Record<RelationshipClassification, readonly RelationshipCardinality[]>> = {
  PARENT_CHILD: ["ONE_TO_ONE", "ONE_TO_MANY"],
  OWNERSHIP: ["ONE_TO_ONE", "ONE_TO_MANY"],
  MEMBERSHIP: ["MANY_TO_MANY", "MANY_TO_ONE", "ONE_TO_MANY"],
  CONTAINMENT: ["ONE_TO_ONE", "ONE_TO_MANY"],
  DEPENDENCY: ["ONE_TO_ONE", "MANY_TO_ONE", "MANY_TO_MANY"],
  REFERENCE: ["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"],
  ASSOCIATION: ["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"],
};

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

function normalizeProvenance(
  relationshipSeed: Pick<RelationshipRuntimeCreateInput, "fromEntityId" | "toEntityId" | "classification" | "directionality" | "cardinality">,
  input: RelationshipRuntimeCreateInput["provenance"],
): readonly RelationshipProvenanceLink[] {
  const rows = (input ?? []).map((row) => ({
    sourceSystem: row.sourceSystem.trim(),
    sourceLocator: row.sourceLocator.trim(),
    recordedAt: row.recordedAt.trim(),
  }));

  const orderedRows = rows
    .filter((row) => row.sourceSystem.length > 0 && row.sourceLocator.length > 0 && row.recordedAt.length > 0)
    .sort((left, right) => {
      const leftKey = `${left.recordedAt}:${left.sourceSystem}:${left.sourceLocator}`;
      const rightKey = `${right.recordedAt}:${right.sourceSystem}:${right.sourceLocator}`;
      return leftKey.localeCompare(rightKey);
    });

  return orderedRows.map((row) => ({
    provenanceId: hashFromObject({ relationshipSeed, ...row }),
    sourceSystem: row.sourceSystem,
    sourceLocator: row.sourceLocator,
    recordedAt: row.recordedAt,
  }));
}

function validateRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Relationship ${fieldName} is required`);
  }

  return normalized;
}

function validateConfidence(score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error("Relationship confidence score must be between 0 and 1");
  }
}

export class RelationshipRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: RelationshipRuntimeFactoryOptions["configuration"];

  public constructor(options: RelationshipRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createRelationship(input: RelationshipRuntimeCreateInput): RelationshipRuntimeObject {
    const fromEntityId = validateRequiredText(input.fromEntityId, "fromEntityId");
    const toEntityId = validateRequiredText(input.toEntityId, "toEntityId");
    if (fromEntityId === toEntityId) {
      throw new Error("Relationship entity linkage must reference two distinct entities");
    }

    validateConfidence(input.confidence.score);

    if (!CLASSIFICATION_DIRECTIONALITY[input.classification].includes(input.directionality)) {
      throw new Error(
        `Relationship directionality ${input.directionality} is not allowed for classification ${input.classification}`,
      );
    }

    if (!CLASSIFICATION_CARDINALITY[input.classification].includes(input.cardinality)) {
      throw new Error(`Relationship cardinality ${input.cardinality} is not allowed for classification ${input.classification}`);
    }

    const createdAt = this.clock();
    const normalizedMethod = validateRequiredText(input.confidence.method, "confidence.method");
    const normalizedRationale = input.confidence.rationale?.trim();

    const relationshipSeed = {
      fromEntityId,
      toEntityId,
      classification: input.classification,
      directionality: input.directionality,
      cardinality: input.cardinality,
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      programVersion: this.configuration.programVersion,
      schemaVersion: this.configuration.schemaVersion,
    };

    const relationshipId = hashFromObject(relationshipSeed);
    const provenance = normalizeProvenance(relationshipSeed, input.provenance);
    const lineageCapturedAt = input.lineage?.capturedAt?.trim() || createdAt;

    const lineage: RelationshipLineageLink = {
      lineageId: hashFromObject({
        relationshipId,
        parentRelationshipId: input.lineage?.parentRelationshipId,
        rootRelationshipId: input.lineage?.rootRelationshipId ?? relationshipId,
      }),
      parentRelationshipId: input.lineage?.parentRelationshipId,
      rootRelationshipId: input.lineage?.rootRelationshipId ?? relationshipId,
      capturedAt: lineageCapturedAt,
    };

    const sourceManifestId = validateRequiredText(input.replay?.sourceManifestId ?? `manifest:${relationshipId}`, "replay.sourceManifestId");
    const replaySalt = input.replay?.replaySalt?.trim() ?? "default";
    const replayFingerprintSeed = {
      relationshipId,
      lineageId: lineage.lineageId,
      sourceManifestId,
      replaySalt,
    };

    const relationship: RelationshipRuntimeObject = {
      objectId: hashFromObject({ relationshipId, lineageId: lineage.lineageId, confidence: input.confidence.score }),
      identity: {
        relationshipId,
        identityVersion: hashFromObject({ relationshipId, schemaVersion: this.configuration.schemaVersion }),
      },
      entityLinkage: {
        fromEntityId,
        toEntityId,
      },
      directionality: input.directionality,
      cardinality: input.cardinality,
      classification: input.classification,
      confidence: {
        score: input.confidence.score,
        method: normalizedMethod,
        rationale: normalizedRationale,
      },
      provenance,
      lineage,
      replayLink: {
        replayId: hashFromObject({ relationshipId, sourceManifestId, replaySalt }),
        deterministicFingerprint: hashFromObject(replayFingerprintSeed),
        sourceManifestId,
        createdAt,
      },
      createdAt,
      updatedAt: createdAt,
    };

    return deepFreeze(relationship);
  }

  public validateRelationship(
    relationship: RelationshipRuntimeObject,
    validators: readonly RelationshipValidator[],
  ): readonly RelationshipValidationResult[] {
    const checkedAt = this.clock();
    const ordered = [...validators].sort((left, right) => left.name.localeCompare(right.name));

    const results = ordered.map((validator) => {
      try {
        const result = validator.validate(relationship);
        return {
          validatorName: validator.name,
          status: result.status,
          code: result.code,
          message: result.message,
          checkedAt,
        } as RelationshipValidationResult;
      } catch (error) {
        return {
          validatorName: validator.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as RelationshipValidationResult;
      }
    });

    return deepFreeze(results);
  }
}
