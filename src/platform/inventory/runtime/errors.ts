import type { RuntimeSnapshot } from "../../shared";

export type InventoryRuntimeErrorCode =
  | "INVALID_OPTIONS"
  | "DUPLICATE_INITIALIZATION"
  | "MISSING_REQUIRED_PROVIDER"
  | "DUPLICATE_PROVIDER"
  | "DUPLICATE_SERVICE_REGISTRATION"
  | "LIFECYCLE_START_FAILURE"
  | "LIFECYCLE_STOP_FAILURE"
  | "INTEGRATION_REGISTRATION_FAILURE"
  | "PARTIAL_INITIALIZATION_REJECTION"
  | "INVALID_RUNTIME_STATE_TRANSITION";

export class InventoryRuntimeError<TState = unknown> extends Error {
  constructor(
    public readonly code: InventoryRuntimeErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly snapshot?: RuntimeSnapshot<TState>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "InventoryRuntimeError";
  }
}
