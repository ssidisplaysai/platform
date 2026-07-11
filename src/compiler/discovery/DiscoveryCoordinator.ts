import { CanonicalNormalizer } from "../normalization/CanonicalNormalizer";
import { EvidenceEmitter } from "../evidence/EvidenceEmitter";
import type { EvidenceIR } from "../evidence/EvidenceIR";
import { ProvenanceEngine } from "../provenance/ProvenanceEngine";
import type { DiscoveryJob } from "./DiscoveryJob";
import { DiscoveryRegistry } from "./DiscoveryRegistry";
import type { KnowledgeArtifact } from "./KnowledgeArtifact";

export interface DiscoveryResult {
  artifacts: KnowledgeArtifact[];
  evidenceIR: EvidenceIR;
}

export class DiscoveryCoordinator {
  constructor(
    private readonly registry: DiscoveryRegistry,
    private readonly normalizer: CanonicalNormalizer = new CanonicalNormalizer(),
    private readonly provenanceEngine: ProvenanceEngine = new ProvenanceEngine(),
    private readonly evidenceEmitter: EvidenceEmitter = new EvidenceEmitter(),
  ) {}

  async execute(job: DiscoveryJob): Promise<DiscoveryResult> {
    const plugin = this.registry.resolve(job.source.sourceType);
    const rawArtifacts = await plugin.discover(job);

    const artifacts = rawArtifacts
      .map((rawArtifact) => this.normalizer.normalize(rawArtifact))
      .map((canonicalArtifact) => this.provenanceEngine.enrich(canonicalArtifact))
      .sort((a, b) => {
        const sourceCompare = a.sourceId.localeCompare(b.sourceId);
        if (sourceCompare !== 0) {
          return sourceCompare;
        }

        const artifactCompare = a.artifactId.localeCompare(b.artifactId);
        if (artifactCompare !== 0) {
          return artifactCompare;
        }

        return a.versionId.localeCompare(b.versionId);
      });

    return {
      artifacts,
      evidenceIR: this.evidenceEmitter.emit(artifacts),
    };
  }
}
