import { DiscoveryEngine } from "../../discovery/DiscoveryEngine";
import type { KnowledgeArtifact } from "../../discovery/KnowledgeArtifact";
import type { KnowledgeSource } from "../../discovery/KnowledgeSource";
import type { CompilerPass } from "../types";

export interface DiscoveryPassInput {
  source: KnowledgeSource;
}

export interface DiscoveryPassOutput {
  artifacts: KnowledgeArtifact[];
}

export class DiscoveryCompilerPass implements CompilerPass<DiscoveryPassInput, DiscoveryPassOutput> {
  readonly metadata = {
    id: "discovery-pass",
    version: "1.0.0",
    description: "Discovery compiler pass wrapper for Compiler Core orchestration",
    inputType: "knowledge-source",
    outputType: "knowledge-artifacts",
    dependencies: [],
    capabilities: ["discovery", "ingestion"],
    lifecycle: "active" as const,
  };

  constructor(private readonly discoveryEngine: DiscoveryEngine = new DiscoveryEngine()) {}

  async execute(input: DiscoveryPassInput): Promise<DiscoveryPassOutput> {
    const result = await this.discoveryEngine.ingest(input.source);
    return {
      artifacts: result.artifacts,
    };
  }
}
