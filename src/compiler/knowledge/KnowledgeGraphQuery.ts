import type { KnowledgeClaim } from "./KnowledgeClaim";
import type { KnowledgeGraph } from "./KnowledgeGraph";
import type { KnowledgeNode, KnowledgeNodeType } from "./KnowledgeNode";
import type { KnowledgeRelationship, KnowledgeRelationshipType } from "./KnowledgeRelationship";

export class KnowledgeGraphQuery {
  constructor(private readonly graph: KnowledgeGraph) {}

  nodeById(id: string): KnowledgeNode | undefined {
    return this.graph.nodes.find((node) => node.id === id);
  }

  claimById(id: string): KnowledgeClaim | undefined {
    return this.graph.claims.find((claim) => claim.id === id);
  }

  nodesByType(nodeType: KnowledgeNodeType): KnowledgeNode[] {
    return this.graph.nodes.filter((node) => node.nodeType === nodeType);
  }

  relationshipsByType(relationshipType: KnowledgeRelationshipType): KnowledgeRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.relationshipType === relationshipType);
  }

  claimsBySubjectNode(nodeId: string): KnowledgeClaim[] {
    return this.graph.claims.filter((claim) => claim.subjectNodeId === nodeId);
  }

  claimsByEvidenceNode(evidenceNodeId: string): KnowledgeClaim[] {
    return this.graph.claims.filter((claim) => claim.evidenceNodeIds.includes(evidenceNodeId));
  }

  outgoing(nodeId: string): KnowledgeRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.from === nodeId);
  }

  incoming(nodeId: string): KnowledgeRelationship[] {
    return this.graph.relationships.filter((relationship) => relationship.to === nodeId);
  }

  neighbors(nodeId: string): KnowledgeNode[] {
    const outgoing = this.outgoing(nodeId).map((relationship) => relationship.to);
    const incoming = this.incoming(nodeId).map((relationship) => relationship.from);
    const neighborIds = new Set([...outgoing, ...incoming]);
    return this.graph.nodes.filter((node) => neighborIds.has(node.id));
  }
}
