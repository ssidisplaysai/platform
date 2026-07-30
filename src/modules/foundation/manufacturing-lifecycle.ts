import type { ManufacturingFoundationStatus } from "./manufacturing-types";

const ALLOWED_TRANSITIONS: Readonly<Record<ManufacturingFoundationStatus, readonly ManufacturingFoundationStatus[]>> = {
  draft: ["active", "retired"],
  active: ["suspended", "retired"],
  suspended: ["active", "retired"],
  retired: [],
};

export function canTransitionManufacturingStatus(
  from: ManufacturingFoundationStatus,
  to: ManufacturingFoundationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function validateManufacturingLifecycleTransition(input: {
  from: ManufacturingFoundationStatus;
  to: ManufacturingFoundationStatus;
}): { valid: boolean; message: string | null } {
  if (input.from === input.to) {
    return { valid: true, message: null };
  }

  if (canTransitionManufacturingStatus(input.from, input.to)) {
    return { valid: true, message: null };
  }

  return {
    valid: false,
    message: `Invalid lifecycle transition from ${input.from} to ${input.to}.`,
  };
}
