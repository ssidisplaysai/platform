import type { InventoryFailureClassification } from "../contracts";

export class InventoryDomainError extends Error {
  constructor(
    public readonly classification: InventoryFailureClassification,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "InventoryDomainError";
  }
}

export function createInvariantViolation(message: string): InventoryDomainError {
  return new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", message, false);
}
