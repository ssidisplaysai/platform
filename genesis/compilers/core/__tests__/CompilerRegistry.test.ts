import { describe, expect, it } from "@jest/globals";

import { CompilerError } from "../CompilerError";
import { CompilerRegistry } from "../CompilerRegistry";
import type { CompilerContext } from "../CompilerContext";
import type { CompilerResult } from "../CompilerResult";
import type { GenesisCompiler } from "../GenesisCompiler";

interface TestInput {
  readonly value: string;
}

interface TestOutput {
  readonly normalized: string;
}

class TestCompiler implements GenesisCompiler<TestInput, TestOutput> {
  public readonly id = "TestCompiler";
  public readonly version = "1.0.0";
  public readonly description = "Test compiler";

  public async validate(input: TestInput): Promise<void> {
    if (!input.value) {
      throw new Error("value is required");
    }
  }

  public async compile(
    input: TestInput,
    _context: CompilerContext,
  ): Promise<CompilerResult<TestOutput>> {
    await this.validate(input);

    return {
      success: true,
      output: {
        normalized: input.value.trim().toLowerCase(),
      },
      diagnostics: [],
      artifacts: [],
    };
  }
}

describe("CompilerRegistry", () => {
  it("registers and resolves a compiler", () => {
    const registry = new CompilerRegistry();
    const compiler = new TestCompiler();

    registry.register(compiler);

    expect(registry.has(compiler.id)).toBe(true);
    expect(registry.get<TestInput, TestOutput>(compiler.id)).toBe(compiler);
    expect(registry.list()).toEqual(["TestCompiler"]);
  });

  it("rejects duplicate compiler registration", () => {
    const registry = new CompilerRegistry();
    const compiler = new TestCompiler();

    registry.register(compiler);

    expect(() => registry.register(compiler)).toThrow(CompilerError);
  });

  it("throws when compiler is not registered", () => {
    const registry = new CompilerRegistry();

    expect(() => registry.get("MissingCompiler")).toThrow(CompilerError);
  });
});
