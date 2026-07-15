import { CompilerDiagnostics } from "./CompilerDiagnostics";
import type { CompilerDiagnostic, CompilerDiagnosticSeverity } from "./types";

export class CompilerDiagnosticsEngine extends CompilerDiagnostics {
  report(
    severity: CompilerDiagnosticSeverity,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    passId?: string,
    artifactId?: string,
  ): CompilerDiagnostic {
    return super.report(severity, code, message, { details, passId, artifactId });
  }
}
