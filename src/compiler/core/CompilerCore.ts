import { CompilerKernel } from "./CompilerKernel";
import { CompilerPipeline } from "./CompilerPipeline";
import { DiscoveryCompilerPass } from "./passes/DiscoveryCompilerPass";
import { EvidenceCompilerPass } from "./passes/EvidenceCompilerPass";
import { KnowledgeCompilerPass } from "./passes/KnowledgeCompilerPass";
import type { CompilerCoreInput, CompilerCoreOutput } from "./types";

export class CompilerCore {
  private readonly kernel: CompilerKernel;
  private readonly pipeline: CompilerPipeline;

  constructor(pipeline?: CompilerPipeline) {
    this.pipeline = pipeline ?? new CompilerPipeline();
    this.kernel = new CompilerKernel(this.pipeline);
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

    if (!existing.has("knowledge-pass")) {
      this.pipeline.registry.register(new KnowledgeCompilerPass());
    }
  }

  async compile(input: CompilerCoreInput, sessionId?: string): Promise<CompilerCoreOutput> {
    const result = await this.kernel.compile(input, sessionId ?? {});
    const discoveryOutput = result.outputs["discovery-pass"] as { readonly artifacts: CompilerCoreOutput["artifacts"] } | undefined;
    const evidenceOutput = result.outputs["evidence-pass"] as { readonly evidenceIR: CompilerCoreOutput["evidenceIR"] } | undefined;
    const knowledgeOutput = result.outputs["knowledge-pass"] as { readonly knowledgeIR: CompilerCoreOutput["knowledgeIR"] } | undefined;

    if (!discoveryOutput || !evidenceOutput || !knowledgeOutput) {
      throw new Error("Required pass outputs missing: discovery-pass, evidence-pass, and knowledge-pass");
    }

    return {
      artifacts: discoveryOutput.artifacts,
      evidenceIR: evidenceOutput.evidenceIR,
      knowledgeIR: knowledgeOutput.knowledgeIR,
      manifest: result.manifest,
    };
  }

  getPipeline(): CompilerPipeline {
    return this.pipeline;
  }
}
