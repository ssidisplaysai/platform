import type { KnowledgeClaim } from "./KnowledgeClaim";
import type { KnowledgeNode } from "./KnowledgeNode";
import type { KnowledgeRelationship } from "./KnowledgeRelationship";

function sortNodes(nodes: readonly KnowledgeNode[]): KnowledgeNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

function sortRelationships(relationships: readonly KnowledgeRelationship[]): KnowledgeRelationship[] {
  return [...relationships].sort((a, b) => a.id.localeCompare(b.id));
}

function sortClaims(claims: readonly KnowledgeClaim[]): KnowledgeClaim[] {
  return [...claims].sort((a, b) => a.id.localeCompare(b.id));
}

export class KnowledgeGraph {
  readonly nodes: KnowledgeNode[];
  readonly relationships: KnowledgeRelationship[];
  readonly claims: KnowledgeClaim[];

  constructor(
    nodes: readonly KnowledgeNode[] = [],
    relationships: readonly KnowledgeRelationship[] = [],
    claims: readonly KnowledgeClaim[] = [],
  ) {
    this.nodes = sortNodes(nodes);
    this.relationships = sortRelationships(relationships);
    this.claims = sortClaims(claims);
  }

  withNode(node: KnowledgeNode): KnowledgeGraph {
    return new KnowledgeGraph([...this.nodes, node], this.relationships, this.claims);
  }

  withRelationship(relationship: KnowledgeRelationship): KnowledgeGraph {
    return new KnowledgeGraph(this.nodes, [...this.relationships, relationship], this.claims);
  }

  withClaim(claim: KnowledgeClaim): KnowledgeGraph {
    return new KnowledgeGraph(this.nodes, this.relationships, [...this.claims, claim]);
  }

  toObject(): {
    nodes: KnowledgeNode[];
    relationships: KnowledgeRelationship[];
    claims: KnowledgeClaim[];
  } {
    return {
      nodes: sortNodes(this.nodes),
      relationships: sortRelationships(this.relationships),
      claims: sortClaims(this.claims),
    };
  }
}
