export type KnowledgeNodeType = "source_record" | "artifact_record";

export interface KnowledgeNodeLineage {
  sourceId: string;
  parentKnowledgeNodeIds: string[];
  parentEvidenceNodeIds: string[];
  transformationSteps: string[];
}

export interface KnowledgeNode {
  id: string;
  nodeType: KnowledgeNodeType;
  sourceId: string;
  sourceType: string;
  origin: string;
  confidence: number;
  evidenceNodeId: string;
  createdAt?: string;
  modifiedAt?: string;
  discoveredAt?: string;
  metadata: Record<string, unknown>;
  lineage: KnowledgeNodeLineage;
}
