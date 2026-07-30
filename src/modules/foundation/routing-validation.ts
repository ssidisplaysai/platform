import type {
  NewRoutingInput,
  RoutingOperationStep,
  RoutingValidationResult,
  UpdateRoutingDraftInput,
} from "./routing-types";

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

function validateOperationSequence(
  steps: readonly RoutingOperationStep[],
  issues: Array<{ field: string; message: string }>,
): void {
  if (steps.length === 0) {
    issues.push({ field: "operationSequence", message: "At least one operation is required." });
    return;
  }

  const stepIds = new Set<string>();
  const sequenceNumbers = new Set<number>();
  const edges = new Map<string, readonly string[]>();

  steps.forEach((step, index) => {
    if (!step.stepId.trim()) {
      issues.push({ field: `operationSequence[${index}].stepId`, message: "Step id is required." });
    } else if (stepIds.has(step.stepId)) {
      issues.push({ field: `operationSequence[${index}].stepId`, message: "Step id must be unique." });
    } else {
      stepIds.add(step.stepId);
    }

    if (!step.operationReference.trim()) {
      issues.push({ field: `operationSequence[${index}].operationReference`, message: "Operation reference is required." });
    }

    if (!Number.isInteger(step.sequenceNumber) || step.sequenceNumber <= 0) {
      issues.push({ field: `operationSequence[${index}].sequenceNumber`, message: "Sequence number must be a positive integer." });
    } else if (sequenceNumbers.has(step.sequenceNumber)) {
      issues.push({ field: `operationSequence[${index}].sequenceNumber`, message: "Sequence number must be unique." });
    } else {
      sequenceNumbers.add(step.sequenceNumber);
    }

    validateStringCollection(step.predecessorOperationIds, `operationSequence[${index}].predecessorOperationIds`, issues);
    validateStringCollection(step.successorOperationIds, `operationSequence[${index}].successorOperationIds`, issues);
    validateStringCollection(step.referenceDocuments, `operationSequence[${index}].referenceDocuments`, issues);

    if (step.estimatedCycleTimeMinutes !== null && step.estimatedCycleTimeMinutes <= 0) {
      issues.push({ field: `operationSequence[${index}].estimatedCycleTimeMinutes`, message: "Estimated cycle time must be positive when provided." });
    }
    if (step.estimatedSetupTimeMinutes !== null && step.estimatedSetupTimeMinutes < 0) {
      issues.push({ field: `operationSequence[${index}].estimatedSetupTimeMinutes`, message: "Estimated setup time cannot be negative." });
    }
    if (step.estimatedRunTimeMinutes !== null && step.estimatedRunTimeMinutes < 0) {
      issues.push({ field: `operationSequence[${index}].estimatedRunTimeMinutes`, message: "Estimated run time cannot be negative." });
    }
    if (step.estimatedChangeoverTimeMinutes !== null && step.estimatedChangeoverTimeMinutes < 0) {
      issues.push({ field: `operationSequence[${index}].estimatedChangeoverTimeMinutes`, message: "Estimated changeover time cannot be negative." });
    }

    edges.set(step.stepId, step.predecessorOperationIds);
  });

  steps.forEach((step, index) => {
    step.predecessorOperationIds.forEach((predecessorId) => {
      if (!stepIds.has(predecessorId)) {
        issues.push({ field: `operationSequence[${index}].predecessorOperationIds`, message: `Unknown predecessor operation reference: ${predecessorId}.` });
      }
    });
    step.successorOperationIds.forEach((successorId) => {
      if (!stepIds.has(successorId)) {
        issues.push({ field: `operationSequence[${index}].successorOperationIds`, message: `Unknown successor operation reference: ${successorId}.` });
      }
    });
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (stepId: string): boolean => {
    if (visiting.has(stepId)) {
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visiting.add(stepId);
    const predecessors = edges.get(stepId) ?? [];
    for (const predecessorId of predecessors) {
      if (visit(predecessorId)) {
        return true;
      }
    }

    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  };

  for (const step of steps) {
    if (visit(step.stepId)) {
      issues.push({ field: "operationSequence", message: "Operation dependency graph must be acyclic." });
      break;
    }
  }
}

export function validateNewRoutingInput(input: NewRoutingInput): RoutingValidationResult {
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

  if (!input.routingName.trim()) {
    issues.push({ field: "routingName", message: "Routing name is required." });
  }

  if (input.effectiveDate !== null && !isIsoDate(input.effectiveDate)) {
    issues.push({ field: "effectiveDate", message: "Effective date must be a valid ISO date." });
  }

  if (input.estimatedCycleTimeMinutes !== null && input.estimatedCycleTimeMinutes <= 0) {
    issues.push({ field: "estimatedCycleTimeMinutes", message: "Estimated cycle time must be positive when provided." });
  }

  if (input.estimatedSetupTimeMinutes !== null && input.estimatedSetupTimeMinutes < 0) {
    issues.push({ field: "estimatedSetupTimeMinutes", message: "Estimated setup time cannot be negative." });
  }

  if (input.estimatedRunTimeMinutes !== null && input.estimatedRunTimeMinutes < 0) {
    issues.push({ field: "estimatedRunTimeMinutes", message: "Estimated run time cannot be negative." });
  }

  if (input.estimatedChangeoverTimeMinutes !== null && input.estimatedChangeoverTimeMinutes < 0) {
    issues.push({ field: "estimatedChangeoverTimeMinutes", message: "Estimated changeover time cannot be negative." });
  }

  if (!input.lineage.organizationId.trim()) {
    issues.push({ field: "lineage.organizationId", message: "Organization lineage is required." });
  }

  if (input.lineage.createdTimestamp && !isIsoDate(input.lineage.createdTimestamp)) {
    issues.push({ field: "lineage.createdTimestamp", message: "Created timestamp must be a valid ISO date." });
  }

  if (!input.lineage.createdBy.trim()) {
    issues.push({ field: "lineage.createdBy", message: "Created by is required." });
  }

  if (!input.lineage.manufacturingVersion.trim()) {
    issues.push({ field: "lineage.manufacturingVersion", message: "Manufacturing version is required." });
  }

  if (isSecretLike(input.routingName) || isSecretLike(input.description) || isSecretLike(input.engineeringNotes)) {
    issues.push({ field: "content", message: "Secret-like content is not allowed in routing definition fields." });
  }

  validateOperationSequence(input.operationSequence, issues);
  validateStringCollection(input.parallelOperationGroups.flatMap((group) => group.operationReferences), "parallelOperationGroups", issues);
  validateStringCollection(input.conditionalBranchReferences, "conditionalBranchReferences", issues);
  validateStringCollection(input.referencedWorkCenters, "referencedWorkCenters", issues);
  validateStringCollection(input.referencedMachineTypes, "referencedMachineTypes", issues);
  validateStringCollection(input.referencedSkills, "referencedSkills", issues);
  validateStringCollection(input.referenceDocuments, "referenceDocuments", issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateRoutingDraftInput(
  current: Pick<NewRoutingInput, "routingName" | "routingNumber" | "operationSequence" | "lineage">,
  patch: UpdateRoutingDraftInput,
): RoutingValidationResult {
  const issues: Array<{ field: string; message: string }> = [];

  if (patch.routingName !== undefined && !patch.routingName.trim()) {
    issues.push({ field: "routingName", message: "Routing name is required." });
  }

  if (patch.routingNumber !== undefined && patch.routingNumber.trim().length === 0) {
    issues.push({ field: "routingNumber", message: "Routing number is required." });
  }

  if (patch.effectiveDate !== undefined && patch.effectiveDate !== null && !isIsoDate(patch.effectiveDate)) {
    issues.push({ field: "effectiveDate", message: "Effective date must be a valid ISO date." });
  }

  if (patch.estimatedCycleTimeMinutes !== undefined && patch.estimatedCycleTimeMinutes !== null && patch.estimatedCycleTimeMinutes <= 0) {
    issues.push({ field: "estimatedCycleTimeMinutes", message: "Estimated cycle time must be positive when provided." });
  }

  if (patch.estimatedSetupTimeMinutes !== undefined && patch.estimatedSetupTimeMinutes !== null && patch.estimatedSetupTimeMinutes < 0) {
    issues.push({ field: "estimatedSetupTimeMinutes", message: "Estimated setup time cannot be negative." });
  }

  if (patch.estimatedRunTimeMinutes !== undefined && patch.estimatedRunTimeMinutes !== null && patch.estimatedRunTimeMinutes < 0) {
    issues.push({ field: "estimatedRunTimeMinutes", message: "Estimated run time cannot be negative." });
  }

  if (patch.estimatedChangeoverTimeMinutes !== undefined && patch.estimatedChangeoverTimeMinutes !== null && patch.estimatedChangeoverTimeMinutes < 0) {
    issues.push({ field: "estimatedChangeoverTimeMinutes", message: "Estimated changeover time cannot be negative." });
  }

  if (patch.operationSequence !== undefined) {
    validateOperationSequence(patch.operationSequence, issues);
  }

  if (patch.parallelOperationGroups !== undefined) {
    validateStringCollection(patch.parallelOperationGroups.flatMap((group) => group.operationReferences), "parallelOperationGroups", issues);
  }

  if (patch.conditionalBranchReferences !== undefined) {
    validateStringCollection(patch.conditionalBranchReferences, "conditionalBranchReferences", issues);
  }

  if (patch.referencedWorkCenters !== undefined) {
    validateStringCollection(patch.referencedWorkCenters, "referencedWorkCenters", issues);
  }

  if (patch.referencedMachineTypes !== undefined) {
    validateStringCollection(patch.referencedMachineTypes, "referencedMachineTypes", issues);
  }

  if (patch.referencedSkills !== undefined) {
    validateStringCollection(patch.referencedSkills, "referencedSkills", issues);
  }

  if (patch.referenceDocuments !== undefined) {
    validateStringCollection(patch.referenceDocuments, "referenceDocuments", issues);
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