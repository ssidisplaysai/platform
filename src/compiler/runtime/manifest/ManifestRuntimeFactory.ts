import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type {
  ManifestRuntimeCheck,
  ManifestRuntimeCheckStatus,
  ManifestRuntimeCreateOptions,
  ManifestRuntimeFactoryOptions,
  ManifestRuntimeOutcome,
  ManifestRuntimeRecord,
  ManifestRuntimeRule,
} from "./contracts";

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

function normalizeUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function orderRecords(records: readonly EvidenceValidationRuntimeRecord[]): readonly EvidenceValidationRuntimeRecord[] {
  return [...records].sort((left, right) => {
    const leftKey = `${left.evidenceId}:${left.evidenceVersionId}:${left.validationId}`;
    const rightKey = `${right.evidenceId}:${right.evidenceVersionId}:${right.validationId}`;
    return leftKey.localeCompare(rightKey);
  });
}

export class ManifestRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: ManifestRuntimeFactoryOptions["configuration"];

  public constructor(options: ManifestRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createManifestRecord(
    records: readonly EvidenceValidationRuntimeRecord[],
    rules: readonly ManifestRuntimeRule[],
    options: ManifestRuntimeCreateOptions,
  ): ManifestRuntimeRecord {
    const createdAt = this.clock();
    const orderedRecords = orderRecords(records);
    const checks = this.evaluateChecks(orderedRecords, rules, createdAt);
    const outcome = this.deriveOutcome(orderedRecords, checks);

    const entries = deepFreeze(
      orderedRecords.map((record) => ({
        evidenceId: record.evidenceId,
        evidenceObjectId: record.evidenceObjectId,
        evidenceVersionId: record.evidenceVersionId,
        validationId: record.validationId,
        validationOutcome: record.outcome,
        validationDigest: record.certificationTrace.validationDigest,
        sourceManifestId: record.replayTrace.sourceManifestId,
        sourceReplayId: record.replayTrace.sourceReplayId,
        sourceCertificationId: record.certificationTrace.sourceCertificationId,
        lifecycleState: record.lifecycleIntegrity.lifecycleState,
        versionOrdinal: record.lifecycleIntegrity.versionOrdinal,
      })),
    );

    const digestMaterialChecks = checks.map((check) => ({
      validatorName: check.validatorName,
      status: check.status,
      code: check.code,
      message: check.message,
    }));

    const manifestDigest = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      schemaVersion: this.configuration.schemaVersion,
      entries,
      checks: digestMaterialChecks,
      outcome,
    });

    const manifestId = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      manifestDigest,
      evidenceIds: entries.map((entry) => entry.evidenceId),
    });

    const previousVersionId = options.previousRecord?.version.versionId;
    const versionOrdinal = (options.previousRecord?.version.ordinal ?? 0) + 1;

    const replayTrace = {
      sourceReplayIds: normalizeUnique(entries.map((entry) => entry.sourceReplayId)),
      sourceManifestIds: normalizeUnique(entries.map((entry) => entry.sourceManifestId)),
      deterministicFingerprint: hashFromObject({
        manifestDigest,
        sourceReplayIds: normalizeUnique(entries.map((entry) => entry.sourceReplayId)),
        sourceManifestIds: normalizeUnique(entries.map((entry) => entry.sourceManifestId)),
      }),
    };

    const certificationTrace = {
      sourceCertificationIds: normalizeUnique(entries.map((entry) => entry.sourceCertificationId)),
      sourceValidationDigests: normalizeUnique(entries.map((entry) => entry.validationDigest)),
      evidenceReferences: normalizeUnique(
        orderedRecords.flatMap((record) => [...record.certificationTrace.evidenceReferences]),
      ),
      readiness:
        outcome === "BLOCKED" || orderedRecords.some((record) => record.certificationTrace.readiness === "PENDING")
          ? "PENDING"
          : "READY",
    } as const;

    const lifecycleIntegrity = {
      sourceLifecycleStates: normalizeUnique(entries.map((entry) => entry.lifecycleState)),
      highestSourceVersionOrdinal: entries.reduce((highest, entry) => Math.max(highest, entry.versionOrdinal), 0),
      immutableInputPreserved: true as const,
    };

    const version = {
      versionId: hashFromObject({
        manifestId,
        versionOrdinal,
        reason: options.reason,
        previousVersionId,
        schemaVersion: this.configuration.schemaVersion,
      }),
      ordinal: versionOrdinal,
      previousVersionId,
      schemaVersion: this.configuration.schemaVersion,
      reason: options.reason,
      createdAt,
    };

    const record: ManifestRuntimeRecord = {
      manifestId,
      manifestDigest,
      outcome,
      checks,
      entries,
      replayTrace,
      certificationTrace,
      lifecycleIntegrity,
      version,
      createdAt,
      updatedAt: createdAt,
    };

    return deepFreeze(record);
  }

  private evaluateChecks(
    records: readonly EvidenceValidationRuntimeRecord[],
    rules: readonly ManifestRuntimeRule[],
    checkedAt: string,
  ): readonly ManifestRuntimeCheck[] {
    const orderedRules = [...rules].sort((left, right) => left.name.localeCompare(right.name));

    const checks = orderedRules.map((rule) => {
      try {
        const result = rule.validate(records);
        return {
          validatorName: rule.name,
          status: result.status,
          code: result.code,
          message: result.message,
          checkedAt,
        } as ManifestRuntimeCheck;
      } catch (error) {
        return {
          validatorName: rule.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as ManifestRuntimeCheck;
      }
    });

    return deepFreeze(checks);
  }

  private deriveOutcome(
    records: readonly EvidenceValidationRuntimeRecord[],
    checks: readonly ManifestRuntimeCheck[],
  ): ManifestRuntimeOutcome {
    if (records.some((record) => record.outcome === "INVALID")) {
      return "BLOCKED";
    }

    const statusOrder: Record<ManifestRuntimeCheckStatus, number> = {
      pass: 0,
      warn: 1,
      fail: 2,
    };

    const highest = checks.reduce<ManifestRuntimeCheckStatus>(
      (current, check) => (statusOrder[check.status] > statusOrder[current] ? check.status : current),
      "pass",
    );

    if (highest === "fail") {
      return "BLOCKED";
    }

    if (highest === "warn") {
      return "WARN";
    }

    return "READY";
  }
}
