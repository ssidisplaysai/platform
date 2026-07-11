export type KnowledgeRelationshipType = "supported_by" | "derived_from" | "transforms_to";

export interface KnowledgeRelationshipLineage {
  sourceId: string;
  parentKnowledgeRelationshipIds: string[];
  parentEvidenceRelationshipIds: string[];
  transformationSteps: string[];
}

export interface KnowledgeRelationship {
  id: string;
  from: string;
  to: string;
  relationshipType: KnowledgeRelationshipType;
  sourceId: string;
  evidenceRelationshipId: string;
  metadata: Record<string, unknown>;
  lineage: KnowledgeRelationshipLineage;
}
