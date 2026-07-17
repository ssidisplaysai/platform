import { describe, expect, it } from "@jest/globals";

import {
  CompilationError,
  CompilerError,
  SchemaError,
  ValidationError,
} from "../CompilerError";

describe("CompilerError", () => {
  it("preserves compiler metadata", () => {
    const error = new CompilerError(
      "compiler failed",
      "WorkbookCompiler",
      "COMPILATION_ERROR",
    );

    expect(error.name).toBe("CompilerError");
    expect(error.compilerId).toBe("WorkbookCompiler");
    expect(error.code).toBe("COMPILATION_ERROR");
    expect(error.message).toBe("compiler failed");
  });

  it.each([
    [new ValidationError("invalid", "TestCompiler"), "VALIDATION_ERROR"],
    [new CompilationError("failed", "TestCompiler"), "COMPILATION_ERROR"],
    [new SchemaError("schema", "TestCompiler"), "SCHEMA_ERROR"],
  ])("creates typed compiler errors", (error, expectedCode) => {
    expect(error).toBeInstanceOf(CompilerError);
    expect(error.code).toBe(expectedCode);
  });
});
