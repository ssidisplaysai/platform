import { SourceHash } from "../../provenance/SourceHash";
import { stableStringify } from "../../core/stableStringify";
import { deepFreeze } from "../foundation/immutability";
import type { EvidenceRuntimeObject } from "../evidence/contracts";
import type { EvidenceValidationRuntimeRecord } from "../evidence-validation/contracts";
import type {
  ReplayRuntimeCheck,
  ReplayRuntimeCheckStatus,
  ReplayRuntimeCreateInput,
  ReplayRuntimeCreateOptions,
  ReplayRuntimeFactoryOptions,
  ReplayRuntimeGraph,
  ReplayRuntimeGraphEdge,
  ReplayRuntimeGraphNode,
  ReplayRuntimeLifecycle,
  ReplayRuntimeLifecycleState,
  ReplayRuntimeOutcome,
  ReplayRuntimeRecord,
  ReplayRuntimeRule,
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

export class ReplayRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: ReplayRuntimeFactoryOptions["configuration"];

  public constructor(options: ReplayRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createReplayRecord(
    input: ReplayRuntimeCreateInput,
    rules: readonly ReplayRuntimeRule[],
    options: ReplayRuntimeCreateOptions,
  ): ReplayRuntimeRecord {
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

    const replayDigest = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      schemaVersion: this.configuration.schemaVersion,
      manifestId: normalizedInput.manifest.manifestId,
      manifestDigest: normalizedInput.manifest.manifestDigest,
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

    const replayId = hashFromObject({
      runtimeId: this.configuration.runtimeId,
      manifestId: normalizedInput.manifest.manifestId,
      replayDigest,
    });

    const previousVersionId = options.previousRecord?.version.versionId;
    const versionOrdinal = (options.previousRecord?.version.ordinal ?? 0) + 1;
    const version = {
      versionId: hashFromObject({
        replayId,
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

    const lifecycleState: ReplayRuntimeLifecycleState = outcome === "BLOCKED" ? "BLOCKED" : "REPLAYED";
    const lifecycle: ReplayRuntimeLifecycle = deepFreeze({
      currentState: lifecycleState,
      history: [
        {
          state: "DECLARED",
          at: createdAt,
          reason: "replay record created",
        },
        {
          state: lifecycleState,
          at: createdAt,
          reason: options.reason,
        },
      ],
    });

    const record: ReplayRuntimeRecord = {
      replayId,
      replayDigest,
      manifestId: normalizedInput.manifest.manifestId,
      manifestDigest: normalizedInput.manifest.manifestDigest,
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

  private normalizeInput(input: ReplayRuntimeCreateInput): ReplayRuntimeCreateInput {
    return {
      manifest: input.manifest,
      validationRecords: deepFreeze(orderValidationRecords(input.validationRecords)),
      evidenceObjects: deepFreeze(orderEvidenceObjects(input.evidenceObjects)),
    };
  }

  private evaluateLinkageChecks(
    input: ReplayRuntimeCreateInput,
    graph: ReplayRuntimeGraph,
    checkedAt: string,
  ): readonly ReplayRuntimeCheck[] {
    const evidenceById = new Map(
      input.evidenceObjects.map((evidence) => [evidence.identity.evidenceId, evidence] as const),
    );

    const manifestEvidenceIds = normalizeUnique(input.manifest.entries.map((entry) => entry.evidenceId));
    const validationEvidenceIds = normalizeUnique(input.validationRecords.map((record) => record.evidenceId));
    const sourceManifestIds = normalizeUnique([
      input.manifest.manifestId,
      ...input.validationRecords.map((record) => record.replayTrace.sourceManifestId),
      ...input.evidenceObjects.map((evidence) => evidence.manifestReference.manifestId),
    ]);

    const checks: ReplayRuntimeCheck[] = [
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
        validatorName: "validation-linkage",
        ...this.createStatus(
          input.validationRecords.length > 0 &&
            input.validationRecords.every((record) => {
              const evidence = evidenceById.get(record.evidenceId);
              return (
                evidence !== undefined &&
                record.replayTrace.sourceManifestId === evidence.manifestReference.manifestId
              );
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
          input.validationRecords.length > 0,
          "CERTIFICATION_LINKAGE",
          "replay requires certification-ready validation records",
          checkedAt,
          input.validationRecords.some((record) => record.certificationTrace.readiness === "PENDING") ? "warn" : "pass",
        ),
      },
      {
        validatorName: "graph-integrity",
        ...this.createStatus(
          graph.nodes.length > 0 && graph.edges.length > 0 && graph.deterministicFingerprint.length === 64,
          "GRAPH_INTEGRITY",
          "replay graph must be deterministic and non-empty",
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
    overrideStatus?: ReplayRuntimeCheckStatus,
  ): ReplayRuntimeRuleResult & { readonly checkedAt: string } {
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
    input: ReplayRuntimeCreateInput,
    rules: readonly ReplayRuntimeRule[],
    checkedAt: string,
  ): readonly ReplayRuntimeCheck[] {
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
        } as ReplayRuntimeCheck;
      } catch (error) {
        return {
          validatorName: rule.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as ReplayRuntimeCheck;
      }
    });

    return deepFreeze(checks);
  }

  private deriveOutcome(checks: readonly ReplayRuntimeCheck[]): ReplayRuntimeOutcome {
    const statusOrder: Record<ReplayRuntimeCheckStatus, number> = {
      pass: 0,
      warn: 1,
      fail: 2,
    };

    const highest = checks.reduce<ReplayRuntimeCheckStatus>(
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

  private buildGraph(input: ReplayRuntimeCreateInput): ReplayRuntimeGraph {
    const manifestNode: ReplayRuntimeGraphNode = {
      nodeId: `manifest:${input.manifest.manifestId}`,
      nodeType: "manifest",
      referenceId: input.manifest.manifestId,
      digest: input.manifest.manifestDigest,
    };

    const validationNodes = input.validationRecords.map<ReplayRuntimeGraphNode>((record) => ({
      nodeId: `validation:${record.validationId}`,
      nodeType: "validation",
      referenceId: record.validationId,
      digest: record.certificationTrace.validationDigest,
    }));

    const evidenceNodes = input.evidenceObjects.map<ReplayRuntimeGraphNode>((evidence) => ({
      nodeId: `evidence:${evidence.identity.evidenceId}`,
      nodeType: "evidence",
      referenceId: evidence.identity.evidenceId,
      digest: evidence.hash.digest,
    }));

    const certificationIds = normalizeUnique(
      input.validationRecords.map((record) => record.certificationTrace.sourceCertificationId),
    );

    const certificationNodes = certificationIds.map<ReplayRuntimeGraphNode>((certificationId) => ({
      nodeId: `certification:${certificationId}`,
      nodeType: "certification",
      referenceId: certificationId,
      digest: hashFromObject({ certificationId }),
    }));

    const edges: ReplayRuntimeGraphEdge[] = [];
    for (const validation of validationNodes) {
      const evidenceId = validation.referenceId.replace(/^validation:/, "");
      const sourceValidation = input.validationRecords.find((record) => record.validationId === evidenceId);
      if (!sourceValidation) {
        continue;
      }

      edges.push({
        fromNodeId: manifestNode.nodeId,
        toNodeId: validation.nodeId,
        relation: "CONTAINS",
      });

      edges.push({
        fromNodeId: validation.nodeId,
        toNodeId: `evidence:${sourceValidation.evidenceId}`,
        relation: "DERIVES_FROM",
      });

      edges.push({
        fromNodeId: validation.nodeId,
        toNodeId: `certification:${sourceValidation.certificationTrace.sourceCertificationId}`,
        relation: "CERTIFIES",
      });
    }

    const nodes = deepFreeze([manifestNode, ...validationNodes, ...evidenceNodes, ...certificationNodes]);
    const orderedEdges = deepFreeze(
      edges.sort((left, right) => {
        const leftKey = `${left.fromNodeId}:${left.toNodeId}:${left.relation}`;
        const rightKey = `${right.fromNodeId}:${right.toNodeId}:${right.relation}`;
        return leftKey.localeCompare(rightKey);
      }),
    );

    return deepFreeze({
      nodes,
      edges: orderedEdges,
      deterministicFingerprint: hashFromObject({ nodes, edges: orderedEdges }),
    });
  }

  private buildTrace(input: ReplayRuntimeCreateInput, graph: ReplayRuntimeGraph) {
    const sourceManifestIds = [
      input.manifest.manifestId,
      ...normalizeUnique([
        ...input.validationRecords.map((record) => record.replayTrace.sourceManifestId),
        ...input.evidenceObjects.map((evidence) => evidence.manifestReference.manifestId),
      ]).filter((manifestId) => manifestId !== input.manifest.manifestId),
    ];

    const sourceValidationIds = normalizeUnique(input.validationRecords.map((record) => record.validationId));
    const sourceEvidenceIds = normalizeUnique(input.validationRecords.map((record) => record.evidenceId));
    const sourceReplayIds = normalizeUnique(input.validationRecords.map((record) => record.replayTrace.sourceReplayId));
    const sourceCertificationIds = normalizeUnique(
      input.validationRecords.map((record) => record.certificationTrace.sourceCertificationId),
    );
    const evidenceReferences = normalizeUnique(
      input.validationRecords.flatMap((record) => [...record.certificationTrace.evidenceReferences]),
    );

    return deepFreeze({
      sourceManifestIds,
      sourceValidationIds,
      sourceEvidenceIds,
      sourceReplayIds,
      sourceCertificationIds,
      evidenceReferences,
      deterministicFingerprint: hashFromObject({
        sourceManifestIds,
        sourceValidationIds,
        sourceEvidenceIds,
        sourceReplayIds,
        sourceCertificationIds,
        evidenceReferences,
        graphFingerprint: graph.deterministicFingerprint,
      }),
    });
  }

  private buildCertificationTrace(
    input: ReplayRuntimeCreateInput,
    outcome: ReplayRuntimeOutcome,
    trace: ReturnType<ReplayRuntimeFactory["buildTrace"]>,
  ) {
    const sourceCertificationIds = trace.sourceCertificationIds;
    const sourceValidationDigests = normalizeUnique(
      input.validationRecords.map((record) => record.certificationTrace.validationDigest),
    );
    const evidenceReferences = trace.evidenceReferences;

    const readiness =
      outcome === "BLOCKED" || input.validationRecords.some((record) => record.certificationTrace.readiness === "PENDING")
        ? "PENDING"
        : "READY";

    return deepFreeze({
      sourceCertificationIds,
      sourceValidationDigests,
      evidenceReferences,
      readiness,
    });
  }

  private buildLineageIntegrity(input: ReplayRuntimeCreateInput) {
    const sourceLifecycleStates = normalizeUnique([
      ...input.validationRecords.map((record) => record.lifecycleIntegrity.lifecycleState),
      ...input.evidenceObjects.map((evidence) => evidence.lifecycle.currentState),
    ]);

    return deepFreeze({
      sourceLifecycleStates,
      highestSourceVersionOrdinal: input.evidenceObjects.reduce(
        (highest, evidence) => Math.max(highest, evidence.version.ordinal),
        0,
      ),
      immutableInputPreserved: true as const,
    });
  }
}