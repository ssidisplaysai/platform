import { compareDeterministicStrings, deterministicSort } from "../../shared/utilities";
import type {
  BatchCode,
  IdempotencyCommandFamily,
  IdempotencyKey,
  IdempotencyRecord,
  MaterialRequirement,
  RoutingStep,
  RunCode,
  TenantId,
  WorkOrderNumber,
} from "../contracts";
import { ManufacturingDomainError } from "./errors";

export function compareWorkOrderNumbers(left: WorkOrderNumber, right: WorkOrderNumber): number {
  return compareDeterministicStrings(left, right);
}

export function compareRunCodes(left: RunCode, right: RunCode): number {
  return compareDeterministicStrings(left, right);
}

export function compareBatchCodes(left: BatchCode, right: BatchCode): number {
  return compareDeterministicStrings(left, right);
}

export function sortRoutingStepsDeterministically(steps: readonly RoutingStep[]): RoutingStep[] {
  return [...steps].sort((left, right) => {
    if (left.sequenceNumber !== right.sequenceNumber) {
      return left.sequenceNumber < right.sequenceNumber ? -1 : 1;
    }
    return compareDeterministicStrings(left.routingStepId, right.routingStepId);
  });
}

export function sortMaterialRequirementsDeterministically(
  requirements: readonly MaterialRequirement[],
): MaterialRequirement[] {
  return deterministicSort(requirements, (requirement) => requirement.materialRequirementId);
}

export type IdempotencyClassification = "ACCEPTED" | "REPLAY" | "CONFLICT";

export function classifyIdempotentReplay(existingFingerprint: string, candidateFingerprint: string): IdempotencyClassification {
  if (existingFingerprint === candidateFingerprint) {
    return "REPLAY";
  }
  return "CONFLICT";
}

export function createIdempotencyRecord(input: {
  tenantId: TenantId;
  commandFamily: IdempotencyCommandFamily;
  key: IdempotencyKey;
  payloadFingerprint: string;
  acceptedResultIdentity?: string;
  classification: IdempotencyClassification;
}): IdempotencyRecord {
  if (input.payloadFingerprint.trim().length === 0) {
    throw new ManufacturingDomainError("INVALID_COMMAND", "payload fingerprint is required", false);
  }
  return Object.freeze({
    tenantId: input.tenantId,
    commandFamily: input.commandFamily,
    key: input.key,
    payloadFingerprint: input.payloadFingerprint,
    acceptedResultIdentity: input.acceptedResultIdentity,
    classification: input.classification,
  });
}

export function assertMonotonicVersionProgression(current: number, next: number): void {
  if (!Number.isInteger(current) || !Number.isInteger(next) || next <= current) {
    throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "version progression must be monotonic", false);
  }
}
