import type { CompilerContext } from "./CompilerContext";
import type { CompilerResult } from "./CompilerResult";

export interface GenesisCompiler<TInput, TOutput> {
  readonly id: string;
  readonly version: string;
  readonly description: string;

  validate(input: TInput): Promise<void>;

  compile(
    input: TInput,
    context: CompilerContext,
  ): Promise<CompilerResult<TOutput>>;
}
