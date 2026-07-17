export type DiagnosticSeverity = "info" | "warning" | "error";

export interface CompilerDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
}

export interface CompilerArtifact {
  readonly type: string;
  readonly path: string;
  readonly sha256?: string;
}

export interface CompilerResult<TOutput> {
  readonly success: boolean;
  readonly output: TOutput;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly artifacts: readonly CompilerArtifact[];
}
