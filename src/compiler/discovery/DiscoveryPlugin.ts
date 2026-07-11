import type { DiscoveryJob } from "./DiscoveryJob";
import type { RawKnowledgeArtifact } from "./KnowledgeArtifact";
import type { KnowledgeSourceType } from "./KnowledgeSource";

export interface DiscoveryPlugin {
  readonly name: string;
  readonly sourceType: KnowledgeSourceType;
  discover(job: DiscoveryJob): Promise<RawKnowledgeArtifact[]>;
}
