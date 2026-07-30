import type {
  IntegrationProfileAssignmentRecord,
  IntegrationProfileConfiguration,
  IntegrationProfileValidationIssue,
  IntegrationProfileValidationResult,
  NewIntegrationProfileInput,
  UpdateIntegrationProfileInput,
} from "./types";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function containsSecretLikeValue(input: string): boolean {
  const normalized = input.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("private key") ||
    normalized.includes("sk-")
  );
}

function hasDisallowedBinaryPayload(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.startsWith("data:") || normalized.length > 512;
}

function validateReferences(
  references: IntegrationProfileConfiguration["references"],
  pathPrefix: string,
): IntegrationProfileValidationIssue[] {
  const issues: IntegrationProfileValidationIssue[] = [];

  Object.entries(references).forEach(([field, value]) => {
    if (value === null) {
      return;
    }

    if (isBlank(value)) {
      issues.push({
        field: `${pathPrefix}.${field}`,
        message: "Reference value cannot be blank.",
      });
      return;
    }

    if (containsSecretLikeValue(value)) {
      issues.push({
        field: `${pathPrefix}.${field}`,
        message: "Secret-like values are not allowed in profile references.",
      });
    }

    if (hasDisallowedBinaryPayload(value)) {
      issues.push({
        field: `${pathPrefix}.${field}`,
        message: "Binary payloads are not allowed. Use opaque references only.",
      });
    }
  });

  return issues;
}

export function validateNewIntegrationProfileInput(
  input: NewIntegrationProfileInput,
): IntegrationProfileValidationResult {
  const issues: IntegrationProfileValidationIssue[] = [];

  if (isBlank(input.profileId)) {
    issues.push({ field: "profileId", message: "Profile ID is required." });
  }

  if (isBlank(input.profileName)) {
    issues.push({ field: "profileName", message: "Profile name is required." });
  }

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }

  if (isBlank(input.version)) {
    issues.push({ field: "version", message: "Version is required." });
  }

  if (!Array.isArray(input.assignedSiteIds)) {
    issues.push({ field: "assignedSiteIds", message: "Assigned sites must be an array." });
  }

  issues.push(...validateReferences(input.references, "references"));

  const payloadText = JSON.stringify(input);
  if (containsSecretLikeValue(payloadText)) {
    issues.push({
      field: "input",
      message: "Raw secret-like values are not allowed in profile payloads.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateIntegrationProfileInput(
  existing: IntegrationProfileConfiguration,
  patch: UpdateIntegrationProfileInput,
): IntegrationProfileValidationResult {
  const issues: IntegrationProfileValidationIssue[] = [];

  if (Object.prototype.hasOwnProperty.call(patch, "profileId")) {
    issues.push({ field: "profileId", message: "Profile ID is immutable." });
  }

  if (Object.prototype.hasOwnProperty.call(patch, "organizationId")) {
    issues.push({ field: "organizationId", message: "Organization is immutable." });
  }

  if (Object.prototype.hasOwnProperty.call(patch, "profileType")) {
    issues.push({ field: "profileType", message: "Profile type is immutable." });
  }

  if (patch.profileName !== undefined && isBlank(patch.profileName)) {
    issues.push({ field: "profileName", message: "Profile name cannot be blank." });
  }

  if (patch.version !== undefined && isBlank(patch.version)) {
    issues.push({ field: "version", message: "Version cannot be blank." });
  }

  if (patch.references) {
    const mergedReferences = {
      ...existing.references,
      ...patch.references,
    };

    issues.push(...validateReferences(mergedReferences, "references"));
  }

  const payloadText = JSON.stringify(patch);
  if (containsSecretLikeValue(payloadText)) {
    issues.push({
      field: "patch",
      message: "Raw secret-like values are not allowed in profile patch payloads.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateProfileAssignments(
  assignments: readonly IntegrationProfileAssignmentRecord[],
  profiles: readonly IntegrationProfileConfiguration[],
): IntegrationProfileValidationResult {
  const issues: IntegrationProfileValidationIssue[] = [];
  const profileById = new Map(profiles.map((profile) => [profile.profileId, profile]));
  const assignmentKeySet = new Set<string>();

  assignments.forEach((assignment) => {
    const profile = profileById.get(assignment.profileId);
    if (!profile) {
      issues.push({
        field: `assignments.${assignment.assignmentId}.profileId`,
        message: "Assigned profile does not exist.",
      });
      return;
    }

    if (profile.organizationId !== assignment.organizationId) {
      issues.push({
        field: `assignments.${assignment.assignmentId}.organizationId`,
        message: "Assignment organization must match profile organization.",
      });
    }

    if (profile.profileType !== assignment.profileType) {
      issues.push({
        field: `assignments.${assignment.assignmentId}.profileType`,
        message: "Assignment profile type must match referenced profile type.",
      });
    }

    const uniquenessKey = `${assignment.organizationId}:${assignment.targetType}:${assignment.targetId}:${assignment.profileType}`;
    if (assignmentKeySet.has(uniquenessKey)) {
      issues.push({
        field: `assignments.${assignment.assignmentId}`,
        message: "Duplicate profile assignment target/type combination is not allowed.",
      });
    }
    assignmentKeySet.add(uniquenessKey);
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
