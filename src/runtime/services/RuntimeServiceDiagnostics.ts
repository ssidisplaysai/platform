import type { RuntimeServiceDiagnostic, RuntimeServiceLogLevel } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeServiceDiagnostics {
  private readonly entries: RuntimeServiceDiagnostic[] = [];
  private sequence = 1;

  log(
    level: RuntimeServiceLogLevel,
    code: string,
    message: string,
    runtimeInstanceId: string,
    serviceId?: string,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.entries.push(deepFreeze({
      sequence: this.sequence++,
      level,
      code,
      message,
      runtimeInstanceId,
      serviceId,
      details,
    }));
  }

  all(): readonly RuntimeServiceDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}
