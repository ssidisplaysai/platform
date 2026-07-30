import type {
  CreateSalesOrderInput,
  SalesOrderRecord,
  SalesOrderValidationResult,
  UpdateSalesOrderDraftInput,
} from "./sales-order-types";

function hasSecretKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey")
  );
}

function isIsoDate(input: string): boolean {
  return !Number.isNaN(Date.parse(input));
}

function validateNonNegativeMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validateTotals(input: CreateSalesOrderInput): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];

  if (!validateNonNegativeMoney(input.totals.subtotal)) {
    issues.push({ field: "totals.subtotal", message: "Subtotal must be non-negative." });
  }
  if (!validateNonNegativeMoney(input.totals.discountTotal)) {
    issues.push({ field: "totals.discountTotal", message: "Discount total must be non-negative." });
  }
  if (!validateNonNegativeMoney(input.totals.taxPlaceholder)) {
    issues.push({ field: "totals.taxPlaceholder", message: "Tax placeholder must be non-negative." });
  }
  if (!validateNonNegativeMoney(input.totals.freightPlaceholder)) {
    issues.push({ field: "totals.freightPlaceholder", message: "Freight placeholder must be non-negative." });
  }
  if (!validateNonNegativeMoney(input.totals.fees)) {
    issues.push({ field: "totals.fees", message: "Fees must be non-negative." });
  }
  if (!validateNonNegativeMoney(input.totals.grandTotal)) {
    issues.push({ field: "totals.grandTotal", message: "Grand total must be non-negative." });
  }

  return issues;
}

export function validateCreateSalesOrderInput(input: CreateSalesOrderInput): SalesOrderValidationResult {
  const issues: { field: string; message: string }[] = [];

  if (!input.organizationId) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (!input.customerReference) {
    issues.push({ field: "customerReference", message: "Customer reference is required." });
  }
  if (!input.ownerReference) {
    issues.push({ field: "ownerReference", message: "Owner reference is required." });
  }
  if (!input.currency || input.currency.length < 3) {
    issues.push({ field: "currency", message: "Currency code is required." });
  }
  if (!isIsoDate(input.orderDate)) {
    issues.push({ field: "orderDate", message: "Order date must be a valid ISO date." });
  }
  if (input.requestedDeliveryDate && !isIsoDate(input.requestedDeliveryDate)) {
    issues.push({ field: "requestedDeliveryDate", message: "Requested delivery date must be a valid ISO date." });
  }

  if (!input.quoteLineage.quoteId) {
    issues.push({ field: "quoteLineage.quoteId", message: "Originating quote id is required." });
  }
  if (!Number.isInteger(input.quoteLineage.quoteRevision) || input.quoteLineage.quoteRevision <= 0) {
    issues.push({ field: "quoteLineage.quoteRevision", message: "Quote revision must be a positive integer." });
  }
  if (!isIsoDate(input.quoteLineage.acceptanceTimestamp)) {
    issues.push({ field: "quoteLineage.acceptanceTimestamp", message: "Acceptance timestamp must be an ISO date." });
  }
  if (!input.quoteLineage.acceptedBy) {
    issues.push({ field: "quoteLineage.acceptedBy", message: "Accepted by is required." });
  }
  if (!input.quoteLineage.pricingSnapshotReference) {
    issues.push({ field: "quoteLineage.pricingSnapshotReference", message: "Pricing snapshot reference is required." });
  }
  if (!input.quoteLineage.conversionEventId) {
    issues.push({ field: "quoteLineage.conversionEventId", message: "Conversion event id is required." });
  }

  if (input.lines.length === 0) {
    issues.push({ field: "lines", message: "At least one order line is required." });
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
    if (!validateNonNegativeMoney(line.unitPrice)) {
      issues.push({ field: `lines[${index}].unitPrice`, message: "Unit price must be non-negative." });
    }
    if (!validateNonNegativeMoney(line.discount)) {
      issues.push({ field: `lines[${index}].discount`, message: "Discount must be non-negative." });
    }
    if (!validateNonNegativeMoney(line.extendedPrice)) {
      issues.push({ field: `lines[${index}].extendedPrice`, message: "Extended price must be non-negative." });
    }
  });

  issues.push(...validateTotals(input));

  const payloadText = JSON.stringify(input);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "input", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateSalesOrderDraftInput(
  existing: SalesOrderRecord,
  patch: UpdateSalesOrderDraftInput,
): SalesOrderValidationResult {
  const issues: { field: string; message: string }[] = [];

  if (patch.requestedDeliveryDate !== undefined && patch.requestedDeliveryDate !== null && !isIsoDate(patch.requestedDeliveryDate)) {
    issues.push({ field: "requestedDeliveryDate", message: "Requested delivery date must be a valid ISO date." });
  }

  if (patch.ownerReference !== undefined && patch.ownerReference.trim().length === 0) {
    issues.push({ field: "ownerReference", message: "Owner reference cannot be empty." });
  }

  if (patch.siteReference !== undefined && patch.siteReference !== null && patch.siteReference.trim().length === 0) {
    issues.push({ field: "siteReference", message: "Site reference cannot be empty when provided." });
  }

  if (existing.status !== "draft" && existing.status !== "pending_approval") {
    issues.push({ field: "status", message: "Order is not editable in current status." });
  }

  const payloadText = JSON.stringify(patch);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "patch", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
