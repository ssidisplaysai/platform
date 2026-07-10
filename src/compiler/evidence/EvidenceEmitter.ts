import type { KnowledgeArtifact } from "../discovery/KnowledgeArtifact";
import { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceGraphHasher } from "./EvidenceGraphHasher";
import type { EvidenceIR } from "./EvidenceIR";
import type { EvidenceNode } from "./EvidenceNode";
import type { EvidenceRelationship } from "./EvidenceRelationship";
import { EvidenceValidator } from "./EvidenceValidator";

export class EvidenceEmitter {
  private readonly hasher = new EvidenceGraphHasher();
  private readonly validator = new EvidenceValidator();

  emit(artifacts: readonly KnowledgeArtifact[]): EvidenceIR {
    const sortedArtifacts = [...artifacts].sort((a, b) => {
      const sourceCompare = a.sourceId.localeCompare(b.sourceId);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      const artifactCompare = a.artifactId.localeCompare(b.artifactId);
      if (artifactCompare !== 0) {
        return artifactCompare;
      }

      return a.versionId.localeCompare(b.versionId);
    });

    const sourceNodeMap = new Map<string, EvidenceNode>();
    const artifactNodes: EvidenceNode[] = [];
    const relationships: EvidenceRelationship[] = [];

    for (const artifact of sortedArtifacts) {
      const sourceNodeId = `source:${artifact.sourceId}`;

      if (!sourceNodeMap.has(sourceNodeId)) {
        sourceNodeMap.set(sourceNodeId, {
          id: sourceNodeId,
          nodeType: "source",
          sourceId: artifact.sourceId,
          sourceType: artifact.sourceType,
          origin: artifact.origin,
          confidence: 1,
          createdAt: artifact.createdAt,
          modifiedAt: artifact.modifiedAt,
          discoveredAt: artifact.discoveredAt,
          metadata: {
            lineage: artifact.lineage,
          },
          lineage: {
            sourceId: artifact.sourceId,
            parentNodeIds: [],
            transformationSteps: [],
          },
        });
      }

      const artifactNodeId = `artifact:${artifact.id}`;
      artifactNodes.push({
        id: artifactNodeId,
        nodeType: "artifact",
        sourceId: artifact.sourceId,
        artifactId: artifact.artifactId,
        versionId: artifact.versionId,
        sourceType: artifact.sourceType,
        origin: artifact.origin,
        checksum: artifact.checksum,
        confidence: artifact.confidence,
        createdAt: artifact.createdAt,
        modifiedAt: artifact.modifiedAt,
        discoveredAt: artifact.discoveredAt,
        metadata: artifact.metadata,
        lineage: {
          sourceId: artifact.sourceId,
          parentNodeIds: [sourceNodeId],
          transformationSteps: [],
        },
      });

      relationships.push({
        id: `rel:${sourceNodeId}->${artifactNodeId}`,
        from: sourceNodeId,
        to: artifactNodeId,
        relationshipType: "produced",
        sourceId: artifact.sourceId,
        metadata: {},
        lineage: {
          sourceId: artifact.sourceId,
          parentRelationshipIds: [],
          transformationSteps: [],
        },
      });
    }

    const nodes = [...sourceNodeMap.values(), ...artifactNodes];
    const sortedRelationships = [...relationships];
    const generatedAt = sortedArtifacts[0]?.discoveredAt ?? "1970-01-01T00:00:00.000Z";
    const graph = new EvidenceGraph(nodes, sortedRelationships);

    const hashMaterial: Omit<EvidenceIR, "deterministicHash"> = {
      schemaVersion: "1.0.0",
      graph,
      artifactCount: sortedArtifacts.length,
      generatedAt,
    };

    const ir: EvidenceIR = {
      schemaVersion: "1.0.0",
      graph,
      artifactCount: sortedArtifacts.length,
      generatedAt,
      deterministicHash: this.hasher.hashIR(hashMaterial),
    };

    this.validator.validateIR(ir);
    return ir;
  }
}
