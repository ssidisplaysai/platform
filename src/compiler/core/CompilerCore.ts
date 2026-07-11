import { CompilerPipeline } from "./CompilerPipeline";
import { DiscoveryCompilerPass } from "./passes/DiscoveryCompilerPass";
import { EvidenceCompilerPass } from "./passes/EvidenceCompilerPass";
import type { CompilerCoreInput, CompilerCoreOutput } from "./types";

export class CompilerCore {
  private readonly pipeline: CompilerPipeline;

  constructor(pipeline?: CompilerPipeline) {
    this.pipeline = pipeline ?? new CompilerPipeline();
    this.bootstrapDefaultPasses();
  }

  private bootstrapDefaultPasses(): void {
    const existing = new Set(this.pipeline.registry.list().map((metadata) => metadata.id));

    if (!existing.has("discovery-pass")) {
      this.pipeline.registry.register(new DiscoveryCompilerPass());
    }

    if (!existing.has("evidence-pass")) {
      this.pipeline.registry.register(new EvidenceCompilerPass());
    }
  }

  compile(input: CompilerCoreInput, sessionId?: string): Promise<CompilerCoreOutput> {
    return this.pipeline.compile(input, sessionId);
  }

  getPipeline(): CompilerPipeline {
    return this.pipeline;
  }
}
