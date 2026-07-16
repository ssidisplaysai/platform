import type { RuntimeExecutionSlot, RuntimeExecutionWindowPolicy, RuntimeExpirationPolicy } from "./types";

export class RuntimeExecutionWindow {
  canExecute(sequence: number, policy: RuntimeExecutionWindowPolicy): boolean {
    return policy.allowedSequences.includes(sequence) || policy.graceSequences.includes(sequence);
  }

  isExpired(sequence: number, slot: RuntimeExecutionSlot, expirationPolicy: RuntimeExpirationPolicy): boolean {
    if (expirationPolicy.expiresAfterSequence !== undefined && sequence > expirationPolicy.expiresAfterSequence) {
      return true;
    }
    if (expirationPolicy.expiresAtSlot && slot.slotId.localeCompare(expirationPolicy.expiresAtSlot) > 0) {
      return true;
    }
    return false;
  }
}