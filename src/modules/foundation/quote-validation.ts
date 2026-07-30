import type {
  NewQuoteInput,
  NewQuoteLineInput,
  QuoteRecord,
  QuoteValidationResult,
  UpdateQuoteDraftInput,
  UpdateQuoteLineInput,
} from "./quote-types";

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

function validatePositiveMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateNewQuoteInput(input: NewQuoteInput): QuoteValidationResult {
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
  if (!isIsoDate(input.effectiveDate)) {
    issues.push({ field: "effectiveDate", message: "Effective date must be a valid ISO date." });
  }
  if (!isIsoDate(input.expirationDate)) {
    issues.push({ field: "expirationDate", message: "Expiration date must be a valid ISO date." });
  }
  if (isIsoDate(input.effectiveDate) && isIsoDate(input.expirationDate) && input.expirationDate < input.effectiveDate) {
    issues.push({ field: "expirationDate", message: "Expiration date cannot be before effective date." });
  }

  if (!validatePositiveMoney(input.commercialTerms.exchangeRate)) {
    issues.push({ field: "commercialTerms.exchangeRate", message: "Exchange rate must be non-negative." });
  }

  const payloadText = JSON.stringify(input);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "input", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateQuoteDraftInput(
  existing: QuoteRecord,
  patch: UpdateQuoteDraftInput,
): QuoteValidationResult {
  const issues: { field: string; message: string }[] = [];

  if (patch.currency !== undefined && patch.currency.length < 3) {
    issues.push({ field: "currency", message: "Currency code must be at least 3 characters." });
  }

  const effectiveDate = patch.effectiveDate ?? existing.effectiveDate;
  const expirationDate = patch.expirationDate ?? existing.expirationDate;

  if (patch.effectiveDate !== undefined && !isIsoDate(patch.effectiveDate)) {
    issues.push({ field: "effectiveDate", message: "Effective date must be a valid ISO date." });
  }

  if (patch.expirationDate !== undefined && !isIsoDate(patch.expirationDate)) {
    issues.push({ field: "expirationDate", message: "Expiration date must be a valid ISO date." });
  }

  if (isIsoDate(effectiveDate) && isIsoDate(expirationDate) && expirationDate < effectiveDate) {
    issues.push({ field: "expirationDate", message: "Expiration date cannot be before effective date." });
  }

  if (
    patch.commercialTerms?.exchangeRate !== undefined &&
    !validatePositiveMoney(patch.commercialTerms.exchangeRate)
  ) {
    issues.push({ field: "commercialTerms.exchangeRate", message: "Exchange rate must be non-negative." });
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

export function validateNewQuoteLineInput(input: NewQuoteLineInput): QuoteValidationResult {
  const issues: { field: string; message: string }[] = [];

  if (!input.productId) {
    issues.push({ field: "productId", message: "Product reference is required." });
  }
  if (!input.sku) {
    issues.push({ field: "sku", message: "SKU is required." });
  }
  if (!input.displayName) {
    issues.push({ field: "displayName", message: "Display name is required." });
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    issues.push({ field: "quantity", message: "Quantity must be greater than zero." });
  }
  if (!validatePositiveMoney(input.unitPrice)) {
    issues.push({ field: "unitPrice", message: "Unit price must be non-negative." });
  }
  if (!validatePositiveMoney(input.discount)) {
    issues.push({ field: "discount", message: "Discount must be non-negative." });
  }
  if (input.discount > input.quantity * input.unitPrice) {
    issues.push({ field: "discount", message: "Discount cannot exceed line value." });
  }

  const payloadText = JSON.stringify(input);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "input", message: "Raw secret-like values are not allowed." });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateQuoteLineInput(
  existing: {
    quantity: number;
    unitPrice: number;
    discount: number;
  },
  patch: UpdateQuoteLineInput,
): QuoteValidationResult {
  const issues: { field: string; message: string }[] = [];

  const quantity = patch.quantity ?? existing.quantity;
  const unitPrice = patch.unitPrice ?? existing.unitPrice;
  const discount = patch.discount ?? existing.discount;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    issues.push({ field: "quantity", message: "Quantity must be greater than zero." });
  }
  if (!validatePositiveMoney(unitPrice)) {
    issues.push({ field: "unitPrice", message: "Unit price must be non-negative." });
  }
  if (!validatePositiveMoney(discount)) {
    issues.push({ field: "discount", message: "Discount must be non-negative." });
  }
  if (discount > quantity * unitPrice) {
    issues.push({ field: "discount", message: "Discount cannot exceed line value." });
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
