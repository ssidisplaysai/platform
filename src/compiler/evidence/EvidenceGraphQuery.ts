import type { EvidenceGraph } from "./EvidenceGraph";
import type { EvidenceNode, EvidenceNodeType } from "./EvidenceNode";
import type { EvidenceRelationship, EvidenceRelationshipType } from "./EvidenceRelationship";

export class EvidenceGraphQuery {
  constructor(private readonly graph: EvidenceGraph) {}

  nodeById(id: string): EvidenceNode | undefined {
    return this.graph.nodes.find((node) => node.id === id);
  }

  nodesByType(nodeType: EvidenceNodeType): EvidenceNode[] {
    return this.graph.nodes.filter((node) => node.nodeType === nodeType);
  }

  relationshipsByType(relationshipType: EvidenceRelationshipType): EvidenceRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.relationshipType === relationshipType);
  }

  outgoing(nodeId: string): EvidenceRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.from === nodeId);
  }

  incoming(nodeId: string): EvidenceRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.to === nodeId);
  }

  neighbors(nodeId: string): EvidenceNode[] {
    const outgoing = this.outgoing(nodeId).map((relationship) => relationship.to);
    const incoming = this.incoming(nodeId).map((relationship) => relationship.from);
    const neighborIds = new Set([...outgoing, ...incoming]);
    return this.graph.nodes.filter((node) => neighborIds.has(node.id));
  }
}
