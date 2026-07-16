import type { RuntimeObjectDiagnostic, RuntimeObjectLogLevel } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeObjectDiagnostics {
  private sequence = 1;
  private readonly entries: RuntimeObjectDiagnostic[] = [];

  log(
    runtimeInstanceId: string,
    level: RuntimeObjectLogLevel,
    code: string,
    message: string,
    objectId?: string,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.entries.push(deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      objectId,
      level,
      code,
      message,
      details,
    }));
  }

  all(): readonly RuntimeObjectDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}
