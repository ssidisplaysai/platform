export type EvidenceNodeType = "source" | "artifact";

export interface EvidenceLineage {
  sourceId: string;
  parentNodeIds: string[];
  transformationSteps: string[];
}

export interface EvidenceNode {
  id: string;
  nodeType: EvidenceNodeType;
  sourceId: string;
  artifactId?: string;
  versionId?: string;
  sourceType: string;
  origin: string;
  checksum?: string;
  confidence: number;
  createdAt?: string;
  modifiedAt?: string;
  discoveredAt?: string;
  metadata: Record<string, unknown>;
  lineage: EvidenceLineage;
}
