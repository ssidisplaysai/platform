import type { GenesisCompiler } from "./GenesisCompiler";
import { CompilerError } from "./CompilerError";

type RegisteredCompiler = GenesisCompiler<any, any>;

export class CompilerRegistry {
  private readonly compilers = new Map<string, RegisteredCompiler>();

  public register<TInput, TOutput>(
    compiler: GenesisCompiler<TInput, TOutput>,
  ): void {
    if (this.compilers.has(compiler.id)) {
      throw new CompilerError(
        `Compiler "${compiler.id}" is already registered.`,
        compiler.id,
        "DUPLICATE_COMPILER",
      );
    }

    this.compilers.set(compiler.id, compiler);
  }

  public get<TInput, TOutput>(
    compilerId: string,
  ): GenesisCompiler<TInput, TOutput> {
    const compiler = this.compilers.get(compilerId);

    if (!compiler) {
      throw new CompilerError(
        `Compiler "${compilerId}" is not registered.`,
        compilerId,
        "COMPILER_NOT_FOUND",
      );
    }

    return compiler as GenesisCompiler<TInput, TOutput>;
  }

  public has(compilerId: string): boolean {
    return this.compilers.has(compilerId);
  }

  public list(): readonly string[] {
    return [...this.compilers.keys()].sort();
  }
}
