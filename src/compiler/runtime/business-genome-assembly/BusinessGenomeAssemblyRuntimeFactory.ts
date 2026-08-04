import { stableStringify } from "../../core/stableStringify";
import { SourceHash } from "../../provenance/SourceHash";
import { deepFreeze } from "../foundation/immutability";
import type {
  BusinessGenomeAssemblyEvidenceLink,
  BusinessGenomeAssemblyLifecycleState,
  BusinessGenomeAssemblyOutput,
  BusinessGenomeAssemblyProvenanceLink,
  BusinessGenomeAssemblyRuntimeCreateInput,
  BusinessGenomeAssemblyRuntimeFactoryOptions,
  BusinessGenomeAssemblyRuntimeVersionChangeInput,
  BusinessGenomeAssemblyUpstreamLinks,
  BusinessGenomeAssemblyValidationResult,
  BusinessGenomeAssemblyValidator,
} from "./contracts";

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

function normalizeText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Business genome assembly ${fieldName} is required`);
  }

  return normalized;
}

function normalizeUniqueText(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function normalizeEvidenceLinks(
  links: readonly BusinessGenomeAssemblyEvidenceLink[] | undefined,
): readonly BusinessGenomeAssemblyEvidenceLink[] {
  return [...(links ?? [])]
    .map((link) => ({
      evidenceId: normalizeText(link.evidenceId, "evidenceLink.evidenceId"),
      validationId: normalizeText(link.validationId, "evidenceLink.validationId"),
      certificationId: normalizeText(link.certificationId, "evidenceLink.certificationId"),
    }))
    .sort((left, right) => {
      const leftKey = `${left.evidenceId}:${left.validationId}:${left.certificationId}`;
      const rightKey = `${right.evidenceId}:${right.validationId}:${right.certificationId}`;
      return leftKey.localeCompare(rightKey);
    });
}

function normalizeProvenance(
  seed: Readonly<Record<string, unknown>>,
  provenance: readonly Omit<BusinessGenomeAssemblyProvenanceLink, "provenanceId">[] | undefined,
): readonly BusinessGenomeAssemblyProvenanceLink[] {
  const rows = (provenance ?? [])
    .map((row) => ({
      sourceSystem: normalizeText(row.sourceSystem, "provenance.sourceSystem"),
      sourceLocator: normalizeText(row.sourceLocator, "provenance.sourceLocator"),
      recordedAt: normalizeText(row.recordedAt, "provenance.recordedAt"),
    }))
    .sort((left, right) => {
      const leftKey = `${left.recordedAt}:${left.sourceSystem}:${left.sourceLocator}`;
      const rightKey = `${right.recordedAt}:${right.sourceSystem}:${right.sourceLocator}`;
      return leftKey.localeCompare(rightKey);
    });

  return rows.map((row) => ({
    provenanceId: hashFromObject({ seed, ...row }),
    sourceSystem: row.sourceSystem,
    sourceLocator: row.sourceLocator,
    recordedAt: row.recordedAt,
  }));
}

function normalizeUpstreamLinks(links: BusinessGenomeAssemblyUpstreamLinks): BusinessGenomeAssemblyUpstreamLinks {
  return {
    evidenceRuntimeObjectIds: normalizeUniqueText(links.evidenceRuntimeObjectIds),
    evidenceValidationRecordIds: normalizeUniqueText(links.evidenceValidationRecordIds),
    manifestRecordIds: normalizeUniqueText(links.manifestRecordIds),
    replayRecordIds: normalizeUniqueText(links.replayRecordIds),
    ibrRecordIds: normalizeUniqueText(links.ibrRecordIds),
    entityRecordIds: normalizeUniqueText(links.entityRecordIds),
    relationshipRecordIds: normalizeUniqueText(links.relationshipRecordIds),
    businessRuleRecordIds: normalizeUniqueText(links.businessRuleRecordIds),
  };
}

function deriveLifecycleState(
  currentState: BusinessGenomeAssemblyOutput["lifecycle"]["currentState"],
  transition: BusinessGenomeAssemblyRuntimeVersionChangeInput["lifecycleTransition"],
): BusinessGenomeAssemblyLifecycleState {
  if (!transition) {
    return currentState;
  }

  return transition;
}

export class BusinessGenomeAssemblyRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: BusinessGenomeAssemblyRuntimeFactoryOptions["configuration"];

  public constructor(options: BusinessGenomeAssemblyRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createGenome(input: BusinessGenomeAssemblyRuntimeCreateInput): BusinessGenomeAssemblyOutput {
    const createdAt = this.clock();
    const canonicalCode = normalizeText(input.canonicalCode, "canonicalCode").toUpperCase();
    const title = normalizeText(input.title, "title");
    const description = input.description?.trim();
    const replayId = normalizeText(input.replayLink.replayId, "replayLink.replayId");
    const sourceManifestId = normalizeText(input.replayLink.sourceManifestId, "replayLink.sourceManifestId");
    const upstreamLinks = normalizeUpstreamLinks(input.upstreamLinks);
    const unresolvedStateIds = normalizeUniqueText(input.unresolvedStateIds);
    const contradictoryEvidenceIds = normalizeUniqueText(input.contradictoryEvidenceIds);
    const evidenceLinks = normalizeEvidenceLinks(input.evidenceLinks);

    const seed = {
      canonicalCode,
      title,
      description,
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      programVersion: this.configuration.programVersion,
      schemaVersion: this.configuration.schemaVersion,
      upstreamLinks,
      unresolvedStateIds,
      contradictoryEvidenceIds,
      evidenceLinks,
    };

    const genomeId = hashFromObject(seed);
    const versionOrdinal = 1;
    const versionReason = "initial assembly";
    const versionId = hashFromObject({ genomeId, versionOrdinal, versionReason, createdAt });
    const lineageId = hashFromObject({ genomeId, root: genomeId, versionId });
    const deterministicFingerprint = hashFromObject({
      genomeId,
      replayId,
      sourceManifestId,
      versionId,
      upstreamLinks,
      unresolvedStateIds,
      contradictoryEvidenceIds,
    });

    const provenance = normalizeProvenance(seed, input.provenance);

    return deepFreeze({
      objectId: hashFromObject({ genomeId, versionId, deterministicFingerprint }),
      identity: {
        genomeId,
        identityVersion: "1",
        canonicalCode,
      },
      title,
      description,
      replayLink: {
        replayId,
        sourceManifestId,
        deterministicFingerprint,
      },
      evidenceLinks,
      provenance,
      unresolvedStateIds,
      contradictoryEvidenceIds,
      upstreamLinks,
      lifecycle: {
        currentState: "DECLARED",
        history: [
          {
            state: "DECLARED",
            at: createdAt,
            reason: "initial declaration",
          },
        ],
      },
      lineage: {
        lineageId,
        rootGenomeId: genomeId,
        appendOnly: true,
      },
      version: {
        versionId,
        ordinal: versionOrdinal,
        schemaVersion: this.configuration.schemaVersion,
        reason: versionReason,
        createdAt,
      },
      createdAt,
      updatedAt: createdAt,
    });
  }

  public createNextVersion(
    current: BusinessGenomeAssemblyOutput,
    input: BusinessGenomeAssemblyRuntimeVersionChangeInput,
  ): BusinessGenomeAssemblyOutput {
    const createdAt = this.clock();
    const reason = normalizeText(input.reason, "versionChange.reason");
    const nextOrdinal = current.version.ordinal + 1;
    const nextState = deriveLifecycleState(current.lifecycle.currentState, input.lifecycleTransition);

    const versionId = hashFromObject({
      genomeId: current.identity.genomeId,
      nextOrdinal,
      reason,
      createdAt,
      previousVersionId: current.version.versionId,
    });

    const nextLineage = {
      ...current.lineage,
      parentVersionId: current.version.versionId,
      supersedesVersionId: input.lifecycleTransition === "SUPERSEDED" ? current.version.versionId : current.lineage.supersedesVersionId,
      retiredVersionId: input.lifecycleTransition === "RETIRED" ? current.version.versionId : current.lineage.retiredVersionId,
    };

    const history = [
      ...current.lifecycle.history,
      {
        state: nextState,
        at: createdAt,
        reason,
      },
    ] as const;

    return deepFreeze({
      ...current,
      objectId: hashFromObject({ genomeId: current.identity.genomeId, versionId, replayId: current.replayLink.replayId }),
      lifecycle: {
        currentState: nextState,
        history,
      },
      lineage: nextLineage,
      version: {
        versionId,
        ordinal: nextOrdinal,
        previousVersionId: current.version.versionId,
        schemaVersion: current.version.schemaVersion,
        reason,
        createdAt,
      },
      updatedAt: createdAt,
    });
  }

  public validateGenome(
    output: BusinessGenomeAssemblyOutput,
    validators: readonly BusinessGenomeAssemblyValidator[],
  ): readonly BusinessGenomeAssemblyValidationResult[] {
    const checkedAt = this.clock();

    const validatorResults = validators.map((validator) => {
      try {
        const result = validator.validate(output);
        return {
          validatorName: validator.name,
          checkedAt,
          status: result.status,
          code: result.code,
          message: result.message,
        } as const;
      } catch (error) {
        return {
          validatorName: validator.name,
          checkedAt,
          status: "fail" as const,
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Unknown validator failure",
        };
      }
    });

    return deepFreeze([
      {
        validatorName: "deterministic-fingerprint",
        checkedAt,
        status: output.replayLink.deterministicFingerprint.length > 0 ? "pass" : "fail",
        code: output.replayLink.deterministicFingerprint.length > 0 ? "FINGERPRINT_PRESENT" : "FINGERPRINT_MISSING",
        message: output.replayLink.deterministicFingerprint.length > 0
          ? "deterministic replay fingerprint present"
          : "deterministic replay fingerprint missing",
      },
      ...validatorResults,
    ]);
  }
}
