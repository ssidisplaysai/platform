import { randomUUID } from "node:crypto";

export type RecoveryTraceLogEntry = Record<string, unknown>;

export function createRecoveryTraceId(): string {
  return `recovery_trace_${randomUUID()}`;
}

export function logRecoveryTrace(
  traceId: string,
  boundary: string,
  dryRunValue: unknown,
  extra: RecoveryTraceLogEntry = {},
): void {
  const payload = {
    event: "GOP_RECOVERY_TRACE",
    traceId,
    boundary,
    dryRunValue,
    dryRunType: dryRunValue === undefined ? "undefined" : typeof dryRunValue,
    ...extra,
  };

  console.info(JSON.stringify(payload));
}
