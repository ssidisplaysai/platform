import { CompilerPipeline } from "./CompilerPipeline";
import type { CompileOptions } from "./CompilerPipeline";
import type { CompilerPass, CompilerResult } from "./types";

export class CompilerKernel {
  constructor(private readonly pipeline: CompilerPipeline = new CompilerPipeline()) {}

  registerPass(pass: CompilerPass<unknown, unknown>): void {
    this.pipeline.registry.register(pass);
  }

  compile<TInput>(input: TInput, options: string | CompileOptions = {}): Promise<CompilerResult> {
    return this.pipeline.compile(input, options);
  }

  getPipeline(): CompilerPipeline {
    return this.pipeline;
  }
}