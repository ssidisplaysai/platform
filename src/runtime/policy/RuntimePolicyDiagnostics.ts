import type { RuntimePolicyDiagnostic, RuntimePolicyLogLevel } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyDiagnostics {
  private sequence = 1;
  private readonly entries: RuntimePolicyDiagnostic[] = [];

  log(
    level: RuntimePolicyLogLevel,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): RuntimePolicyDiagnostic {
    const entry = deepFreeze({
      sequence: this.sequence++,
      level,
      code,
      message,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimePolicyDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}
