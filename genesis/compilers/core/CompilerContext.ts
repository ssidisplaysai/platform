export interface CompilerLogger {
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface CompilerContext {
  readonly runId: string;
  readonly artifactRoot: string;
  readonly deterministic: boolean;
  readonly logger: CompilerLogger;
}
