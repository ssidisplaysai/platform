import type { CompilerDiagnostic, CompilerDiagnosticSeverity } from "./types";

export class CompilerDiagnosticsEngine {
  private readonly diagnostics: CompilerDiagnostic[] = [];

  report(
    severity: CompilerDiagnosticSeverity,
    code: string,
    message: string,
    details?: Record<string, unknown>,
    passId?: string,
    artifactId?: string,
  ): void {
    this.diagnostics.push({
      severity,
      code,
      message,
      details,
      passId,
      artifactId,
    });
  }

  architectureObservation(message: string, details?: Record<string, unknown>): void {
    this.report("info", "ARCHITECTURE_OBSERVATION", message, details);
  }

  list(): CompilerDiagnostic[] {
    return [...this.diagnostics];
  }

  listBySeverity(severity: CompilerDiagnosticSeverity): CompilerDiagnostic[] {
    return this.diagnostics.filter((diagnostic) => diagnostic.severity === severity);
  }

  hasErrors(): boolean {
    return this.listBySeverity("error").length > 0;
  }
}
