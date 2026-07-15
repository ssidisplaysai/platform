export interface CompilerLogEntry {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class CompilerLogger {
  private readonly entries: CompilerLogEntry[] = [];

  debug(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.entries.push({ level: "debug", message, details });
  }

  info(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.entries.push({ level: "info", message, details });
  }

  warn(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.entries.push({ level: "warn", message, details });
  }

  error(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.entries.push({ level: "error", message, details });
  }

  snapshot(): readonly CompilerLogEntry[] {
    return [...this.entries];
  }
}