import { SolutionCompiler } from "../../solution/SolutionCompiler";
import type { SolutionIR } from "../../solution/SolutionIR";
import type { CompilerPass } from "../types";
import type { BlueprintPassOutput } from "./BlueprintCompilerPass";

export interface SolutionPassOutput {
  solutionIR: SolutionIR;
}

export class SolutionCompilerPass implements CompilerPass<BlueprintPassOutput, SolutionPassOutput> {
  readonly metadata = {
    id: "solution-pass",
    version: "1.0.0",
    description: "Solution compiler pass wrapper for Compiler Core orchestration",
    inputType: "enterprise-blueprint-ir",
    outputType: "solution-ir",
    dependencies: ["blueprint-pass"],
    capabilities: ["solution", "architecture-realization", "determinism"],
    lifecycle: "active" as const,
  };

  constructor(private readonly compiler: SolutionCompiler = new SolutionCompiler()) {}

  execute(input: BlueprintPassOutput): SolutionPassOutput {
    return {
      solutionIR: this.compiler.compile(input.enterpriseBlueprintIR),
    };
  }
}
