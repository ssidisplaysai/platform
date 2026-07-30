import type {
  InventoryLocationConfiguration,
  InventoryMovementType,
  InventoryValidationIssue,
  InventoryValidationResult,
  NewInventoryMovementInput,
  NewInventoryReservationInput,
} from "./types";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function containsSecretKeyword(input: string): boolean {
  const normalized = input.toLowerCase();
  return normalized.includes("password") || normalized.includes("secret") || normalized.includes("apiKey");
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function validateInventoryLocationHierarchy(
  locations: readonly InventoryLocationConfiguration[],
): InventoryValidationResult {
  const issues: InventoryValidationIssue[] = [];
  const byId = new Map(locations.map((location) => [location.locationId, location]));

  locations.forEach((location) => {
    if (location.parentLocationId && !byId.has(location.parentLocationId)) {
      issues.push({
        field: `locations.${location.locationId}.parentLocationId`,
        message: "Parent location does not exist.",
      });
    }
  });

  locations.forEach((location) => {
    const seen = new Set<string>();
    let pointer = location.parentLocationId;

    while (pointer) {
      if (pointer === location.locationId || seen.has(pointer)) {
        issues.push({
          field: `locations.${location.locationId}.parentLocationId`,
          message: "Location parent cycle detected.",
        });
        break;
      }

      seen.add(pointer);
      pointer = byId.get(pointer)?.parentLocationId ?? null;
    }
  });

  return { valid: issues.length === 0, issues };
}

export function validateMovementInput(input: NewInventoryMovementInput): InventoryValidationResult {
  const issues: InventoryValidationIssue[] = [];

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (isBlank(input.productId)) {
    issues.push({ field: "productId", message: "Product is required." });
  }
  if (!isPositiveInteger(input.quantity)) {
    issues.push({ field: "quantity", message: "Quantity must be a positive integer." });
  }
  if (isBlank(input.reasonCode)) {
    issues.push({ field: "reasonCode", message: "Reason code is required." });
  }
  if (isBlank(input.actorReference)) {
    issues.push({ field: "actorReference", message: "Actor reference is required." });
  }

  const sourceRequired: readonly InventoryMovementType[] = [
    "issue",
    "transfer",
    "adjustment_decrease",
    "reservation",
    "reservation_release",
    "allocation",
    "allocation_release",
    "damage",
    "inspection_hold",
    "inspection_release",
    "shipment",
    "count_correction",
  ];

  const destinationRequired: readonly InventoryMovementType[] = [
    "receipt",
    "transfer",
    "adjustment_increase",
    "return",
  ];

  if (sourceRequired.includes(input.movementType) && !input.sourceLocationId) {
    issues.push({
      field: "sourceLocationId",
      message: `Source location is required for movement type ${input.movementType}.`,
    });
  }

  if (destinationRequired.includes(input.movementType) && !input.destinationLocationId) {
    issues.push({
      field: "destinationLocationId",
      message: `Destination location is required for movement type ${input.movementType}.`,
    });
  }

  if (
    input.movementType === "transfer" &&
    input.sourceLocationId &&
    input.destinationLocationId &&
    input.sourceLocationId === input.destinationLocationId
  ) {
    issues.push({
      field: "destinationLocationId",
      message: "Transfer source and destination must differ.",
    });
  }

  if (containsSecretKeyword(JSON.stringify(input))) {
    issues.push({ field: "input", message: "Raw secret-like fields are not allowed." });
  }

  return { valid: issues.length === 0, issues };
}

export function validateReservationInput(input: NewInventoryReservationInput): InventoryValidationResult {
  const issues: InventoryValidationIssue[] = [];

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (isBlank(input.productId)) {
    issues.push({ field: "productId", message: "Product is required." });
  }
  if (isBlank(input.locationId)) {
    issues.push({ field: "locationId", message: "Location is required." });
  }
  if (!isPositiveInteger(input.quantity)) {
    issues.push({ field: "quantity", message: "Quantity must be a positive integer." });
  }
  if (isBlank(input.requestedBy)) {
    issues.push({ field: "requestedBy", message: "Requested by is required." });
  }

  if (containsSecretKeyword(JSON.stringify(input))) {
    issues.push({ field: "input", message: "Raw secret-like fields are not allowed." });
  }

  return { valid: issues.length === 0, issues };
}

export function validateNonNegativeQuantities(input: {
  onHandQuantity: number;
  reservedQuantity: number;
  incomingQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
  inspectionHoldQuantity: number;
  backorderedQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
}): InventoryValidationResult {
  const issues: InventoryValidationIssue[] = [];

  const entries = Object.entries(input) as Array<[string, number]>;
  entries.forEach(([field, value]) => {
    if (!Number.isFinite(value) || Number.isNaN(value) || !Number.isInteger(value)) {
      issues.push({ field, message: `${field} must be a finite integer.` });
      return;
    }

    if (value < 0) {
      issues.push({ field, message: `${field} cannot be negative.` });
    }
  });

  return { valid: issues.length === 0, issues };
}
