export interface GenesisCompilerMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly inputTypes: readonly string[];
  readonly outputTypes: readonly string[];
  readonly artifactTypes: readonly string[];
  readonly capabilities: readonly string[];
}

export interface GenesisCompiler<TInput, TOutput>
  extends GenesisCompilerMetadata {
  compile(input: TInput): Promise<TOutput>;
}
