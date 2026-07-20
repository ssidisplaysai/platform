import type {
  GenesisCompiler,
  GenesisCompilerMetadata,
} from "../compiler";
import { WorkbookRuntimeCompiler } from "../workbook/workbook-compiler";

export interface CompilerRegistration
  extends GenesisCompilerMetadata {
  readonly id: string;
}

export class CompilerRegistry {
  private readonly compilersById = new Map<
    string,
    GenesisCompiler<unknown, unknown>
  >();

  public register<TInput, TOutput>(
    compiler: GenesisCompiler<TInput, TOutput>,
  ): void {
    const id = compiler.id.trim().toLowerCase();

    if (!id) {
      throw new Error("Compiler id is required.");
    }

    this.compilersById.set(id, compiler);
  }

  public list(): readonly CompilerRegistration[] {
    return [...this.compilersById.values()]
      .map((compiler) => this.toMetadata(compiler))
      .sort((left, right) =>
        left.name.localeCompare(right.name),
      );
  }

  public resolve(
    idOrName: string,
  ): GenesisCompiler<unknown, unknown> | null {
    const key = idOrName.trim().toLowerCase();

    if (!key) {
      return null;
    }

    const directMatch = this.compilersById.get(key);

    if (directMatch) {
      return directMatch;
    }

    const byName =
      [...this.compilersById.values()].find(
        (compiler) => compiler.name.toLowerCase() === key,
      ) ?? null;

    return byName;
  }

  public has(idOrName: string): boolean {
    return this.resolve(idOrName) !== null;
  }

  public remove(idOrName: string): boolean {
    const compiler = this.resolve(idOrName);

    if (!compiler) {
      return false;
    }

    return this.compilersById.delete(compiler.id.toLowerCase());
  }

  public metadata(idOrName?: string):
    | CompilerRegistration
    | readonly CompilerRegistration[]
    | null {
    if (!idOrName) {
      return this.list();
    }

    const compiler = this.resolve(idOrName);

    if (!compiler) {
      return null;
    }

    return this.toMetadata(compiler);
  }

  private toMetadata(
    compiler: GenesisCompiler<unknown, unknown>,
  ): CompilerRegistration {
    return {
      id: compiler.id,
      name: compiler.name,
      version: compiler.version,
      description: compiler.description,
      author: compiler.author,
      inputTypes: [...compiler.inputTypes],
      outputTypes: [...compiler.outputTypes],
      artifactTypes: [...compiler.artifactTypes],
      capabilities: [...compiler.capabilities],
    };
  }
}

export function createDefaultCompilerRegistry(): CompilerRegistry {
  const registry = new CompilerRegistry();

  registry.register(new WorkbookRuntimeCompiler());

  return registry;
}

export const defaultCompilerRegistry =
  createDefaultCompilerRegistry();
