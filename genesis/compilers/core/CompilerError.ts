export type CompilerErrorCode =
  | "VALIDATION_ERROR"
  | "COMPILATION_ERROR"
  | "SCHEMA_ERROR"
  | "ARTIFACT_ERROR"
  | "COMPILER_NOT_FOUND"
  | "DUPLICATE_COMPILER";

export class CompilerError extends Error {
  public constructor(
    message: string,
    public readonly compilerId: string,
    public readonly code: CompilerErrorCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CompilerError";
  }
}

export class ValidationError extends CompilerError {
  public constructor(
    message: string,
    compilerId: string,
    options?: ErrorOptions,
  ) {
    super(message, compilerId, "VALIDATION_ERROR", options);
    this.name = "ValidationError";
  }
}

export class CompilationError extends CompilerError {
  public constructor(
    message: string,
    compilerId: string,
    options?: ErrorOptions,
  ) {
    super(message, compilerId, "COMPILATION_ERROR", options);
    this.name = "CompilationError";
  }
}

export class SchemaError extends CompilerError {
  public constructor(
    message: string,
    compilerId: string,
    options?: ErrorOptions,
  ) {
    super(message, compilerId, "SCHEMA_ERROR", options);
    this.name = "SchemaError";
  }
}
