import { RuntimeCompiler } from "../../runtime/RuntimeCompiler";
import type { EnterpriseRuntimeIR } from "../../runtime/EnterpriseRuntimeIR";
import type { CompilerPass } from "../types";
import type { SolutionPassOutput } from "./SolutionCompilerPass";

export interface RuntimePassOutput {
  enterpriseRuntimeIR: EnterpriseRuntimeIR;
}

export class RuntimeCompilerPass implements CompilerPass<SolutionPassOutput, RuntimePassOutput> {
  readonly metadata = {
    id: "runtime-pass",
    version: "1.0.0",
    description: "Enterprise runtime compiler pass wrapper for Compiler Core orchestration",
    inputType: "solution-ir",
    outputType: "enterprise-runtime-ir",
    dependencies: ["solution-pass"],
    capabilities: ["runtime", "activation-model", "determinism"],
    lifecycle: "active" as const,
  };

  constructor(private readonly compiler: RuntimeCompiler = new RuntimeCompiler()) {}

  execute(input: SolutionPassOutput): RuntimePassOutput {
    return {
      enterpriseRuntimeIR: this.compiler.compile(input.solutionIR),
    };
  }
}
