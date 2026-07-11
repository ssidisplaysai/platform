import type { KnowledgeVersion } from "./KnowledgeVersion";
import type { KnowledgeSourceType } from "./KnowledgeSource";
import type { Lineage } from "../provenance/Lineage";

export interface RawKnowledgeArtifact {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  origin: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  modifiedAt: string;
  discoveredAt: string;
  lineage: Lineage;
  confidence?: number;
}

export interface KnowledgeArtifact {
  id: string;
  sourceId: string;
  artifactId: string;
  versionId: string;
  sourceType: KnowledgeSourceType;
  origin: string;
  checksum: string;
  createdAt: string;
  modifiedAt: string;
  discoveredAt: string;
  metadata: Record<string, unknown>;
  lineage: Lineage;
  confidence: number;
  content: string;
  version: KnowledgeVersion;
}
