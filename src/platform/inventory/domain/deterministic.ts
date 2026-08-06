import { compareDeterministicStrings, deterministicSort, deterministicUnique } from "../../shared/utilities";

export function compareInventoryKeys(left: string, right: string): number {
  return compareDeterministicStrings(left, right);
}

export function sortInventoryRecords<TRecord>(
  records: readonly TRecord[],
  keySelector: (record: TRecord) => string,
): TRecord[] {
  return deterministicSort(records, keySelector);
}

export function uniqueInventoryKeys(keys: readonly string[]): string[] {
  return deterministicUnique(keys);
}
