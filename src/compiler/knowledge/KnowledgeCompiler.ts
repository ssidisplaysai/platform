import type { EvidenceIR } from "../evidence/EvidenceIR";
import type { EvidenceNode } from "../evidence/EvidenceNode";
import { EvidenceValidator } from "../evidence/EvidenceValidator";
import type { KnowledgeClaim } from "./KnowledgeClaim";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { KnowledgeGraphHasher } from "./KnowledgeGraphHasher";
import type { KnowledgeIR } from "./KnowledgeIR";
import type { KnowledgeNode } from "./KnowledgeNode";
import type { KnowledgeRelationshipType } from "./KnowledgeRelationship";
import { KnowledgeValidator } from "./KnowledgeValidator";

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function toRelationshipType(type: string): KnowledgeRelationshipType {
  if (type === "produced") {
    return "supported_by";
  }

  if (type === "derived_from") {
    return "derived_from";
  }

  return "transforms_to";
}

export class KnowledgeCompiler {
  private readonly evidenceValidator = new EvidenceValidator();
  private readonly knowledgeValidator = new KnowledgeValidator();
  private readonly hasher = new KnowledgeGraphHasher();

  compile(evidenceIR: EvidenceIR): KnowledgeIR {
    this.evidenceValidator.validateIR(evidenceIR);

    const nodeIdMap = new Map<string, string>();

    const nodes: KnowledgeNode[] = evidenceIR.graph.nodes.map((evidenceNode) => {
      const knowledgeNodeId = `kn:${evidenceNode.id}`;
      nodeIdMap.set(evidenceNode.id, knowledgeNodeId);

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
            evidenceNode.lineage.parentNodeIds
              .map((parentEvidenceNodeId) => nodeIdMap.get(parentEvidenceNodeId) ?? `kn:${parentEvidenceNodeId}`),
          ),
          parentEvidenceNodeIds: uniqueSorted(evidenceNode.lineage.parentNodeIds),
          transformationSteps: uniqueSorted(["knowledge_compile", ...evidenceNode.lineage.transformationSteps]),
        },
      };
    });

    const relationships = evidenceIR.graph.relationships.map((relationship) => ({
      id: `krel:${relationship.id}`,
      from: nodeIdMap.get(relationship.from) ?? `kn:${relationship.from}`,
      to: nodeIdMap.get(relationship.to) ?? `kn:${relationship.to}`,
      relationshipType: toRelationshipType(relationship.relationshipType),
      sourceId: relationship.sourceId,
      evidenceRelationshipId: relationship.id,
      metadata: {
        ...relationship.metadata,
        evidenceRelationshipType: relationship.relationshipType,
      },
      lineage: {
        sourceId: relationship.lineage.sourceId,
        parentKnowledgeRelationshipIds: uniqueSorted(
          relationship.lineage.parentRelationshipIds.map((id) => `krel:${id}`),
        ),
        parentEvidenceRelationshipIds: uniqueSorted(relationship.lineage.parentRelationshipIds),
        transformationSteps: uniqueSorted(["knowledge_compile", ...relationship.lineage.transformationSteps]),
      },
    }));

    const claims: KnowledgeClaim[] = evidenceIR.graph.nodes
      .filter((node) => node.nodeType === "artifact")
      .map((node) => this.claimFromEvidenceNode(node, evidenceIR, nodeIdMap));

    const graph = new KnowledgeGraph(nodes, relationships, claims);

    const hashMaterial: Omit<KnowledgeIR, "deterministicHash"> = {
      schemaVersion: "1.0.0",
      graph,
      claimCount: graph.claims.length,
      compiledFromEvidenceHash: evidenceIR.deterministicHash,
      generatedAt: evidenceIR.generatedAt,
    };

    const knowledgeIR: KnowledgeIR = {
      schemaVersion: "1.0.0",
      graph,
      claimCount: graph.claims.length,
      compiledFromEvidenceHash: evidenceIR.deterministicHash,
      generatedAt: evidenceIR.generatedAt,
      deterministicHash: this.hasher.hashIR(hashMaterial),
    };

    this.knowledgeValidator.validateIR(knowledgeIR);
    return knowledgeIR;
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
