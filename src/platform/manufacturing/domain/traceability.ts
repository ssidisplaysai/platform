import { compareDeterministicStrings } from "../../shared/utilities";
import type { ProductionTraceRecord } from "../contracts";
import { ManufacturingDomainError } from "./errors";

function traceOrderingKey(trace: ProductionTraceRecord): string {
  return `${trace.occurredAt}|${trace.productionTraceId}`;
}

export function compareTraceRecords(left: ProductionTraceRecord, right: ProductionTraceRecord): number {
  return compareDeterministicStrings(traceOrderingKey(left), traceOrderingKey(right));
}

export function deterministicTraceOrdering(records: readonly ProductionTraceRecord[]): ProductionTraceRecord[] {
  return [...records].sort(compareTraceRecords);
}

export function assertUniqueTraceIdentities(records: readonly ProductionTraceRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.productionTraceId)) {
      throw new ManufacturingDomainError("TRACEABILITY_VIOLATION", "duplicate trace identity detected", false);
    }
    seen.add(record.productionTraceId);
  }
}

export function assertAppendOnlyTraceHistory(
  previous: readonly ProductionTraceRecord[],
  current: readonly ProductionTraceRecord[],
): void {
  if (current.length < previous.length) {
    throw new ManufacturingDomainError("TRACEABILITY_VIOLATION", "trace history cannot shrink", false);
  }

  for (let index = 0; index < previous.length; index += 1) {
    const previousRecord = previous[index];
    const currentRecord = current[index];
    if (!currentRecord || previousRecord.productionTraceId !== currentRecord.productionTraceId) {
      throw new ManufacturingDomainError("TRACEABILITY_VIOLATION", "trace history cannot be rewritten", false);
    }
  }

  assertUniqueTraceIdentities(current);
}
