import type { RuntimeMessagingDiagnostic, RuntimeMessagingLogLevel } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeDiagnostics {
  private sequence = 1;
  private readonly entries: RuntimeMessagingDiagnostic[] = [];

  log(
    runtimeInstanceId: string,
    level: RuntimeMessagingLogLevel,
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    messageId?: string,
    subscriptionId?: string,
  ): RuntimeMessagingDiagnostic {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      level,
      code,
      message,
      details,
      messageId,
      subscriptionId,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeMessagingDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}
