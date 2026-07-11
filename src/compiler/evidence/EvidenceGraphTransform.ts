import { EvidenceGraph } from "./EvidenceGraph";
import type { EvidenceNode } from "./EvidenceNode";
import type { EvidenceRelationship } from "./EvidenceRelationship";

function appendStep(steps: readonly string[], step: string): string[] {
  return [...new Set([...steps, step])].sort();
}

export class EvidenceGraphTransform {
  tagTransformation(graph: EvidenceGraph, transformationStep: string): EvidenceGraph {
    const nodes = graph.nodes.map((node) => ({
      ...node,
      lineage: {
        ...node.lineage,
        transformationSteps: appendStep(node.lineage.transformationSteps, transformationStep),
      },
    }));

    const relationships = graph.relationships.map((relationship) => ({
      ...relationship,
      lineage: {
        ...relationship.lineage,
        transformationSteps: appendStep(relationship.lineage.transformationSteps, transformationStep),
      },
    }));

    return new EvidenceGraph(nodes, relationships);
  }

  remapNodeIds(graph: EvidenceGraph, mapping: Record<string, string>, transformationStep: string): EvidenceGraph {
    const remap = (id: string): string => mapping[id] ?? id;

    const nodes: EvidenceNode[] = graph.nodes.map((node) => ({
      ...node,
      id: remap(node.id),
      lineage: {
        ...node.lineage,
        parentNodeIds: [...new Set([...node.lineage.parentNodeIds, node.id])].sort(),
        transformationSteps: appendStep(node.lineage.transformationSteps, transformationStep),
      },
    }));

    const relationships: EvidenceRelationship[] = graph.relationships.map((relationship) => ({
      ...relationship,
      id: `${relationship.id}:${transformationStep}`,
      from: remap(relationship.from),
      to: remap(relationship.to),
      lineage: {
        ...relationship.lineage,
        parentRelationshipIds: [...new Set([...relationship.lineage.parentRelationshipIds, relationship.id])].sort(),
        transformationSteps: appendStep(relationship.lineage.transformationSteps, transformationStep),
      },
    }));

    return new EvidenceGraph(nodes, relationships);
  }
}
