import type { ManufacturingFailureClassification } from "../contracts";

export class ManufacturingDomainError extends Error {
  constructor(
    public readonly classification: ManufacturingFailureClassification,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ManufacturingDomainError";
  }
}
