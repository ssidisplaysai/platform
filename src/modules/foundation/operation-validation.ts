import type { NewOperationInput, OperationValidationResult, UpdateOperationDraftInput } from "./operation-types";

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

export function validateNewOperationInput(input: NewOperationInput): OperationValidationResult {
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

  if (!input.lineage.productionJobId.trim()) {
    issues.push({ field: "lineage.productionJobId", message: "Production job id is required." });
  }

  if (!Number.isInteger(input.sequenceNumber) || input.sequenceNumber <= 0) {
    issues.push({ field: "sequenceNumber", message: "Sequence number must be a positive integer." });
  }

  if (!input.operationType.trim()) {
    issues.push({ field: "operationType", message: "Operation type is required." });
  }

  if (!input.operationName.trim()) {
    issues.push({ field: "operationName", message: "Operation name is required." });
  }

  if (input.estimatedDurationMinutes !== null && (!Number.isFinite(input.estimatedDurationMinutes) || input.estimatedDurationMinutes <= 0)) {
    issues.push({ field: "estimatedDurationMinutes", message: "Estimated duration must be positive when provided." });
  }

  if (!input.lineage.workOrderId.trim()) {
    issues.push({ field: "lineage.workOrderId", message: "Work order id is required." });
  }

  if (!input.lineage.originSalesOrderId.trim()) {
    issues.push({ field: "lineage.originSalesOrderId", message: "Origin sales order id is required." });
  }

  if (!input.lineage.originQuoteId.trim()) {
    issues.push({ field: "lineage.originQuoteId", message: "Origin quote id is required." });
  }

  if (!Number.isInteger(input.lineage.productionJobRevision) || input.lineage.productionJobRevision <= 0) {
    issues.push({ field: "lineage.productionJobRevision", message: "Production job revision must be a positive integer." });
  }

  if (!Number.isInteger(input.lineage.workOrderRevision) || input.lineage.workOrderRevision <= 0) {
    issues.push({ field: "lineage.workOrderRevision", message: "Work order revision must be a positive integer." });
  }

  if (!Number.isInteger(input.lineage.originSalesOrderRevision) || input.lineage.originSalesOrderRevision <= 0) {
    issues.push({ field: "lineage.originSalesOrderRevision", message: "Sales order revision must be a positive integer." });
  }

  if (!Number.isInteger(input.lineage.originQuoteRevision) || input.lineage.originQuoteRevision <= 0) {
    issues.push({ field: "lineage.originQuoteRevision", message: "Quote revision must be a positive integer." });
  }

  if (!isIsoDate(input.lineage.createdTimestamp)) {
    issues.push({ field: "lineage.createdTimestamp", message: "Created timestamp must be a valid ISO date." });
  }

  if (!input.lineage.manufacturingVersion.trim()) {
    issues.push({ field: "lineage.manufacturingVersion", message: "Manufacturing version is required." });
  }

  if (isSecretLike(input.operationName) || isSecretLike(input.description) || isSecretLike(input.requiredCapability) || isSecretLike(input.engineeringNotes)) {
    issues.push({ field: "content", message: "Secret-like content is not allowed in operation definition fields." });
  }

  validateStringCollection(input.predecessorOperationIds, "predecessorOperationIds", issues);
  validateStringCollection(input.successorOperationIds, "successorOperationIds", issues);
  validateStringCollection(input.referenceDocuments, "referenceDocuments", issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateOperationDraftInput(
  current: Pick<NewOperationInput, "operationName" | "operationType" | "sequenceNumber" | "lineage">,
  patch: UpdateOperationDraftInput,
): OperationValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (patch.operationName !== undefined && !patch.operationName.trim()) {
    issues.push({ field: "operationName", message: "Operation name is required." });
  }

  if (patch.operationType !== undefined && !patch.operationType.trim()) {
    issues.push({ field: "operationType", message: "Operation type is required." });
  }

  if (patch.estimatedDurationMinutes !== undefined && patch.estimatedDurationMinutes !== null) {
    if (!Number.isFinite(patch.estimatedDurationMinutes) || patch.estimatedDurationMinutes <= 0) {
      issues.push({ field: "estimatedDurationMinutes", message: "Estimated duration must be positive when provided." });
    }
  }

  if (patch.referenceDocuments !== undefined) {
    validateStringCollection(patch.referenceDocuments, "referenceDocuments", issues);
  }

  if (patch.predecessorOperationIds !== undefined) {
    validateStringCollection(patch.predecessorOperationIds, "predecessorOperationIds", issues);
  }

  if (patch.successorOperationIds !== undefined) {
    validateStringCollection(patch.successorOperationIds, "successorOperationIds", issues);
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

  void current;

  return {
    valid: issues.length === 0,
    issues,
  };
}
