import type { KnowledgeArtifact } from "../discovery/KnowledgeArtifact";
import type { KnowledgeVersion } from "../discovery/KnowledgeVersion";
import type { CanonicalArtifact } from "../normalization/CanonicalNormalizer";
import { Fingerprint } from "./Fingerprint";
import { SourceHash } from "./SourceHash";

export class ProvenanceEngine {
  enrich(canonicalArtifact: CanonicalArtifact): KnowledgeArtifact {
    const checksum = SourceHash.sha256(canonicalArtifact.normalizedContent);
    const artifactId = Fingerprint.fromParts([canonicalArtifact.sourceId, canonicalArtifact.origin]);
    const versionId = `v-${checksum.slice(0, 16)}`;
    const id = Fingerprint.fromParts([artifactId, versionId]);

    const version: KnowledgeVersion = {
      versionId,
      checksum,
      createdAt: canonicalArtifact.createdAt,
      modifiedAt: canonicalArtifact.modifiedAt,
      discoveredAt: canonicalArtifact.discoveredAt,
    };

    return {
      id,
      sourceId: canonicalArtifact.sourceId,
      artifactId,
      versionId,
      sourceType: canonicalArtifact.sourceType,
      origin: canonicalArtifact.origin,
      checksum,
      createdAt: canonicalArtifact.createdAt,
      modifiedAt: canonicalArtifact.modifiedAt,
      discoveredAt: canonicalArtifact.discoveredAt,
      metadata: canonicalArtifact.normalizedMetadata,
      lineage: canonicalArtifact.lineage,
      confidence: canonicalArtifact.confidence,
      content: canonicalArtifact.normalizedContent,
      version,
    };
  }
}
