import type { EvidenceNode } from "./EvidenceNode";
import type { EvidenceRelationship } from "./EvidenceRelationship";

function sortNodes(nodes: readonly EvidenceNode[]): EvidenceNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

function sortRelationships(relationships: readonly EvidenceRelationship[]): EvidenceRelationship[] {
  return [...relationships].sort((a, b) => a.id.localeCompare(b.id));
}

export class EvidenceGraph {
  readonly nodes: EvidenceNode[];
  readonly relationships: EvidenceRelationship[];

  constructor(nodes: readonly EvidenceNode[] = [], relationships: readonly EvidenceRelationship[] = []) {
    this.nodes = sortNodes(nodes);
    this.relationships = sortRelationships(relationships);
  }

  withNode(node: EvidenceNode): EvidenceGraph {
    return new EvidenceGraph([...this.nodes, node], this.relationships);
  }

  withRelationship(relationship: EvidenceRelationship): EvidenceGraph {
    return new EvidenceGraph(this.nodes, [...this.relationships, relationship]);
  }

  toObject(): { nodes: EvidenceNode[]; relationships: EvidenceRelationship[] } {
    return {
      nodes: sortNodes(this.nodes),
      relationships: sortRelationships(this.relationships),
    };
  }
}
