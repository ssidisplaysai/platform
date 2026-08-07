import type { RuntimeSnapshot } from "../../shared";

export type ManufacturingRuntimeErrorCode =
  | "INVALID_RUNTIME_OPTIONS"
  | "INVALID_RUNTIME_STATE"
  | "DUPLICATE_INITIALIZATION"
  | "MISSING_REQUIRED_PROVIDER"
  | "DUPLICATE_PROVIDER"
  | "DUPLICATE_SERVICE_REGISTRATION"
  | "DUPLICATE_INTEGRATION_REGISTRATION"
  | "MISSING_REQUIRED_INTEGRATION"
  | "LIFECYCLE_START_FAILURE"
  | "LIFECYCLE_STOP_FAILURE"
  | "PARTIAL_INITIALIZATION_REJECTED"
  | "RUNTIME_NOT_READY"
  | "INTEGRATION_REGISTRATION_FAILURE";

export class ManufacturingRuntimeError<TState = unknown> extends Error {
  constructor(
    public readonly code: ManufacturingRuntimeErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly snapshot?: RuntimeSnapshot<TState>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ManufacturingRuntimeError";
  }
}
