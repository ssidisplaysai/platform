import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type { EvidenceRuntimeObject } from "../evidence/contracts";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type {
  IBRRuntimeCheck,
  IBRRuntimeCheckStatus,
  IBRRuntimeCreateInput,
  IBRRuntimeCreateOptions,
  IBRRuntimeFactoryOptions,
  IBRRuntimeGraph,
  IBRRuntimeGraphEdge,
  IBRRuntimeGraphNode,
  IBRRuntimeLifecycle,
  IBRRuntimeLifecycleState,
  IBRRuntimeOutcome,
  IBRRuntimeRecord,
  IBRRuntimeRule,
  IBRRuntimeRuleResult,
} from "./contracts";

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

function normalizeUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function orderValidationRecords(records: readonly EvidenceValidationRuntimeRecord[]): readonly EvidenceValidationRuntimeRecord[] {
  return [...records].sort((left, right) => {
    const leftKey = `${left.evidenceId}:${left.evidenceVersionId}:${left.validationId}`;
    const rightKey = `${right.evidenceId}:${right.evidenceVersionId}:${right.validationId}`;
    return leftKey.localeCompare(rightKey);
  });
}

function orderEvidenceObjects(records: readonly EvidenceRuntimeObject[]): readonly EvidenceRuntimeObject[] {
  return [...records].sort((left, right) => {
    const leftKey = `${left.identity.evidenceId}:${left.version.versionId}`;
    const rightKey = `${right.identity.evidenceId}:${right.version.versionId}`;
    return leftKey.localeCompare(rightKey);
  });
}

export class IBRRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: IBRRuntimeFactoryOptions["configuration"];

  public constructor(options: IBRRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createIBRRecord(
    input: IBRRuntimeCreateInput,
    rules: readonly IBRRuntimeRule[],
    options: IBRRuntimeCreateOptions,
  ): IBRRuntimeRecord {
    const createdAt = this.clock();
    const normalizedInput = this.normalizeInput(input);
    const graph = this.buildGraph(normalizedInput);
    const checks = deepFreeze([
      ...this.evaluateLinkageChecks(normalizedInput, graph, createdAt),
      ...this.evaluateChecks(normalizedInput, rules, createdAt),
    ]);
    const outcome = this.deriveOutcome(checks);
    const trace = this.buildTrace(normalizedInput, graph);
    const certificationTrace = this.buildCertificationTrace(normalizedInput, outcome, trace);
    const lineageIntegrity = this.buildLineageIntegrity(normalizedInput);

    const ibrDigest = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      schemaVersion: this.configuration.schemaVersion,
      manifestId: normalizedInput.manifest.manifestId,
      manifestDigest: normalizedInput.manifest.manifestDigest,
      replayId: normalizedInput.replayRecord.replayId,
      replayDigest: normalizedInput.replayRecord.replayDigest,
      graphFingerprint: graph.deterministicFingerprint,
      trace,
      certificationTrace,
      lineageIntegrity,
      outcome,
      checks: checks.map((check) => ({
        validatorName: check.validatorName,
        status: check.status,
        code: check.code,
        message: check.message,
      })),
    });

    const ibrId = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      manifestId: normalizedInput.manifest.manifestId,
      replayId: normalizedInput.replayRecord.replayId,
      ibrDigest,
    });

    const previousVersionId = options.previousRecord?.version.versionId;
    const versionOrdinal = (options.previousRecord?.version.ordinal ?? 0) + 1;
    const version = {
      versionId: hashFromObject({
        ibrId,
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

    const lifecycleState: IBRRuntimeLifecycleState = outcome === "BLOCKED" ? "BLOCKED" : "INTEGRATED";
    const lifecycle: IBRRuntimeLifecycle = deepFreeze({
      currentState: lifecycleState,
      history: [
        {
          state: "DECLARED",
          at: createdAt,
          reason: "IBR record created",
        },
        {
          state: lifecycleState,
          at: createdAt,
          reason: options.reason,
        },
      ],
    });

    const record: IBRRuntimeRecord = {
      ibrId,
      ibrDigest,
      manifestId: normalizedInput.manifest.manifestId,
      manifestDigest: normalizedInput.manifest.manifestDigest,
      replayId: normalizedInput.replayRecord.replayId,
      replayDigest: normalizedInput.replayRecord.replayDigest,
      outcome,
      lifecycle,
      checks,
      graph,
      trace,
      certificationTrace,
      lineageIntegrity,
      version,
      createdAt,
      updatedAt: createdAt,
    };

    return deepFreeze(record);
  }

  private normalizeInput(input: IBRRuntimeCreateInput): IBRRuntimeCreateInput {
    return {
      manifest: input.manifest,
      replayRecord: input.replayRecord,
      validationRecords: deepFreeze(orderValidationRecords(input.validationRecords)),
      evidenceObjects: deepFreeze(orderEvidenceObjects(input.evidenceObjects)),
    };
  }

  private evaluateLinkageChecks(
    input: IBRRuntimeCreateInput,
    graph: IBRRuntimeGraph,
    checkedAt: string,
  ): readonly IBRRuntimeCheck[] {
    const evidenceById = new Map(input.evidenceObjects.map((evidence) => [evidence.identity.evidenceId, evidence] as const));

    const manifestEvidenceIds = normalizeUnique(input.manifest.entries.map((entry) => entry.evidenceId));
    const validationEvidenceIds = normalizeUnique(input.validationRecords.map((record) => record.evidenceId));
    const replayEvidenceIds = normalizeUnique(input.replayRecord.trace.sourceEvidenceIds);
    const sourceManifestIds = normalizeUnique([
      input.manifest.manifestId,
      input.replayRecord.manifestId,
      ...input.validationRecords.map((record) => record.replayTrace.sourceManifestId),
      ...input.evidenceObjects.map((evidence) => evidence.manifestReference.manifestId),
    ]);

    const checks: IBRRuntimeCheck[] = [
      {
        validatorName: "manifest-linkage",
        ...this.createStatus(
          manifestEvidenceIds.length > 0 && manifestEvidenceIds.join("|") === validationEvidenceIds.join("|"),
          "MANIFEST_LINKAGE",
          "manifest entries must align with validation evidence identifiers",
          checkedAt,
        ),
      },
      {
        validatorName: "replay-linkage",
        ...this.createStatus(
          input.replayRecord.manifestId === input.manifest.manifestId && replayEvidenceIds.length > 0,
          "REPLAY_LINKAGE",
          "replay record must bind to the manifest and source evidence set",
          checkedAt,
        ),
      },
      {
        validatorName: "validation-linkage",
        ...this.createStatus(
          input.validationRecords.length > 0 &&
            input.validationRecords.every((record) => {
              const evidence = evidenceById.get(record.evidenceId);
              return evidence !== undefined && record.replayTrace.sourceManifestId === evidence.manifestReference.manifestId;
            }),
          "VALIDATION_LINKAGE",
          "validation records must map to immutable evidence objects and the manifest source",
          checkedAt,
        ),
      },
      {
        validatorName: "evidence-linkage",
        ...this.createStatus(
          input.evidenceObjects.length > 0 &&
            input.validationRecords.every((record) => {
              const evidence = evidenceById.get(record.evidenceId);
              return (
                evidence !== undefined &&
                evidence.manifestReference.manifestId === record.replayTrace.sourceManifestId &&
                evidence.replayReference.sourceManifestId === record.replayTrace.sourceManifestId
              );
            }),
          "EVIDENCE_LINKAGE",
          "evidence objects must remain linked to their source manifest and validation replay trace",
          checkedAt,
        ),
      },
      {
        validatorName: "certification-linkage",
        ...this.createStatus(
          input.evidenceObjects.length > 0 && input.evidenceObjects.every((evidence) => evidence.certification.readiness === "READY"),
          "CERTIFICATION_LINKAGE",
          "IBR requires certification-ready evidence objects",
          checkedAt,
        ),
      },
      {
        validatorName: "graph-integrity",
        ...this.createStatus(
          graph.nodes.length > 0 && graph.edges.length > 0 && graph.deterministicFingerprint.length === 64,
          "GRAPH_INTEGRITY",
          "IBR graph must be deterministic and non-empty",
          checkedAt,
        ),
      },
      {
        validatorName: "source-alignment",
        ...this.createStatus(
          sourceManifestIds.length > 0 && sourceManifestIds.includes(input.manifest.manifestId),
          "SOURCE_ALIGNMENT",
          "IBR source references must remain aligned",
          checkedAt,
        ),
      },
    ];

    return deepFreeze(checks);
  }

  private createStatus(
    isPassing: boolean,
    code: string,
    message: string,
    checkedAt: string,
    overrideStatus?: IBRRuntimeCheckStatus,
  ): IBRRuntimeRuleResult & { readonly checkedAt: string } {
    if (overrideStatus) {
      return {
        status: overrideStatus,
        code,
        message,
        checkedAt,
      };
    }

    return {
      status: isPassing ? "pass" : "fail",
      code,
      message,
      checkedAt,
    };
  }

  private evaluateChecks(
    input: IBRRuntimeCreateInput,
    rules: readonly IBRRuntimeRule[],
    checkedAt: string,
  ): readonly IBRRuntimeCheck[] {
    const orderedRules = [...rules].sort((left, right) => left.name.localeCompare(right.name));

    const checks = orderedRules.map((rule) => {
      try {
        const result = rule.validate(input);
        return {
          validatorName: rule.name,
          status: result.status,
          code: result.code,
          message: result.message,
          checkedAt,
        } as IBRRuntimeCheck;
      } catch (error) {
        return {
          validatorName: rule.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as IBRRuntimeCheck;
      }
    });

    return deepFreeze(checks);
  }

  private deriveOutcome(checks: readonly IBRRuntimeCheck[]): IBRRuntimeOutcome {
    const statusOrder: Record<IBRRuntimeCheckStatus, number> = {
      pass: 0,
      warn: 1,
      fail: 2,
    };

    const highest = checks.reduce<IBRRuntimeCheckStatus>(
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

  private buildGraph(input: IBRRuntimeCreateInput): IBRRuntimeGraph {
    const manifestNode: IBRRuntimeGraphNode = {
      nodeId: `manifest:${input.manifest.manifestId}`,
      nodeType: "manifest",
      referenceId: input.manifest.manifestId,
      digest: input.manifest.manifestDigest,
    };

    const replayNode: IBRRuntimeGraphNode = {
      nodeId: `replay:${input.replayRecord.replayId}`,
      nodeType: "replay",
      referenceId: input.replayRecord.replayId,
      digest: input.replayRecord.replayDigest,
    };

    const validationNodes = input.validationRecords.map<IBRRuntimeGraphNode>((record) => ({
      nodeId: `validation:${record.validationId}`,
      nodeType: "validation",
      referenceId: record.validationId,
      digest: record.certificationTrace.validationDigest,
    }));

    const evidenceNodes = input.evidenceObjects.map<IBRRuntimeGraphNode>((evidence) => ({
      nodeId: `evidence:${evidence.identity.evidenceId}`,
      nodeType: "evidence",
      referenceId: evidence.identity.evidenceId,
      digest: evidence.hash.digest,
    }));

    const certificationNodes = input.evidenceObjects.map<IBRRuntimeGraphNode>((evidence) => ({
      nodeId: `certification:${evidence.certification.certificationId}`,
      nodeType: "certification",
      referenceId: evidence.certification.certificationId,
      digest: hashFromObject({
        certificationId: evidence.certification.certificationId,
        readiness: evidence.certification.readiness,
        evidenceReferences: evidence.certification.evidenceReferences,
      }),
    }));

    const nodes = deepFreeze(
      [manifestNode, replayNode, ...validationNodes, ...evidenceNodes, ...certificationNodes].sort((left, right) =>
        left.nodeId.localeCompare(right.nodeId),
      ),
    );

    const edges = deepFreeze(
      [
        ...validationNodes.map<IBRRuntimeGraphEdge>((node) => ({
          fromNodeId: manifestNode.nodeId,
          toNodeId: node.nodeId,
          relation: "CONTAINS",
        })),
        ...evidenceNodes.map<IBRRuntimeGraphEdge>((node) => ({
          fromNodeId: replayNode.nodeId,
          toNodeId: node.nodeId,
          relation: "DERIVES_FROM",
        })),
        ...validationNodes.map<IBRRuntimeGraphEdge>((node) => ({
          fromNodeId: node.nodeId,
          toNodeId: `evidence:${input.validationRecords.find((record) => `validation:${record.validationId}` === node.nodeId)?.evidenceId ?? node.referenceId}`,
          relation: "CERTIFIES",
        })),
        ...evidenceNodes.map<IBRRuntimeGraphEdge>((node) => ({
          fromNodeId: node.nodeId,
          toNodeId: `certification:${input.evidenceObjects.find((evidence) => `evidence:${evidence.identity.evidenceId}` === node.nodeId)?.certification.certificationId ?? node.referenceId}`,
          relation: "CERTIFIES",
        })),
      ].sort((left, right) => {
        const leftKey = `${left.fromNodeId}:${left.toNodeId}:${left.relation}`;
        const rightKey = `${right.fromNodeId}:${right.toNodeId}:${right.relation}`;
        return leftKey.localeCompare(rightKey);
      }),
    );

    return deepFreeze({
      nodes,
      edges,
      deterministicFingerprint: hashFromObject({ nodes, edges }),
    });
  }

  private buildTrace(input: IBRRuntimeCreateInput, graph: IBRRuntimeGraph): IBRRuntimeTrace {
    const evidenceReferences = normalizeUnique(
      input.evidenceObjects.flatMap((evidence) => [...evidence.certification.evidenceReferences]),
    );

    return deepFreeze({
      sourceManifestIds: normalizeUnique([input.manifest.manifestId, ...input.validationRecords.map((record) => record.replayTrace.sourceManifestId), ...input.evidenceObjects.map((evidence) => evidence.manifestReference.manifestId)]),
      sourceReplayIds: normalizeUnique([input.replayRecord.replayId, ...input.validationRecords.map((record) => record.replayTrace.sourceReplayId), ...input.evidenceObjects.map((evidence) => evidence.replayReference.replayId)]),
      sourceValidationIds: normalizeUnique(input.validationRecords.map((record) => record.validationId)),
      sourceEvidenceIds: normalizeUnique(input.evidenceObjects.map((evidence) => evidence.identity.evidenceId)),
      sourceCertificationIds: normalizeUnique(input.evidenceObjects.map((evidence) => evidence.certification.certificationId)),
      evidenceReferences,
      deterministicFingerprint: hashFromObject({
        sourceManifestIds: normalizeUnique([input.manifest.manifestId, ...input.validationRecords.map((record) => record.replayTrace.sourceManifestId), ...input.evidenceObjects.map((evidence) => evidence.manifestReference.manifestId)]),
        sourceReplayIds: normalizeUnique([input.replayRecord.replayId, ...input.validationRecords.map((record) => record.replayTrace.sourceReplayId), ...input.evidenceObjects.map((evidence) => evidence.replayReference.replayId)]),
        sourceValidationIds: normalizeUnique(input.validationRecords.map((record) => record.validationId)),
        sourceEvidenceIds: normalizeUnique(input.evidenceObjects.map((evidence) => evidence.identity.evidenceId)),
        sourceCertificationIds: normalizeUnique(input.evidenceObjects.map((evidence) => evidence.certification.certificationId)),
        evidenceReferences,
        graphFingerprint: graph.deterministicFingerprint,
      }),
    });
  }

  private buildCertificationTrace(
    input: IBRRuntimeCreateInput,
    outcome: IBRRuntimeOutcome,
    trace: ReturnType<IBRRuntimeFactory["buildTrace"]>,
  ): IBRRuntimeRecord["certificationTrace"] {
    const sourceCertificationIds = normalizeUnique(input.evidenceObjects.map((evidence) => evidence.certification.certificationId));
    const sourceValidationDigests = normalizeUnique(input.validationRecords.map((record) => record.certificationTrace.validationDigest));
    const evidenceReferences = normalizeUnique(input.evidenceObjects.flatMap((evidence) => [...evidence.certification.evidenceReferences]));

    return deepFreeze({
      sourceCertificationIds,
      sourceValidationDigests,
      evidenceReferences,
      readiness:
        outcome === "BLOCKED" || input.evidenceObjects.some((evidence) => evidence.certification.readiness === "PENDING")
          ? "PENDING"
          : "READY",
    });
  }

  private buildLineageIntegrity(input: IBRRuntimeCreateInput): IBRRuntimeRecord["lineageIntegrity"] {
    return deepFreeze({
      sourceLifecycleStates: normalizeUnique([...
        input.evidenceObjects.map((evidence) => evidence.lifecycle.currentState),
      ]),
      highestSourceVersionOrdinal: Math.max(
        ...input.evidenceObjects.map((evidence) => evidence.version.ordinal),
        input.replayRecord.version.ordinal,
      ),
      immutableInputPreserved: true as const,
    });
  }
}
