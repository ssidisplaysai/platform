import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type { EvidenceRuntimeObject } from "../evidence/contracts";
import type {
  EvidenceValidationRuntimeCheck,
  EvidenceValidationRuntimeCheckStatus,
  EvidenceValidationRuntimeFactoryOptions,
  EvidenceValidationRuntimeOutcome,
  EvidenceValidationRuntimeRecord,
  EvidenceValidationRuntimeRule,
} from "./contracts";

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

export class EvidenceValidationRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: EvidenceValidationRuntimeFactoryOptions["configuration"];

  public constructor(options: EvidenceValidationRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createValidationRecord(
    evidence: EvidenceRuntimeObject,
    rules: readonly EvidenceValidationRuntimeRule[],
  ): EvidenceValidationRuntimeRecord {
    const createdAt = this.clock();
    const checks = this.evaluateChecks(evidence, rules, createdAt);
    const outcome = this.deriveOutcome(checks);
    const validationDigest = hashFromObject({
      evidenceId: evidence.identity.evidenceId,
      evidenceObjectId: evidence.objectId,
      evidenceVersionId: evidence.version.versionId,
      checks,
      outcome,
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      schemaVersion: this.configuration.schemaVersion,
    });

    const record: EvidenceValidationRuntimeRecord = {
      validationId: hashFromObject({ evidenceObjectId: evidence.objectId, validationDigest }),
      evidenceId: evidence.identity.evidenceId,
      evidenceObjectId: evidence.objectId,
      evidenceVersionId: evidence.version.versionId,
      outcome,
      checks,
      replayTrace: {
        sourceReplayId: evidence.replayReference.replayId,
        sourceManifestId: evidence.replayReference.sourceManifestId,
        sourceDeterministicFingerprint: evidence.replayReference.deterministicFingerprint,
        validationDeterministicFingerprint: hashFromObject({
          validationDigest,
          sourceDeterministicFingerprint: evidence.replayReference.deterministicFingerprint,
        }),
      },
      certificationTrace: {
        sourceCertificationId: evidence.certification.certificationId,
        readiness: outcome === "INVALID" ? "PENDING" : evidence.certification.readiness,
        evidenceReferences: [...evidence.certification.evidenceReferences],
        validationDigest,
      },
      lifecycleIntegrity: {
        lifecycleState: evidence.lifecycle.currentState,
        versionOrdinal: evidence.version.ordinal,
        immutableInputPreserved: true,
      },
      createdAt,
      updatedAt: createdAt,
    };

    return deepFreeze(record);
  }

  private evaluateChecks(
    evidence: EvidenceRuntimeObject,
    rules: readonly EvidenceValidationRuntimeRule[],
    checkedAt: string,
  ): readonly EvidenceValidationRuntimeCheck[] {
    const orderedRules = [...rules].sort((left, right) => left.name.localeCompare(right.name));

    const checks = orderedRules.map((rule) => {
      try {
        const result = rule.validate(evidence);
        return {
          validatorName: rule.name,
          status: result.status,
          code: result.code,
          message: result.message,
          checkedAt,
        } as EvidenceValidationRuntimeCheck;
      } catch (error) {
        return {
          validatorName: rule.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as EvidenceValidationRuntimeCheck;
      }
    });

    return deepFreeze(checks);
  }

  private deriveOutcome(checks: readonly EvidenceValidationRuntimeCheck[]): EvidenceValidationRuntimeOutcome {
    const statusOrder: Record<EvidenceValidationRuntimeCheckStatus, number> = {
      pass: 0,
      warn: 1,
      fail: 2,
    };

    const highest = checks.reduce<EvidenceValidationRuntimeCheckStatus>(
      (current, check) => (statusOrder[check.status] > statusOrder[current] ? check.status : current),
      "pass",
    );

    if (highest === "fail") {
      return "INVALID";
    }

    if (highest === "warn") {
      return "WARN";
    }

    return "VALID";
  }
}
