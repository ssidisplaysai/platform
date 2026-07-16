import { BlueprintCompiler } from "../../blueprint/BlueprintCompiler";
import type { EnterpriseBlueprintIR } from "../../blueprint/BlueprintIR";
import type { CompilerPass } from "../types";
import type { BusinessGenomePassOutput } from "./BusinessGenomeCompilerPass";

export interface BlueprintPassOutput {
  enterpriseBlueprintIR: EnterpriseBlueprintIR;
}

export class BlueprintCompilerPass implements CompilerPass<BusinessGenomePassOutput, BlueprintPassOutput> {
  readonly metadata = {
    id: "blueprint-pass",
    version: "1.0.0",
    description: "Blueprint compiler pass wrapper for Compiler Core orchestration",
    inputType: "business-genome-ir",
    outputType: "enterprise-blueprint-ir",
    dependencies: ["business-genome-pass"],
    capabilities: ["blueprint", "architecture-projection", "determinism"],
    lifecycle: "active" as const,
  };

  constructor(private readonly compiler: BlueprintCompiler = new BlueprintCompiler()) {}

  execute(input: BusinessGenomePassOutput): BlueprintPassOutput {
    return {
      enterpriseBlueprintIR: this.compiler.compile(input.businessGenomeIR),
    };
  }
}
