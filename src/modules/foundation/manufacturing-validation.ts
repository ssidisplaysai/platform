import type {
  ManufacturingFoundationRecord,
  ManufacturingValidationResult,
  NewManufacturingComponentInput,
  UpdateManufacturingComponentInput,
} from "./manufacturing-types";

function hasSecretKeyword(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey")
  );
}

function isValidContractVersion(value: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(value);
}

function hasMinimumLength(value: string, minimum: number): boolean {
  return value.trim().length >= minimum;
}

export function validateNewManufacturingComponentInput(
  input: NewManufacturingComponentInput,
): ManufacturingValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (!hasMinimumLength(input.organizationId, 3)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }

  if (!hasMinimumLength(input.componentKey, 3)) {
    issues.push({ field: "componentKey", message: "Component key is required." });
  }

  if (!hasMinimumLength(input.displayName, 3)) {
    issues.push({ field: "displayName", message: "Display name is required." });
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

export function validateUpdateManufacturingComponentInput(
  existing: ManufacturingFoundationRecord,
  patch: UpdateManufacturingComponentInput,
): ManufacturingValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (existing.status === "retired") {
    issues.push({ field: "status", message: "Retired components cannot be updated." });
  }

  if (patch.displayName !== undefined && !hasMinimumLength(patch.displayName, 3)) {
    issues.push({ field: "displayName", message: "Display name must be at least 3 characters." });
  }

  if (patch.siteReference !== undefined && patch.siteReference !== null && patch.siteReference.trim().length === 0) {
    issues.push({ field: "siteReference", message: "Site reference cannot be empty when provided." });
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

export function validateManufacturingContractVersion(version: string): ManufacturingValidationResult {
  if (isValidContractVersion(version)) {
    return { valid: true, issues: [] };
  }

  return {
    valid: false,
    issues: [{ field: "version", message: "Contract versions must use v<major>.<minor>.<patch> format." }],
  };
}
