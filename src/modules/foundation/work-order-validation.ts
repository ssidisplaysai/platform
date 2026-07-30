import type {
  NewWorkOrderInput,
  UpdateWorkOrderDraftInput,
  WorkOrderRecord,
  WorkOrderValidationResult,
} from "./work-order-types";

function hasSecretKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey")
  );
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function validateNewWorkOrderInput(input: NewWorkOrderInput): WorkOrderValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (!input.organizationId) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }

  if (!input.customerReference) {
    issues.push({ field: "customerReference", message: "Customer reference is required." });
  }

  if (!input.ownerReference) {
    issues.push({ field: "ownerReference", message: "Owner reference is required." });
  }

  if (input.requestedStartDate && !isIsoDate(input.requestedStartDate)) {
    issues.push({ field: "requestedStartDate", message: "Requested start date must be valid ISO date." });
  }

  if (input.requestedCompletionDate && !isIsoDate(input.requestedCompletionDate)) {
    issues.push({
      field: "requestedCompletionDate",
      message: "Requested completion date must be valid ISO date.",
    });
  }

  if (!input.commercialLineage.originSalesOrderId) {
    issues.push({ field: "commercialLineage.originSalesOrderId", message: "Origin sales order id is required." });
  }

  if (!input.commercialLineage.originQuoteId) {
    issues.push({ field: "commercialLineage.originQuoteId", message: "Origin quote id is required." });
  }

  if (!Number.isInteger(input.commercialLineage.originSalesOrderRevision) || input.commercialLineage.originSalesOrderRevision < 1) {
    issues.push({
      field: "commercialLineage.originSalesOrderRevision",
      message: "Origin sales order revision must be a positive integer.",
    });
  }

  if (!Number.isInteger(input.commercialLineage.originQuoteRevision) || input.commercialLineage.originQuoteRevision < 1) {
    issues.push({
      field: "commercialLineage.originQuoteRevision",
      message: "Origin quote revision must be a positive integer.",
    });
  }

  if (!isIsoDate(input.commercialLineage.createdTimestamp)) {
    issues.push({
      field: "commercialLineage.createdTimestamp",
      message: "Created timestamp must be a valid ISO date.",
    });
  }

  if (!input.commercialLineage.manufacturingVersion) {
    issues.push({
      field: "commercialLineage.manufacturingVersion",
      message: "Manufacturing version is required.",
    });
  }

  if (input.lines.length === 0) {
    issues.push({ field: "lines", message: "At least one work order line is required." });
  }

  input.lines.forEach((line, index) => {
    if (!line.productId) {
      issues.push({ field: `lines[${index}].productId`, message: "Product id is required." });
    }
    if (!line.sku) {
      issues.push({ field: `lines[${index}].sku`, message: "SKU is required." });
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      issues.push({ field: `lines[${index}].quantity`, message: "Quantity must be greater than zero." });
    }
  });

  if (hasSecretKeyword(JSON.stringify(input))) {
    issues.push({ field: "input", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateWorkOrderDraftInput(
  existing: WorkOrderRecord,
  patch: UpdateWorkOrderDraftInput,
): WorkOrderValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (existing.status !== "draft" && existing.status !== "planned") {
    issues.push({ field: "status", message: "Only draft or planned work orders are editable." });
  }

  if (patch.ownerReference !== undefined && patch.ownerReference.trim().length === 0) {
    issues.push({ field: "ownerReference", message: "Owner reference cannot be empty." });
  }

  if (patch.requestedStartDate !== undefined && patch.requestedStartDate !== null && !isIsoDate(patch.requestedStartDate)) {
    issues.push({ field: "requestedStartDate", message: "Requested start date must be valid ISO date." });
  }

  if (
    patch.requestedCompletionDate !== undefined &&
    patch.requestedCompletionDate !== null &&
    !isIsoDate(patch.requestedCompletionDate)
  ) {
    issues.push({
      field: "requestedCompletionDate",
      message: "Requested completion date must be valid ISO date.",
    });
  }

  if (hasSecretKeyword(JSON.stringify(patch))) {
    issues.push({ field: "patch", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
