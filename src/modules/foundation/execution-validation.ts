import type { ExecutionValidationResult, NewExecutionInput, UpdateExecutionDraftInput } from "./execution-types";

function isIsoDate(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isSecretLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /api[-_]?key|secret|token|password/i.test(value);
}

function validateStringCollection(values: readonly string[] | undefined, field: string, issues: Array<{ field: string; message: string }>): void {
  if (!values) {
    return;
  }

  values.forEach((value, index) => {
    if (!value || value.trim().length === 0) {
      issues.push({ field: `${field}[${index}]`, message: "Value is required." });
    }
  });
}

export function validateNewExecutionInput(input: NewExecutionInput): ExecutionValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (!input.organizationId.trim()) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (!input.customerReference.trim()) {
    issues.push({ field: "customerReference", message: "Customer reference is required." });
  }
  if (!input.ownerReference.trim()) {
    issues.push({ field: "ownerReference", message: "Owner reference is required." });
  }
  if (!input.executionName.trim()) {
    issues.push({ field: "executionName", message: "Execution name is required." });
  }

  if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100) {
    issues.push({ field: "progress", message: "Progress must be between 0 and 100." });
  }

  if (input.actualStart && !isIsoDate(input.actualStart)) {
    issues.push({ field: "actualStart", message: "Actual start must be a valid ISO date." });
  }
  if (input.actualFinish && !isIsoDate(input.actualFinish)) {
    issues.push({ field: "actualFinish", message: "Actual finish must be a valid ISO date." });
  }
  if (input.actualStart && input.actualFinish && Date.parse(input.actualFinish) < Date.parse(input.actualStart)) {
    issues.push({ field: "actualFinish", message: "Actual finish must not be earlier than actual start." });
  }

  if (input.elapsedDurationMinutes !== null && input.elapsedDurationMinutes < 0) {
    issues.push({ field: "elapsedDurationMinutes", message: "Elapsed duration cannot be negative." });
  }

  if (input.estimatedDurationMinutes !== null && input.estimatedDurationMinutes <= 0) {
    issues.push({ field: "estimatedDurationMinutes", message: "Estimated duration must be positive when provided." });
  }

  if (!input.lineage.organizationId.trim()) {
    issues.push({ field: "lineage.organizationId", message: "Organization lineage is required." });
  }
  if (!input.lineage.createdBy.trim()) {
    issues.push({ field: "lineage.createdBy", message: "Created by is required." });
  }
  if (!isIsoDate(input.lineage.createdTimestamp)) {
    issues.push({ field: "lineage.createdTimestamp", message: "Created timestamp must be a valid ISO date." });
  }

  if (
    !input.lineage.scheduleId &&
    !input.lineage.productionJobId &&
    !input.lineage.operationId &&
    !input.lineage.workOrderId
  ) {
    issues.push({
      field: "lineage",
      message: "An execution session must reference at least one planning aggregate.",
    });
  }

  if (isSecretLike(input.executionName) || isSecretLike(input.notes)) {
    issues.push({ field: "content", message: "Secret-like content is not allowed in execution fields." });
  }

  validateStringCollection(input.attachments, "attachments", issues);
  validateStringCollection(input.operatorReferences, "operatorReferences", issues);
  validateStringCollection(input.machineReferences, "machineReferences", issues);
  validateStringCollection(input.telemetryReferences, "telemetryReferences", issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateExecutionDraftInput(patch: UpdateExecutionDraftInput): ExecutionValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (patch.executionName !== undefined && !patch.executionName.trim()) {
    issues.push({ field: "executionName", message: "Execution name is required." });
  }

  if (patch.progress !== undefined && (!Number.isFinite(patch.progress) || patch.progress < 0 || patch.progress > 100)) {
    issues.push({ field: "progress", message: "Progress must be between 0 and 100." });
  }

  if (patch.actualStart !== undefined && patch.actualStart !== null && !isIsoDate(patch.actualStart)) {
    issues.push({ field: "actualStart", message: "Actual start must be a valid ISO date." });
  }

  if (patch.actualFinish !== undefined && patch.actualFinish !== null && !isIsoDate(patch.actualFinish)) {
    issues.push({ field: "actualFinish", message: "Actual finish must be a valid ISO date." });
  }

  if (
    patch.actualStart !== undefined &&
    patch.actualFinish !== undefined &&
    patch.actualStart !== null &&
    patch.actualFinish !== null &&
    Date.parse(patch.actualFinish) < Date.parse(patch.actualStart)
  ) {
    issues.push({ field: "actualFinish", message: "Actual finish must not be earlier than actual start." });
  }

  if (patch.elapsedDurationMinutes !== undefined && patch.elapsedDurationMinutes !== null && patch.elapsedDurationMinutes < 0) {
    issues.push({ field: "elapsedDurationMinutes", message: "Elapsed duration cannot be negative." });
  }

  if (patch.estimatedDurationMinutes !== undefined && patch.estimatedDurationMinutes !== null && patch.estimatedDurationMinutes <= 0) {
    issues.push({ field: "estimatedDurationMinutes", message: "Estimated duration must be positive when provided." });
  }

  if (patch.metadata !== undefined) {
    Object.entries(patch.metadata).forEach(([key, value]) => {
      if (!key.trim()) {
        issues.push({ field: "metadata", message: "Metadata keys must not be empty." });
      }
      if (isSecretLike(value)) {
        issues.push({ field: `metadata.${key}`, message: "Secret-like content is not allowed in metadata." });
      }
    });
  }

  validateStringCollection(patch.attachments, "attachments", issues);
  validateStringCollection(patch.operatorReferences, "operatorReferences", issues);
  validateStringCollection(patch.machineReferences, "machineReferences", issues);
  validateStringCollection(patch.telemetryReferences, "telemetryReferences", issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}
