import { EvidenceGraph } from "./EvidenceGraph";
import type { EvidenceNode } from "./EvidenceNode";
import type { EvidenceRelationship } from "./EvidenceRelationship";

export class EvidenceMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceMergeError";
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function mergeNodes(left: EvidenceNode, right: EvidenceNode): EvidenceNode {
  const requiredMatches: Array<[string, string | undefined, string | undefined]> = [
    ["nodeType", left.nodeType, right.nodeType],
    ["sourceId", left.sourceId, right.sourceId],
    ["sourceType", left.sourceType, right.sourceType],
    ["origin", left.origin, right.origin],
    ["artifactId", left.artifactId, right.artifactId],
    ["versionId", left.versionId, right.versionId],
    ["checksum", left.checksum, right.checksum],
  ];

  for (const [field, a, b] of requiredMatches) {
    if ((a ?? "") !== (b ?? "")) {
      throw new EvidenceMergeError(`Node conflict for ${left.id} on field ${field}`);
    }
  }

  return {
    ...left,
    metadata: {
      ...left.metadata,
      ...right.metadata,
    },
    confidence: Math.max(left.confidence, right.confidence),
    lineage: {
      sourceId: left.lineage.sourceId,
      parentNodeIds: uniqueSorted([...left.lineage.parentNodeIds, ...right.lineage.parentNodeIds]),
      transformationSteps: uniqueSorted([...left.lineage.transformationSteps, ...right.lineage.transformationSteps]),
    },
  };
}

function mergeRelationships(left: EvidenceRelationship, right: EvidenceRelationship): EvidenceRelationship {
  const requiredMatches: Array<[string, string, string]> = [
    ["from", left.from, right.from],
    ["to", left.to, right.to],
    ["relationshipType", left.relationshipType, right.relationshipType],
    ["sourceId", left.sourceId, right.sourceId],
  ];

  for (const [field, a, b] of requiredMatches) {
    if (a !== b) {
      throw new EvidenceMergeError(`Relationship conflict for ${left.id} on field ${field}`);
    }
  }

  return {
    ...left,
    metadata: {
      ...left.metadata,
      ...right.metadata,
    },
    lineage: {
      sourceId: left.lineage.sourceId,
      parentRelationshipIds: uniqueSorted([
        ...left.lineage.parentRelationshipIds,
        ...right.lineage.parentRelationshipIds,
      ]),
      transformationSteps: uniqueSorted([
        ...left.lineage.transformationSteps,
        ...right.lineage.transformationSteps,
      ]),
    },
  };
}

export class EvidenceGraphMerger {
  merge(...graphs: readonly EvidenceGraph[]): EvidenceGraph {
    const nodeMap = new Map<string, EvidenceNode>();
    const relationshipMap = new Map<string, EvidenceRelationship>();

    for (const graph of graphs) {
      for (const node of graph.nodes) {
        const existing = nodeMap.get(node.id);
        nodeMap.set(node.id, existing ? mergeNodes(existing, node) : node);
      }

      for (const relationship of graph.relationships) {
        const existing = relationshipMap.get(relationship.id);
        relationshipMap.set(
          relationship.id,
          existing ? mergeRelationships(existing, relationship) : relationship,
        );
      }
    }

    return new EvidenceGraph([...nodeMap.values()], [...relationshipMap.values()]);
  }
}
