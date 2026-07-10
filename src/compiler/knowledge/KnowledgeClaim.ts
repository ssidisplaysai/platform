export type KnowledgeClaimType = "existence";

export interface KnowledgeClaimLineage {
  sourceId: string;
  parentClaimIds: string[];
  parentEvidenceNodeIds: string[];
  parentEvidenceRelationshipIds: string[];
  transformationSteps: string[];
}

export interface KnowledgeClaim {
  id: string;
  claimType: KnowledgeClaimType;
  subjectNodeId: string;
  statement: string;
  confidence: number;
  evidenceNodeIds: string[];
  evidenceRelationshipIds: string[];
  metadata: Record<string, unknown>;
  lineage: KnowledgeClaimLineage;
}
