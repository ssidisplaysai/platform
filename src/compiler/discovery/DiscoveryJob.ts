import type { KnowledgeSource } from "./KnowledgeSource";

export interface DiscoveryJobConfig {
  source: KnowledgeSource;
}

export class DiscoveryJob {
  readonly id: string;
  readonly source: KnowledgeSource;

  constructor(config: DiscoveryJobConfig) {
    this.source = config.source;
    this.id = `${config.source.sourceType}:${config.source.id}`;
  }
}
