export type EvidenceRelationshipType = "produced" | "derived_from" | "transformed_to";

export interface EvidenceRelationshipLineage {
  sourceId: string;
  parentRelationshipIds: string[];
  transformationSteps: string[];
}

export interface EvidenceRelationship {
  id: string;
  from: string;
  to: string;
  relationshipType: EvidenceRelationshipType;
  sourceId: string;
  metadata: Record<string, unknown>;
  lineage: EvidenceRelationshipLineage;
}
