import type { RawKnowledgeArtifact } from "../discovery/KnowledgeArtifact";
import { ContentNormalizer } from "./ContentNormalizer";
import { MetadataNormalizer } from "./MetadataNormalizer";

export interface CanonicalArtifact {
  sourceId: string;
  sourceType: RawKnowledgeArtifact["sourceType"];
  origin: string;
  normalizedContent: string;
  normalizedMetadata: Record<string, unknown>;
  createdAt: string;
  modifiedAt: string;
  discoveredAt: string;
  confidence: number;
  lineage: RawKnowledgeArtifact["lineage"];
}

export class CanonicalNormalizer {
  constructor(
    private readonly contentNormalizer: ContentNormalizer = new ContentNormalizer(),
    private readonly metadataNormalizer: MetadataNormalizer = new MetadataNormalizer(),
  ) {}

  normalize(rawArtifact: RawKnowledgeArtifact): CanonicalArtifact {
    return {
      sourceId: rawArtifact.sourceId,
      sourceType: rawArtifact.sourceType,
      origin: rawArtifact.origin,
      normalizedContent: this.contentNormalizer.normalize(rawArtifact.sourceType, rawArtifact.content),
      normalizedMetadata: this.metadataNormalizer.normalize(rawArtifact.metadata),
      createdAt: rawArtifact.createdAt,
      modifiedAt: rawArtifact.modifiedAt,
      discoveredAt: rawArtifact.discoveredAt,
      confidence: rawArtifact.confidence ?? 1,
      lineage: rawArtifact.lineage,
    };
  }
}
