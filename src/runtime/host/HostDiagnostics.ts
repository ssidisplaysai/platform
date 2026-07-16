import type { HostLogLevel } from "./types";

export class HostDiagnostics {
  private readonly entries: Array<{ level: HostLogLevel; message: string; details?: Readonly<Record<string, unknown>> }> = [];

  log(level: HostLogLevel, message: string, details?: Readonly<Record<string, unknown>>): void {
    this.entries.push({
      level,
      message,
      details,
    });
  }

  all(): readonly { level: HostLogLevel; message: string; details?: Readonly<Record<string, unknown>> }[] {
    return Object.freeze([...this.entries]);
  }
}
