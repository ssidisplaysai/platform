import type { CompilerDiagnosticCategory, CompilerDiagnosticSeverity } from "./types";

export class CompilerException extends Error {
  readonly code: string;
  readonly severity: CompilerDiagnosticSeverity;
  readonly category: CompilerDiagnosticCategory;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    message: string,
    category: CompilerDiagnosticCategory = "system",
    severity: CompilerDiagnosticSeverity = "error",
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CompilerException";
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.details = details;
  }
}