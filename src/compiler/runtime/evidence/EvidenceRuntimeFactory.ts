import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type {
  EvidenceCertificationReference,
  EvidenceHealthCheck,
  EvidenceHealthStatus,
  EvidenceLifecycle,
  EvidenceLifecycleEvent,
  EvidenceLifecycleState,
  EvidenceMetadata,
  EvidenceProvenanceReference,
  EvidenceReplayReference,
  EvidenceRuntimeCreateInput,
  EvidenceRuntimeFactoryOptions,
  EvidenceRuntimeObject,
  EvidenceState,
  EvidenceValidationResult,
  EvidenceValidator,
  EvidenceVersion,
  EvidenceVersionChangeInput,
} from "./contracts";

const ALLOWED_LIFECYCLE_TRANSITIONS: Readonly<Record<EvidenceLifecycleState, readonly EvidenceLifecycleState[]>> = {
  DECLARED: ["VALIDATED", "REJECTED"],
  VALIDATED: ["CERTIFIED", "REJECTED", "SUPERSEDED"],
  CERTIFIED: ["SUPERSEDED", "RETIRED"],
  SUPERSEDED: ["RETIRED"],
  RETIRED: [],
  REJECTED: [],
};

function normalizeReadonlyArray(values: readonly string[] | undefined): readonly string[] {
  return [...(values ?? [])].map((value) => value.trim()).filter((value) => value.length > 0).sort();
}

function normalizeReadonlyRecord(values: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  if (!values) {
    return {};
  }

  const entries = Object.entries(values)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key]) => key.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

function normalizeEvidenceReferences(evidenceReferences: readonly string[] | undefined): readonly string[] {
  return [...(evidenceReferences ?? [])].map((value) => value.trim()).filter((value) => value.length > 0).sort();
}

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

export class EvidenceRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: EvidenceRuntimeFactoryOptions["configuration"];

  public constructor(options: EvidenceRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createEvidenceObject(input: EvidenceRuntimeCreateInput): EvidenceRuntimeObject {
    const now = this.clock();
    const normalizedTags = normalizeReadonlyArray(input.tags);
    const normalizedAttributes = normalizeReadonlyRecord(input.attributes);
    const normalizedHandlingRequirements = normalizeReadonlyArray(input.classification?.handlingRequirements);
    const classificationDomain = (input.classification?.domain ?? "general").trim();
    const certificationReferences = normalizeEvidenceReferences(input.certificationEvidenceReferences);

    const identitySeed = {
      sourceNamespace: input.sourceNamespace,
      sourceReference: input.sourceReference,
      canonicalLocator: input.canonicalLocator,
      capturedAt: input.capturedAt,
      title: input.title,
      mediaType: input.mediaType,
      producer: input.producer,
      payloadReference: input.payloadReference,
      language: input.language,
      tags: normalizedTags,
      attributes: normalizedAttributes,
      classificationLevel: input.classification?.level ?? "INTERNAL",
      classificationDomain,
      handlingRequirements: normalizedHandlingRequirements,
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      programVersion: this.configuration.programVersion,
    };

    const evidenceId = hashFromObject(identitySeed);
    const manifestId = this.deriveManifestId(evidenceId);

    const metadata: EvidenceMetadata = {
      title: input.title,
      mediaType: input.mediaType,
      producer: input.producer,
      capturedAt: input.capturedAt,
      language: input.language,
      tags: normalizedTags,
      attributes: normalizedAttributes,
    };

    const lifecycle: EvidenceLifecycle = {
      currentState: "DECLARED",
      history: [
        {
          state: "DECLARED",
          at: now,
          reason: "evidence object created",
        },
      ],
    };

    const version: EvidenceVersion = {
      versionId: hashFromObject({ evidenceId, ordinal: 1, reason: "initial creation", schemaVersion: this.configuration.schemaVersion }),
      ordinal: 1,
      schemaVersion: this.configuration.schemaVersion,
      reason: "initial creation",
      createdAt: now,
    };

    const certification: EvidenceCertificationReference = {
      certificationId: hashFromObject({ evidenceId, certificationReferences }),
      readiness: certificationReferences.length === 0 ? "PENDING" : "READY",
      evidenceReferences: certificationReferences,
    };

    const replayReference: EvidenceReplayReference = {
      replayId: hashFromObject({ evidenceId, manifestId, versionId: version.versionId, payloadReference: input.payloadReference }),
      deterministicFingerprint: hashFromObject({ evidenceId, payloadReference: input.payloadReference, versionOrdinal: version.ordinal }),
      sourceManifestId: manifestId,
      createdAt: now,
    };

    const evidence: EvidenceRuntimeObject = {
      objectId: hashFromObject({ evidenceId, versionId: version.versionId }),
      identity: {
        evidenceId,
        sourceNamespace: input.sourceNamespace,
        sourceReference: input.sourceReference,
        canonicalLocator: input.canonicalLocator,
      },
      metadata,
      state: "PENDING_VALIDATION",
      lifecycle,
      classification: {
        level: input.classification?.level ?? "INTERNAL",
        domain: classificationDomain,
        handlingRequirements: normalizedHandlingRequirements,
      },
      version,
      hash: {
        algorithm: "sha256",
        digest: hashFromObject({ evidenceId, payloadReference: input.payloadReference }),
        payloadReference: input.payloadReference,
      },
      provenance: this.createProvenance(evidenceId, input.provenance),
      manifestReference: {
        manifestId,
        runtimeId: this.configuration.runtimeId,
        compilerVersion: this.configuration.compilerVersion,
        specificationVersion: this.configuration.specificationVersion,
        createdAt: now,
      },
      replayReference,
      certification,
      createdAt: now,
      updatedAt: now,
    };

    return deepFreeze(evidence);
  }

  public createNextVersion(current: EvidenceRuntimeObject, change: EvidenceVersionChangeInput): EvidenceRuntimeObject {
    const now = this.clock();
    const nextOrdinal = current.version.ordinal + 1;
    const nextState = change.state ?? current.state;
    const nextLifecycleState = change.lifecycleState ?? current.lifecycle.currentState;

    this.validateLifecycleTransition(current.lifecycle.currentState, nextLifecycleState);

    const nextLifecycle = this.evolveLifecycle(
      current.lifecycle,
      nextLifecycleState,
      change.lifecycleReason ?? change.reason,
      now,
    );

    const nextMetadata: EvidenceMetadata = {
      title: change.title ?? current.metadata.title,
      mediaType: change.mediaType ?? current.metadata.mediaType,
      producer: change.producer ?? current.metadata.producer,
      capturedAt: change.capturedAt ?? current.metadata.capturedAt,
      language: change.language ?? current.metadata.language,
      tags: normalizeReadonlyArray(change.tags ?? current.metadata.tags),
      attributes: normalizeReadonlyRecord(change.attributes ?? current.metadata.attributes),
    };

    const nextVersion: EvidenceVersion = {
      versionId: hashFromObject({
        evidenceId: current.identity.evidenceId,
        ordinal: nextOrdinal,
        reason: change.reason,
        schemaVersion: this.configuration.schemaVersion,
        previousVersionId: current.version.versionId,
      }),
      ordinal: nextOrdinal,
      schemaVersion: this.configuration.schemaVersion,
      previousVersionId: current.version.versionId,
      reason: change.reason,
      createdAt: now,
    };

    const nextObject: EvidenceRuntimeObject = {
      ...current,
      objectId: hashFromObject({ evidenceId: current.identity.evidenceId, versionId: nextVersion.versionId }),
      metadata: nextMetadata,
      state: nextState,
      lifecycle: nextLifecycle,
      classification: {
        level: change.classification?.level ?? current.classification.level,
        domain: (change.classification?.domain ?? current.classification.domain).trim(),
        handlingRequirements: normalizeReadonlyArray(
          change.classification?.handlingRequirements ?? current.classification.handlingRequirements,
        ),
      },
      version: nextVersion,
      hash: {
        algorithm: "sha256",
        digest: hashFromObject({ evidenceId: current.identity.evidenceId, payloadReference: change.payloadReference }),
        payloadReference: change.payloadReference,
      },
      replayReference: {
        replayId: hashFromObject({
          evidenceId: current.identity.evidenceId,
          manifestId: current.manifestReference.manifestId,
          versionId: nextVersion.versionId,
          payloadReference: change.payloadReference,
        }),
        deterministicFingerprint: hashFromObject({
          evidenceId: current.identity.evidenceId,
          payloadReference: change.payloadReference,
          versionOrdinal: nextOrdinal,
        }),
        sourceManifestId: current.manifestReference.manifestId,
        createdAt: now,
      },
      updatedAt: now,
    };

    return deepFreeze(nextObject);
  }

  public validateEvidenceObject(
    evidence: EvidenceRuntimeObject,
    validators: readonly EvidenceValidator[],
  ): readonly EvidenceValidationResult[] {
    const now = this.clock();
    const results = validators.map((validator) => {
      const result = validator.validate(evidence);
      return {
        validatorName: validator.name,
        status: result.status,
        code: result.code,
        message: result.message,
        checkedAt: now,
      } as EvidenceValidationResult;
    });

    return deepFreeze(results);
  }

  public deriveHealthStatus(
    evidence: EvidenceRuntimeObject,
    validationResults: readonly EvidenceValidationResult[],
  ): EvidenceHealthStatus {
    const checks: EvidenceHealthCheck[] = [];

    const hasFail = validationResults.some((result) => result.status === "fail");
    const hasWarn = validationResults.some((result) => result.status === "warn");

    checks.push({
      name: "validation-results",
      status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
      detail: `${validationResults.length} validator results`,
    });

    checks.push({
      name: "lifecycle-state",
      status: evidence.lifecycle.currentState === "REJECTED" ? "fail" : "pass",
      detail: `current lifecycle state ${evidence.lifecycle.currentState}`,
    });

    checks.push({
      name: "evidence-state",
      status: evidence.state === "QUARANTINED" ? "warn" : "pass",
      detail: `current evidence state ${evidence.state}`,
    });

    const status = checks.some((check) => check.status === "fail")
      ? "unhealthy"
      : checks.some((check) => check.status === "warn")
        ? "degraded"
        : "healthy";

    return deepFreeze({
      status,
      checkedAt: this.clock(),
      checks,
    });
  }

  private validateLifecycleTransition(from: EvidenceLifecycleState, to: EvidenceLifecycleState): void {
    if (from === to) {
      return;
    }

    const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid evidence lifecycle transition: ${from} -> ${to}`);
    }
  }

  private deriveManifestId(evidenceId: string): string {
    return hashFromObject({
      runtimeId: this.configuration.runtimeId,
      evidenceId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      programVersion: this.configuration.programVersion,
    });
  }

  private createProvenance(
    evidenceId: string,
    entries: readonly Omit<EvidenceProvenanceReference, "provenanceId">[] | undefined,
  ): readonly EvidenceProvenanceReference[] {
    const normalized = [...(entries ?? [])].map((entry) => ({
      sourceSystem: entry.sourceSystem.trim(),
      sourceLocator: entry.sourceLocator.trim(),
      recordedAt: entry.recordedAt,
    }));

    normalized.sort((left, right) => {
      const leftKey = `${left.sourceSystem}|${left.sourceLocator}|${left.recordedAt}`;
      const rightKey = `${right.sourceSystem}|${right.sourceLocator}|${right.recordedAt}`;
      return leftKey.localeCompare(rightKey);
    });

    return normalized.map((entry, index) => ({
      provenanceId: hashFromObject({ evidenceId, index, entry }),
      sourceSystem: entry.sourceSystem,
      sourceLocator: entry.sourceLocator,
      recordedAt: entry.recordedAt,
    }));
  }

  private evolveLifecycle(
    lifecycle: EvidenceLifecycle,
    nextState: EvidenceLifecycleState,
    reason: string,
    at: string,
  ): EvidenceLifecycle {
    if (lifecycle.currentState === nextState) {
      return lifecycle;
    }

    const nextEvent: EvidenceLifecycleEvent = {
      state: nextState,
      at,
      reason,
    };

    return {
      currentState: nextState,
      history: [...lifecycle.history, nextEvent],
    };
  }
}