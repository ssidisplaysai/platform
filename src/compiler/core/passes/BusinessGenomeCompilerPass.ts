import { BusinessGenomeCompiler } from "../../business-genome/BusinessGenomeCompiler";
import type { BusinessGenomeIR } from "../../business-genome/BusinessGenomeIR";
import type { CompilerPass } from "../types";
import type { KnowledgePassOutput } from "./KnowledgeCompilerPass";

export interface BusinessGenomePassOutput {
  businessGenomeIR: BusinessGenomeIR;
}

export class BusinessGenomeCompilerPass implements CompilerPass<KnowledgePassOutput, BusinessGenomePassOutput> {
  readonly metadata = {
    id: "business-genome-pass",
    version: "1.0.0",
    description: "Business Genome compiler pass wrapper for Compiler Core orchestration",
    inputType: "knowledge-ir",
    outputType: "business-genome-ir",
    dependencies: ["knowledge-pass"],
    capabilities: ["business-genome", "determinism", "governed-conflict-preservation"],
    lifecycle: "active" as const,
  };

  constructor(private readonly compiler: BusinessGenomeCompiler = new BusinessGenomeCompiler()) {}

  execute(input: KnowledgePassOutput): BusinessGenomePassOutput {
    return {
      businessGenomeIR: this.compiler.compile(input.knowledgeIR),
    };
  }
}
