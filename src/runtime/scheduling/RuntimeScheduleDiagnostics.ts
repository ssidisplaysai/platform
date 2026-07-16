import type { RuntimeSchedulingDiagnostic, RuntimeSchedulingLogLevel } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeScheduleDiagnostics {
  private sequence = 1;
  private readonly entries: RuntimeSchedulingDiagnostic[] = [];

  log(
    runtimeInstanceId: string,
    level: RuntimeSchedulingLogLevel,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    scheduleId?: string,
    planId?: string,
  ): RuntimeSchedulingDiagnostic {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      level,
      code,
      message,
      details,
      scheduleId,
      planId,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeSchedulingDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}