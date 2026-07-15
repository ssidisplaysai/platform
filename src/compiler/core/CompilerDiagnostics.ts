import type {
  CompilerDiagnostic,
  CompilerDiagnosticCategory,
  CompilerDiagnosticSeverity,
  CompilerSuggestedFix,
} from "./types";

function compareDiagnostics(left: CompilerDiagnostic, right: CompilerDiagnostic): number {
  return [
    left.severity.localeCompare(right.severity),
    left.code.localeCompare(right.code),
    (left.passId ?? "").localeCompare(right.passId ?? ""),
    (left.artifactId ?? "").localeCompare(right.artifactId ?? ""),
    left.message.localeCompare(right.message),
  ].find((value) => value !== 0) ?? 0;
}

export class CompilerDiagnostics {
  private diagnostics: CompilerDiagnostic[] = [];

  report(
    severity: CompilerDiagnosticSeverity,
    code: string,
    message: string,
    options: {
      readonly category?: CompilerDiagnosticCategory;
      readonly details?: Readonly<Record<string, unknown>>;
      readonly passId?: string;
      readonly artifactId?: string;
      readonly suggestedFixes?: readonly CompilerSuggestedFix[];
      readonly timestamp?: string;
    } = {},
  ): CompilerDiagnostic {
    const diagnostic: CompilerDiagnostic = Object.freeze({
      severity,
      code,
      message,
      category: options.category,
      details: options.details,
      passId: options.passId,
      artifactId: options.artifactId,
      suggestedFixes: options.suggestedFixes,
      timestamp: options.timestamp,
    });

    this.diagnostics = [...this.diagnostics, diagnostic].sort(compareDiagnostics);
    return diagnostic;
  }

  add(diagnostics: readonly CompilerDiagnostic[]): void {
    this.diagnostics = [...this.diagnostics, ...diagnostics].sort(compareDiagnostics);
  }

  architectureObservation(message: string, details?: Readonly<Record<string, unknown>>): CompilerDiagnostic {
    return this.report("info", "ARCHITECTURE_OBSERVATION", message, {
      category: "system",
      details,
    });
  }

  list(): readonly CompilerDiagnostic[] {
    return [...this.diagnostics];
  }

  listBySeverity(severity: CompilerDiagnosticSeverity): readonly CompilerDiagnostic[] {
    return this.diagnostics.filter((diagnostic) => diagnostic.severity === severity);
  }

  hasErrors(): boolean {
    return this.diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal");
  }

  clear(): void {
    this.diagnostics = [];
  }
}