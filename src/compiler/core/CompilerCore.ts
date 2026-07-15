import { CompilerKernel } from "./CompilerKernel";
import { CompilerPipeline } from "./CompilerPipeline";
import { DiscoveryCompilerPass } from "./passes/DiscoveryCompilerPass";
import { EvidenceCompilerPass } from "./passes/EvidenceCompilerPass";
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
  }

  async compile(input: CompilerCoreInput, sessionId?: string): Promise<CompilerCoreOutput> {
    const result = await this.kernel.compile(input, sessionId ?? {});
    const discoveryOutput = result.outputs["discovery-pass"] as { readonly artifacts: CompilerCoreOutput["artifacts"] } | undefined;
    const evidenceOutput = result.outputs["evidence-pass"] as { readonly evidenceIR: CompilerCoreOutput["evidenceIR"] } | undefined;

    if (!discoveryOutput || !evidenceOutput) {
      throw new Error("Required pass outputs missing: discovery-pass and evidence-pass");
    }

    return {
      artifacts: discoveryOutput.artifacts,
      evidenceIR: evidenceOutput.evidenceIR,
      manifest: result.manifest,
    };
  }

  getPipeline(): CompilerPipeline {
    return this.pipeline;
  }
}
