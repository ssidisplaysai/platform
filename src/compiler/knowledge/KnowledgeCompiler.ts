import { canonicalizeToJSON, normalizeText } from "../../evidence-ir/canonicalization";
import type { EvidenceIR } from "../evidence/EvidenceIR";
import type { EvidenceNode } from "../evidence/EvidenceNode";
import { EvidenceValidator } from "../evidence/EvidenceValidator";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { KnowledgeGraphHasher } from "./KnowledgeGraphHasher";
import { KnowledgeIdentity } from "./KnowledgeIdentity";
import { KnowledgeValidator } from "./KnowledgeValidator";
import type {
  KnowledgeCluster,
  KnowledgeCompilationContext,
  KnowledgeCompilationResult,
  KnowledgeConflict,
  KnowledgeDiagnostic,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgeIR,
  KnowledgeProvenance,
  KnowledgeRelationship,
  KnowledgeTemporalValidity,
} from "./KnowledgeIR";
import type { KnowledgeClaim } from "./KnowledgeClaim";
import type { KnowledgeNode } from "./KnowledgeNode";
import type { KnowledgeRelationship as KnowledgeGraphRelationship } from "./KnowledgeRelationship";

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function sortByIdentity<T extends { identity: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.identity.localeCompare(right.identity));
}

function sortById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function toTimestamp(value: string | undefined, fallback: string): number {
  const candidate = value ?? fallback;
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? Date.parse(fallback) : timestamp;
}

function maxTimestamp(values: readonly string[], fallback: string): string {
  return values.reduce((latest, current) => (toTimestamp(current, fallback) > toTimestamp(latest, fallback) ? current : latest), fallback);
}

function minTimestamp(values: readonly string[], fallback: string): string {
  return values.reduce((earliest, current) => (toTimestamp(current, fallback) < toTimestamp(earliest, fallback) ? current : earliest), fallback);
}

function buildTemporalValidity(
  observedAt: string,
  compiledAt: string,
  supersedes: string | null = null,
  supersededBy: string | null = null,
  validTo: string | null = null,
): KnowledgeTemporalValidity {
  return {
    validFrom: observedAt,
    validTo,
    observedAt,
    compiledAt,
    supersedes,
    supersededBy,
  };
}

function buildProvenance(node: EvidenceNode, compilerVersion: string, compiledAt: string, validationResult: KnowledgeProvenance["validationResult"]): KnowledgeProvenance {
  return {
    sourceEvidenceId: node.id,
    sourceEvidenceIdentity: node.id,
    sourceDocument: node.origin,
    sourceInterviewId: node.sourceId,
    sourceType: node.sourceType,
    sourceOrigin: node.origin,
    compilerStage: "stage-3-knowledge-compiler",
    compilerVersion,
    transformationVersion: "1.0.0",
    validationResult,
  };
}

function buildLineage(
  sourceEvidenceId: string,
  compilerVersion: string,
  compiledAt: string,
  stage: string,
  contributingEvidenceIds: readonly string[],
  supersedes: string | null = null,
  supersededBy: string | null = null,
): KnowledgeIR["entities"][number]["lineage"] {
  return {
    sourceEvidenceId,
    contributingEvidenceIds: uniqueSorted(contributingEvidenceIds),
    compilerVersion,
    compiledAt,
    stage,
    tracePath: uniqueSorted(["stage-1-evidence", stage]),
    supersedes: supersedes ?? undefined,
    supersededBy: supersededBy ?? undefined,
  };
}

function buildVersion(compiledAt: string, reason: string, supersedes: string | null = null, supersededBy: string | null = null) {
  return {
    semver: "1.0.0",
    revision: 1,
    timestamp: compiledAt,
    reason,
    previousVersionId: supersedes ?? undefined,
    supersedes: supersedes ?? undefined,
    supersededBy: supersededBy ?? undefined,
  };
}

function canonicalKey(node: EvidenceNode): string {
  return `${node.sourceId}:${node.artifactId ?? node.id}`;
}

function canonicalStatement(node: EvidenceNode): string {
  return normalizeText(
    `${node.sourceId} ${node.artifactId ?? node.id} ${node.versionId ?? "v1"} ${node.checksum ?? "unknown-checksum"}`,
  );
}

function entityNameFromCluster(clusterKey: string): string {
  return clusterKey
    .split(":")
    .slice(1)
    .join(" ")
    .replace(/[_-]+/g, " ")
    .trim() || clusterKey;
}

function computeConfidence(
  evidenceNodes: readonly EvidenceNode[],
  conflictState: "resolved" | "unresolved" | "non_blocking" | "blocking",
  validationResult: "valid" | "warning" | "invalid" | "unknown",
  compiledAt: string,
): { confidence: KnowledgeIR["entities"][number]["confidence"]; score: number } {
  const evidenceConfidence = evidenceNodes.reduce((sum, node) => sum + node.confidence, 0) / Math.max(1, evidenceNodes.length);
  const corroborationCount = evidenceNodes.length;
  const sourceDiversity = uniqueSorted(evidenceNodes.map((node) => node.sourceId)).length;
  const latestObservedAt = maxTimestamp(
    evidenceNodes.map((node) => node.discoveredAt ?? node.modifiedAt ?? node.createdAt ?? compiledAt),
    compiledAt,
  );
  const recencyBaseline = Math.max(0, Date.parse(compiledAt) - Date.parse(latestObservedAt));
  const sourceRecency = clamp(1 - Math.min(recencyBaseline / (365 * 24 * 60 * 60 * 1000), 1));

  const corroborationBonus = Math.min(0.15, Math.max(0, corroborationCount - 1) * 0.05);
  const diversityBonus = Math.min(0.1, Math.max(0, sourceDiversity - 1) * 0.03);
  const validationBonus = validationResult === "valid" ? 0.05 : validationResult === "warning" ? 0.02 : 0;
  const conflictPenalty = conflictState === "blocking" ? 0.4 : conflictState === "unresolved" ? 0.25 : conflictState === "non_blocking" ? 0.08 : 0;

  const qualityScore = clamp(evidenceConfidence + corroborationBonus + diversityBonus + sourceRecency * 0.1 - conflictPenalty + validationBonus);
  const finalConfidence = clamp((evidenceConfidence * 0.65) + (qualityScore * 0.35));

  return {
    score: finalConfidence,
    confidence: {
      initial: clamp(evidenceConfidence),
      current: finalConfidence,
      method: "evidence-confidence-corroboration-recency-conflict-model",
      factors: {
        evidenceConfidence: clamp(evidenceConfidence),
        corroborationCount: corroborationCount / 10,
        sourceDiversity: sourceDiversity / 10,
        sourceRecency,
        conflictPenalty,
        validationResult: validationResult === "valid" ? 1 : validationResult === "warning" ? 0.5 : 0,
        qualityScore,
      },
      lastUpdated: compiledAt,
      evidenceConfidence: clamp(evidenceConfidence),
      corroborationCount,
      sourceDiversity,
      sourceRecency,
      conflictState,
      validationResult,
      qualityScore,
      rationale: [
        `evidenceConfidence=${clamp(evidenceConfidence)}`,
        `corroborationCount=${corroborationCount}`,
        `sourceDiversity=${sourceDiversity}`,
        `sourceRecency=${sourceRecency}`,
        `conflictPenalty=${conflictPenalty}`,
        `validationResult=${validationResult}`,
        `qualityScore=${qualityScore}`,
      ],
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry as T);
    }
  }

  return value;
}

export class KnowledgeCompiler {
  private readonly evidenceValidator = new EvidenceValidator();
  private readonly knowledgeValidator = new KnowledgeValidator();
  private readonly hasher = new KnowledgeGraphHasher();

  compile(evidenceIR: EvidenceIR, context: Partial<KnowledgeCompilationContext> = {}): KnowledgeIR {
    return this.compileWithResult(evidenceIR, context).knowledgeIR;
  }

  compileWithResult(evidenceIR: EvidenceIR, context: Partial<KnowledgeCompilationContext> = {}): KnowledgeCompilationResult {
    const startTime = Date.now();
    const compiledAt = context.compiledAt ?? evidenceIR.generatedAt;
    const compilerVersion = context.compilerVersion ?? "1.0.0";
    const pipelineVersion = context.pipelineVersion ?? "1.0.0";
    const diagnostics: KnowledgeDiagnostic[] = [];

    try {
      this.evidenceValidator.validateIR(evidenceIR);

      const evidenceNodes = sortById(evidenceIR.graph.nodes);
      const evidenceRelationships = sortById(evidenceIR.graph.relationships);
      const artifactNodes = evidenceNodes.filter((node) => node.nodeType === "artifact");
      const sortedArtifacts = sortById(artifactNodes);

      const legacyNodeIdMap = new Map<string, string>();
      const legacyNodes: KnowledgeNode[] = evidenceNodes.map((evidenceNode) => {
        const knowledgeNodeId = `kn:${evidenceNode.id}`;
        legacyNodeIdMap.set(evidenceNode.id, knowledgeNodeId);

        return {
          id: knowledgeNodeId,
          nodeType: evidenceNode.nodeType === "source" ? "source_record" : "artifact_record",
          sourceId: evidenceNode.sourceId,
          sourceType: evidenceNode.sourceType,
          origin: evidenceNode.origin,
          confidence: evidenceNode.confidence,
          evidenceNodeId: evidenceNode.id,
          createdAt: evidenceNode.createdAt,
          modifiedAt: evidenceNode.modifiedAt,
          discoveredAt: evidenceNode.discoveredAt,
          metadata: {
            ...evidenceNode.metadata,
            evidenceNodeType: evidenceNode.nodeType,
            evidenceArtifactId: evidenceNode.artifactId,
            evidenceVersionId: evidenceNode.versionId,
            evidenceChecksum: evidenceNode.checksum,
            evidenceLineage: evidenceNode.lineage,
          },
          lineage: {
            sourceId: evidenceNode.lineage.sourceId,
            parentKnowledgeNodeIds: uniqueSorted(
              evidenceNode.lineage.parentNodeIds.map((parentEvidenceNodeId) => legacyNodeIdMap.get(parentEvidenceNodeId) ?? `kn:${parentEvidenceNodeId}`),
            ),
            parentEvidenceNodeIds: uniqueSorted(evidenceNode.lineage.parentNodeIds),
            transformationSteps: uniqueSorted(["knowledge_compile", ...evidenceNode.lineage.transformationSteps]),
          },
        };
      });

      const legacyRelationships: KnowledgeGraphRelationship[] = evidenceRelationships.map((relationship) => ({
        id: `krel:${relationship.id}`,
        from: legacyNodeIdMap.get(relationship.from) ?? `kn:${relationship.from}`,
        to: legacyNodeIdMap.get(relationship.to) ?? `kn:${relationship.to}`,
        relationshipType: relationship.relationshipType === "produced" ? "supported_by" : relationship.relationshipType === "derived_from" ? "derived_from" : "transforms_to",
        sourceId: relationship.sourceId,
        evidenceRelationshipId: relationship.id,
        metadata: {
          ...relationship.metadata,
          evidenceRelationshipType: relationship.relationshipType,
        },
        lineage: {
          sourceId: relationship.lineage.sourceId,
          parentKnowledgeRelationshipIds: uniqueSorted(relationship.lineage.parentRelationshipIds.map((id) => `krel:${id}`)),
          parentEvidenceRelationshipIds: uniqueSorted(relationship.lineage.parentRelationshipIds),
          transformationSteps: uniqueSorted(["knowledge_compile", ...relationship.lineage.transformationSteps]),
        },
      }));

      const legacyClaims: KnowledgeClaim[] = evidenceNodes
        .filter((node) => node.nodeType === "artifact")
        .map((node) => this.claimFromEvidenceNode(node, evidenceIR, legacyNodeIdMap));

      const graph = new KnowledgeGraph(legacyNodes, legacyRelationships, legacyClaims);

      const sourceIds = uniqueSorted(artifactNodes.map((node) => node.sourceId));
      const sourceTypes = uniqueSorted(artifactNodes.map((node) => node.sourceType));
      const sourceEvidenceCount = artifactNodes.length;
      const sourceEvidenceHash = evidenceIR.deterministicHash;

      const clustersByKey = new Map<string, EvidenceNode[]>();
      for (const node of sortedArtifacts) {
        const key = canonicalKey(node);
        const existing = clustersByKey.get(key) ?? [];
        existing.push(node);
        clustersByKey.set(key, existing);
      }

      const entities: KnowledgeEntity[] = [];
      const facts: KnowledgeFact[] = [];
      const relationships: KnowledgeRelationship[] = [];
      const clusters: KnowledgeCluster[] = [];
      const conflicts: KnowledgeConflict[] = [];
      const temporalValidity: KnowledgeTemporalValidity[] = [];

      for (const [clusterKey, clusterNodes] of [...clustersByKey.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        const sortedClusterNodes = sortById(clusterNodes);
        const evidenceIds = uniqueSorted(sortedClusterNodes.map((node) => node.id));
        const sourceEvidenceId = evidenceIds[0] ?? clusterKey;
        const canonicalContent = canonicalizeToJSON({
          clusterKey,
          evidenceIds,
          sourceIds: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)),
          checksums: uniqueSorted(sortedClusterNodes.map((node) => node.checksum ?? "")),
        });

        const latestObservedAt = maxTimestamp(
          sortedClusterNodes.map((node) => node.discoveredAt ?? node.modifiedAt ?? node.createdAt ?? compiledAt),
          compiledAt,
        );
        const earliestObservedAt = minTimestamp(
          sortedClusterNodes.map((node) => node.discoveredAt ?? node.modifiedAt ?? node.createdAt ?? compiledAt),
          compiledAt,
        );

        const uniqueChecksums = uniqueSorted(sortedClusterNodes.map((node) => node.checksum ?? ""));
        const uniqueStatements = uniqueSorted(sortedClusterNodes.map((node) => canonicalStatement(node)));
        const confidenceSpread = Math.max(...sortedClusterNodes.map((node) => node.confidence)) - Math.min(...sortedClusterNodes.map((node) => node.confidence));

        const hasDuplicateClaims = sortedClusterNodes.length > 1;
        const hasContradiction = uniqueChecksums.length > 1 || uniqueStatements.length > 1;
        const hasConfidenceDisagreement = confidenceSpread > 0.2;
        const hasTemporalDisagreement = uniqueSorted(sortedClusterNodes.map((node) => node.discoveredAt ?? node.createdAt ?? compiledAt)).length > 1;

        const conflictIds: string[] = [];
        let conflictState: "resolved" | "unresolved" | "non_blocking" | "blocking" = "resolved";

        if (hasContradiction) {
          const conflictId = KnowledgeIdentity.generate(
            "knowledge_conflict",
            canonicalContent,
            sourceEvidenceId,
            0.5,
            {
              canonicalContent,
              sourceEvidenceId,
              confidence: 0.5,
              entityIdentity: clusterKey,
              temporalScope: {
                validFrom: earliestObservedAt,
                validTo: latestObservedAt,
                observedAt: latestObservedAt,
              },
              lineage: {
                sourceEvidenceIds: evidenceIds,
                transformationSteps: ["knowledge_compile", "conflict_detection"],
              },
              version: { semver: "1.0.0", revision: 1 },
            },
          );

          conflictIds.push(conflictId);
          conflictState = "blocking";
          conflicts.push({
            kind: "conflict",
            knowledgeId: conflictId,
            identity: conflictId,
            canonicalName: `${entityNameFromCluster(clusterKey)} conflict`,
            canonicalContent,
            evidenceIds,
            provenance: buildProvenance(sortedClusterNodes[0], compilerVersion, compiledAt, "warning"),
            lineage: buildLineage(sourceEvidenceId, compilerVersion, compiledAt, "knowledge_compile", evidenceIds),
            confidence: {
              initial: 0.5,
              current: 0.35,
              method: "conflict-preserving",
              factors: {
                conflictCount: sortedClusterNodes.length,
              },
              lastUpdated: compiledAt,
              evidenceConfidence: 0.5,
              corroborationCount: sortedClusterNodes.length,
              sourceDiversity: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)).length,
              sourceRecency: 1,
              conflictState: "blocking",
              validationResult: "warning",
              qualityScore: 0.35,
              rationale: ["blocking contradictory evidence preserved"],
            },
            temporalValidity: buildTemporalValidity(earliestObservedAt, compiledAt, null, null, latestObservedAt),
            version: buildVersion(compiledAt, "Conflict preserved in canonical knowledge IR"),
            metadata: Object.freeze({ clusterKey, evidenceIds, blocking: true, required: true }),
            conflictType: "contradictory_fact",
            status: "blocking",
            required: false,
            blocking: true,
            entityIds: [],
            relationshipIds: [],
            resolution: undefined,
          });
        } else if (hasDuplicateClaims) {
          conflictState = hasConfidenceDisagreement ? "non_blocking" : "resolved";
          if (hasConfidenceDisagreement || hasTemporalDisagreement) {
            const conflictId = KnowledgeIdentity.generate(
              "knowledge_conflict",
              canonicalContent,
              sourceEvidenceId,
              0.55,
              {
                canonicalContent,
                sourceEvidenceId,
                confidence: 0.55,
                entityIdentity: clusterKey,
                temporalScope: {
                  validFrom: earliestObservedAt,
                  validTo: latestObservedAt,
                  observedAt: latestObservedAt,
                },
                lineage: {
                  sourceEvidenceIds: evidenceIds,
                  transformationSteps: ["knowledge_compile", "duplicate_consolidation"],
                },
                version: { semver: "1.0.0", revision: 1 },
              },
            );

            conflictIds.push(conflictId);
            conflicts.push({
              kind: "conflict",
              knowledgeId: conflictId,
              identity: conflictId,
              canonicalName: `${entityNameFromCluster(clusterKey)} duplicate consolidation`,
              canonicalContent,
              evidenceIds,
              provenance: buildProvenance(sortedClusterNodes[0], compilerVersion, compiledAt, "warning"),
              lineage: buildLineage(sourceEvidenceId, compilerVersion, compiledAt, "knowledge_compile", evidenceIds),
              confidence: {
                initial: 0.55,
                current: 0.75,
                method: "duplicate-consolidation",
                factors: {
                  corroborationCount: sortedClusterNodes.length,
                },
                lastUpdated: compiledAt,
                evidenceConfidence: 0.55,
                corroborationCount: sortedClusterNodes.length,
                sourceDiversity: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)).length,
                sourceRecency: 1,
                conflictState: "non_blocking",
                validationResult: "warning",
                qualityScore: 0.75,
                rationale: ["duplicate claims consolidated without loss"],
              },
              temporalValidity: buildTemporalValidity(earliestObservedAt, compiledAt, null, null, null),
              version: buildVersion(compiledAt, "Duplicate claims consolidated"),
              metadata: Object.freeze({ clusterKey, evidenceIds, blocking: false, required: false }),
              conflictType: hasTemporalDisagreement ? "temporal_disagreement" : "duplicate_claim",
              status: "non_blocking",
              required: false,
              blocking: false,
              entityIds: [],
              relationshipIds: [],
              resolution: "Consolidated into a single canonical entity",
            });
          }
        }

        const confidence = computeConfidence(sortedClusterNodes, conflictState, conflictIds.length > 0 ? "warning" : "valid", compiledAt);

        const entityContent = canonicalizeToJSON({
          clusterKey,
          evidenceIds,
          sourceIds: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)),
          statementCount: sortedClusterNodes.length,
        });
        const entityId = KnowledgeIdentity.generate(
          "knowledge_entity",
          entityContent,
          sourceEvidenceId,
          confidence.score,
          {
            canonicalContent: entityContent,
            sourceEvidenceId,
            confidence: confidence.score,
            entityIdentity: clusterKey,
            temporalScope: {
              validFrom: earliestObservedAt,
              validTo: conflictState === "blocking" ? compiledAt : null,
              observedAt: latestObservedAt,
            },
            lineage: {
              sourceEvidenceIds: evidenceIds,
              transformationSteps: ["knowledge_compile", "entity_resolution"],
            },
            version: { semver: "1.0.0", revision: 1 },
          },
        );

        const factIds: string[] = [];
        const relationshipIds: string[] = [];

        for (const [index, node] of sortedClusterNodes.entries()) {
          const factContent = canonicalizeToJSON({
            clusterKey,
            nodeId: node.id,
            artifactId: node.artifactId,
            versionId: node.versionId,
            checksum: node.checksum,
            sourceId: node.sourceId,
            sourceType: node.sourceType,
            origin: node.origin,
          });
          const factId = KnowledgeIdentity.generate(
            "knowledge_fact",
            factContent,
            node.id,
            clamp(node.confidence),
            {
              canonicalContent: factContent,
              sourceEvidenceId: node.id,
              confidence: clamp(node.confidence),
              entityIdentity: entityId,
              temporalScope: {
                validFrom: node.discoveredAt ?? node.createdAt ?? compiledAt,
                validTo: conflictState === "blocking" ? compiledAt : null,
                observedAt: node.discoveredAt ?? node.createdAt ?? compiledAt,
              },
              lineage: {
                sourceEvidenceIds: [node.id, ...node.lineage.parentNodeIds],
                transformationSteps: ["knowledge_compile", "fact_extraction"],
              },
              version: { semver: "1.0.0", revision: index + 1 },
            },
          );

          const factConfidence = computeConfidence([node], conflictState, conflictIds.length > 0 ? "warning" : "valid", compiledAt);
          factIds.push(factId);

          facts.push({
            kind: "fact",
            knowledgeId: factId,
            identity: factId,
            canonicalName: normalizeText(`${node.sourceId} ${node.artifactId ?? node.id}`),
            canonicalContent: factContent,
            evidenceIds: [node.id, ...node.lineage.parentNodeIds],
            provenance: buildProvenance(node, compilerVersion, compiledAt, "valid"),
            lineage: buildLineage(node.id, compilerVersion, compiledAt, "fact_extraction", [node.id, ...node.lineage.parentNodeIds]),
            confidence: factConfidence.confidence,
            temporalValidity: buildTemporalValidity(node.discoveredAt ?? node.createdAt ?? compiledAt, compiledAt, null, conflictState === "blocking" ? compiledAt : null, null),
            version: buildVersion(compiledAt, "Fact extracted from evidence"),
            metadata: Object.freeze({ clusterKey, nodeId: node.id, checksum: node.checksum }),
            subjectEntityId: entityId,
            canonicalStatement: canonicalStatement(node),
            evidenceNodeIds: [node.id],
            relationshipIds: [],
            conflictIds: conflictIds.slice(),
          });
        }

        const clusterId = KnowledgeIdentity.generate(
          "knowledge_cluster",
          canonicalContent,
          sourceEvidenceId,
          confidence.score,
          {
            canonicalContent,
            sourceEvidenceId,
            confidence: confidence.score,
            entityIdentity: entityId,
            temporalScope: {
              validFrom: earliestObservedAt,
              validTo: conflictState === "blocking" ? compiledAt : null,
              observedAt: latestObservedAt,
            },
            lineage: {
              sourceEvidenceIds: evidenceIds,
              transformationSteps: ["knowledge_compile", "evidence_clustering"],
            },
            version: { semver: "1.0.0", revision: 1 },
          },
        );

        const cluster: KnowledgeCluster = {
          kind: "cluster",
          knowledgeId: clusterId,
          identity: clusterId,
          canonicalName: entityNameFromCluster(clusterKey),
          canonicalContent,
          evidenceIds,
          provenance: buildProvenance(sortedClusterNodes[0], compilerVersion, compiledAt, conflictState === "blocking" ? "warning" : "valid"),
          lineage: buildLineage(sourceEvidenceId, compilerVersion, compiledAt, "evidence_clustering", evidenceIds),
          confidence: confidence.confidence,
          temporalValidity: buildTemporalValidity(earliestObservedAt, compiledAt, conflictState === "blocking" ? null : null, null, conflictState === "blocking" ? compiledAt : null),
          version: buildVersion(compiledAt, "Clustered canonical knowledge"),
          metadata: Object.freeze({ clusterKey, sourceIds: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)) }),
          entityIds: [entityId],
          factIds,
          evidenceNodeIds: evidenceIds,
          relationshipIds: [],
          conflictIds: conflictIds.slice(),
          resolved: conflictState === "resolved" || conflictState === "non_blocking",
          resolutionState: conflictState,
        };

        const entityRelationships: string[] = [];
        for (const factId of factIds) {
          const fact = facts.find((entry) => entry.identity === factId)!;
          const relationshipContent = canonicalizeToJSON({
            sourceEntityId: entityId,
            targetEntityId: factId,
            relationshipType: conflictState === "blocking" ? "related_to" : "derived_from",
            clusterKey,
          });
          const relationshipId = KnowledgeIdentity.generate(
            "knowledge_relationship",
            relationshipContent,
            sourceEvidenceId,
            Math.min(confidence.score, fact.confidence.current),
            {
              canonicalContent: relationshipContent,
              sourceEvidenceId,
              confidence: Math.min(confidence.score, fact.confidence.current),
              entityIdentity: entityId,
              relationshipIdentity: factId,
              temporalScope: {
                validFrom: earliestObservedAt,
                validTo: conflictState === "blocking" ? compiledAt : null,
                observedAt: latestObservedAt,
              },
              lineage: {
                sourceEvidenceIds: evidenceIds,
                transformationSteps: ["knowledge_compile", "relationship_construction"],
              },
              version: { semver: "1.0.0", revision: 1 },
            },
          );

          relationships.push({
            kind: "relationship",
            knowledgeId: relationshipId,
            identity: relationshipId,
            canonicalName: `${entityNameFromCluster(clusterKey)} relationship`,
            canonicalContent: relationshipContent,
            evidenceIds,
            provenance: buildProvenance(sortedClusterNodes[0], compilerVersion, compiledAt, conflictState === "blocking" ? "warning" : "valid"),
            lineage: buildLineage(sourceEvidenceId, compilerVersion, compiledAt, "relationship_construction", evidenceIds),
            confidence: {
              initial: Math.min(confidence.score, fact.confidence.current),
              current: Math.min(confidence.score, fact.confidence.current),
              method: "entity-fact-construction",
              factors: {
                entityConfidence: confidence.score,
                factConfidence: fact.confidence.current,
              },
              lastUpdated: compiledAt,
              evidenceConfidence: Math.min(confidence.score, fact.confidence.current),
              corroborationCount: fact.evidenceNodeIds.length,
              sourceDiversity: uniqueSorted(evidenceIds.map((id) => id.split(":")[0])).length,
              sourceRecency: confidence.score,
              conflictState,
              validationResult: conflictState === "blocking" ? "warning" : "valid",
              qualityScore: Math.min(confidence.score, fact.confidence.current),
              rationale: ["constructed deterministically from entity and fact"],
            },
            temporalValidity: buildTemporalValidity(earliestObservedAt, compiledAt, conflictState === "blocking" ? null : null, null, conflictState === "blocking" ? compiledAt : null),
            version: buildVersion(compiledAt, "Relationship constructed from canonical entity and fact"),
            metadata: Object.freeze({ clusterKey, factId, sourceEvidenceIds: evidenceIds }),
            sourceEntityId: entityId,
            targetEntityId: entityId,
            relationshipType: conflictState === "blocking" ? "related_to" : "derived_from",
            relationshipId,
            conflictIds: conflictIds.slice(),
          });
          relationshipIds.push(relationshipId);
          entityRelationships.push(relationshipId);
          fact.relationshipIds = uniqueSorted([...(fact.relationshipIds ?? []), relationshipId]);
        }

        entityIdsSetAdd(entities, {
          kind: "entity",
          knowledgeId: entityId,
          identity: entityId,
          canonicalName: entityNameFromCluster(clusterKey),
          canonicalContent: entityContent,
          evidenceIds,
          provenance: buildProvenance(sortedClusterNodes[0], compilerVersion, compiledAt, conflictState === "blocking" ? "warning" : "valid"),
          lineage: buildLineage(sourceEvidenceId, compilerVersion, compiledAt, "entity_resolution", evidenceIds),
          confidence: confidence.confidence,
          temporalValidity: buildTemporalValidity(earliestObservedAt, compiledAt, conflictState === "blocking" ? null : null, null, conflictState === "blocking" ? compiledAt : null),
          version: buildVersion(compiledAt, "Entity resolved from canonical cluster"),
          metadata: Object.freeze({ clusterKey, sourceIds: uniqueSorted(sortedClusterNodes.map((node) => node.sourceId)), factIds }),
          entityType: uniqueSorted(sortedClusterNodes.map((node) => node.sourceType)).join("|") || "knowledge",
          factIds,
          relationshipIds: entityRelationships,
          clusterIds: [clusterId],
        });

        cluster.entityIds = [entityId];
        cluster.factIds = factIds;
        cluster.relationshipIds = relationshipIds;
        clusters.push(cluster);
        temporalValidity.push(cluster.temporalValidity, ...facts.slice(-factIds.length).map((fact) => fact.temporalValidity), ...relationships.slice(-relationshipIds.length).map((relationship) => relationship.temporalValidity));

        if (conflictIds.length > 0) {
          cluster.conflictIds = conflictIds;
        }
      }

      const context: KnowledgeCompilationContext = {
        compilerVersion,
        pipelineVersion,
        compiledAt,
        sourceEvidenceHash,
        sourceEvidenceCount,
        sourceTypes,
        sourceIds,
      };

      const knowledgeIRBase: Omit<KnowledgeIR, "deterministicHash"> = {
        schemaVersion: "1.0.0",
        graph,
        claimCount: graph.claims.length,
        compiledFromEvidenceHash: evidenceIR.deterministicHash,
        generatedAt: compiledAt,
        compilationContext: context,
        entities: sortByIdentity(entities),
        facts: sortByIdentity(facts),
        relationships: sortByIdentity(relationships),
        clusters: sortByIdentity(clusters),
        conflicts: sortByIdentity(conflicts),
        temporalValidity: temporalValidity.sort((left, right) => left.compiledAt.localeCompare(right.compiledAt) || left.observedAt.localeCompare(right.observedAt)),
        diagnostics,
        metrics: {
          inputEvidenceNodes: evidenceNodes.length,
          evidenceArtifacts: sortedArtifacts.length,
          entitiesCreated: entities.length,
          factsCreated: facts.length,
          relationshipsCreated: relationships.length,
          clustersCreated: clusters.length,
          conflictsCreated: conflicts.length,
          duplicateClaimsConsolidated: sortedArtifacts.length - clusters.length,
          blockingConflicts: conflicts.filter((conflict) => conflict.blocking).length,
          validationErrors: 0,
          validationWarnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
          executionTimeMs: 0,
        },
        claims: graph.claims,
        sourceNodes: graph.nodes,
      };

      const knowledgeIR: KnowledgeIR = {
        ...knowledgeIRBase,
        deterministicHash: this.hasher.hashIR(knowledgeIRBase),
      };

      this.knowledgeValidator.validateIR(knowledgeIR);

      const result: KnowledgeCompilationResult = {
        success: true,
        knowledgeIR: deepFreeze(knowledgeIR),
        diagnostics,
        metrics: {
          ...knowledgeIR.metrics!,
          validationErrors: 0,
          executionTimeMs: Date.now() - startTime,
        },
      };

      return result;
    } catch (error) {
      const diagnostic: KnowledgeDiagnostic = {
        code: error instanceof Error && "code" in error ? String((error as { code?: string }).code ?? "KNOWLEDGE_COMPILATION_FAILED") : "KNOWLEDGE_COMPILATION_FAILED",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      };

      diagnostics.push(diagnostic);

      const emptyIR: KnowledgeIR = deepFreeze({
        schemaVersion: "1.0.0",
        graph: new KnowledgeGraph(),
        claimCount: 0,
        compiledFromEvidenceHash: evidenceIR.deterministicHash,
        generatedAt: context.compiledAt ?? evidenceIR.generatedAt,
        compilationContext: {
          compilerVersion,
          pipelineVersion,
          compiledAt: context.compiledAt ?? evidenceIR.generatedAt,
          sourceEvidenceHash: evidenceIR.deterministicHash,
          sourceEvidenceCount: 0,
          sourceTypes: [],
          sourceIds: [],
        },
        entities: [],
        facts: [],
        relationships: [],
        clusters: [],
        conflicts: [],
        temporalValidity: [],
        diagnostics,
        metrics: {
          inputEvidenceNodes: 0,
          evidenceArtifacts: 0,
          entitiesCreated: 0,
          factsCreated: 0,
          relationshipsCreated: 0,
          clustersCreated: 0,
          conflictsCreated: 0,
          duplicateClaimsConsolidated: 0,
          blockingConflicts: 0,
          validationErrors: 1,
          validationWarnings: 0,
          executionTimeMs: Date.now() - startTime,
        },
        deterministicHash: "",
      });

      return {
        success: false,
        knowledgeIR: emptyIR,
        diagnostics,
        metrics: emptyIR.metrics!,
      };
    }
  }

  private claimFromEvidenceNode(
    artifactNode: EvidenceNode,
    evidenceIR: EvidenceIR,
    nodeIdMap: ReadonlyMap<string, string>,
  ): KnowledgeClaim {
    const evidenceRelationshipIds = uniqueSorted(
      evidenceIR.graph.relationships
        .filter((relationship) => relationship.to === artifactNode.id || relationship.from === artifactNode.id)
        .map((relationship) => relationship.id),
    );

    const parentEvidenceNodeIds = uniqueSorted([artifactNode.id, ...artifactNode.lineage.parentNodeIds]);

    return {
      id: `claim:${artifactNode.id}`,
      claimType: "existence",
      subjectNodeId: nodeIdMap.get(artifactNode.id) ?? `kn:${artifactNode.id}`,
      statement: `Evidence artifact ${artifactNode.artifactId ?? artifactNode.id} exists from source ${artifactNode.sourceId}`,
      confidence: artifactNode.confidence,
      evidenceNodeIds: parentEvidenceNodeIds,
      evidenceRelationshipIds,
      metadata: {
        sourceType: artifactNode.sourceType,
        origin: artifactNode.origin,
        checksum: artifactNode.checksum,
      },
      lineage: {
        sourceId: artifactNode.lineage.sourceId,
        parentClaimIds: [],
        parentEvidenceNodeIds,
        parentEvidenceRelationshipIds: evidenceRelationshipIds,
        transformationSteps: uniqueSorted(["knowledge_compile", ...artifactNode.lineage.transformationSteps]),
      },
    };
  }
}

function entityIdsSetAdd(entities: KnowledgeEntity[], entity: KnowledgeEntity): void {
  if (!entities.some((entry) => entry.identity === entity.identity)) {
    entities.push(entity);
  }
}