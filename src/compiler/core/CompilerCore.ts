import { CompilerKernel } from "./CompilerKernel";
import { CompilerPipeline } from "./CompilerPipeline";
import { DiscoveryCompilerPass } from "./passes/DiscoveryCompilerPass";
import { EvidenceCompilerPass } from "./passes/EvidenceCompilerPass";
import { KnowledgeCompilerPass } from "./passes/KnowledgeCompilerPass";
import { BusinessGenomeCompilerPass } from "./passes/BusinessGenomeCompilerPass";
import { BlueprintCompilerPass } from "./passes/BlueprintCompilerPass";
import { SolutionCompilerPass } from "./passes/SolutionCompilerPass";
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

    if (!existing.has("business-genome-pass")) {
      this.pipeline.registry.register(new BusinessGenomeCompilerPass());
    }

    if (!existing.has("blueprint-pass")) {
      this.pipeline.registry.register(new BlueprintCompilerPass());
    }

    if (!existing.has("solution-pass")) {
      this.pipeline.registry.register(new SolutionCompilerPass());
    }
  }

  async compile(input: CompilerCoreInput, sessionId?: string): Promise<CompilerCoreOutput> {
    const result = await this.kernel.compile(input, sessionId ?? {});
    const discoveryOutput = result.outputs["discovery-pass"] as { readonly artifacts: CompilerCoreOutput["artifacts"] } | undefined;
    const evidenceOutput = result.outputs["evidence-pass"] as { readonly evidenceIR: CompilerCoreOutput["evidenceIR"] } | undefined;
    const knowledgeOutput = result.outputs["knowledge-pass"] as { readonly knowledgeIR: CompilerCoreOutput["knowledgeIR"] } | undefined;
    const businessGenomeOutput = result.outputs["business-genome-pass"] as { readonly businessGenomeIR: CompilerCoreOutput["businessGenomeIR"] } | undefined;
    const blueprintOutput = result.outputs["blueprint-pass"] as { readonly enterpriseBlueprintIR: CompilerCoreOutput["enterpriseBlueprintIR"] } | undefined;
    const solutionOutput = result.outputs["solution-pass"] as { readonly solutionIR: CompilerCoreOutput["solutionIR"] } | undefined;

    if (!discoveryOutput || !evidenceOutput || !knowledgeOutput || !businessGenomeOutput || !blueprintOutput || !solutionOutput) {
      throw new Error("Required pass outputs missing: discovery-pass, evidence-pass, knowledge-pass, business-genome-pass, blueprint-pass, and solution-pass");
    }

    return {
      artifacts: discoveryOutput.artifacts,
      evidenceIR: evidenceOutput.evidenceIR,
      knowledgeIR: knowledgeOutput.knowledgeIR,
      businessGenomeIR: businessGenomeOutput.businessGenomeIR,
      enterpriseBlueprintIR: blueprintOutput.enterpriseBlueprintIR,
      solutionIR: solutionOutput.solutionIR,
      manifest: result.manifest,
    };
  }

  getPipeline(): CompilerPipeline {
    return this.pipeline;
  }
}
