import type {
  NewSiteInput,
  SiteConfiguration,
  SiteValidationIssue,
  SiteValidationResult,
  UpdateSiteInput,
} from "./types";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isLikelySecretField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase();
  return normalized.includes("password") || normalized.includes("secret") || normalized.includes("apiKey");
}

function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function validateNewSiteInput(input: NewSiteInput): SiteValidationResult {
  const issues: SiteValidationIssue[] = [];

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (isBlank(input.siteName)) {
    issues.push({ field: "siteName", message: "Site name is required." });
  }
  if (isBlank(input.displayName)) {
    issues.push({ field: "displayName", message: "Display name is required." });
  }
  if (!validateSlug(input.slug)) {
    issues.push({ field: "slug", message: "Slug must be lowercase kebab-case." });
  }
  if (input.domain && input.domain.includes("http")) {
    issues.push({ field: "domain", message: "Domain must not include protocol." });
  }

  if (input.integrations.wordpressCredentialReference &&
    isBlank(input.integrations.wordpressCredentialReference)) {
    issues.push({ field: "integrations.wordpressCredentialReference", message: "Credential reference cannot be blank." });
  }

  Object.keys(input.integrations).forEach((field) => {
    if (isLikelySecretField(field)) {
      issues.push({ field: `integrations.${field}`, message: "Raw secret fields are not allowed." });
    }
  });

  Object.keys(input.profiles).forEach((field) => {
    if (isLikelySecretField(field)) {
      issues.push({ field: `profiles.${field}`, message: "Raw secret fields are not allowed." });
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateUpdateSiteInput(
  existing: SiteConfiguration,
  patch: UpdateSiteInput,
): SiteValidationResult {
  const issues: SiteValidationIssue[] = [];

  if (Object.prototype.hasOwnProperty.call(patch, "siteId")) {
    issues.push({ field: "siteId", message: "Site ID is immutable." });
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "organizationId") &&
    patch.organizationId !== existing.organizationId
  ) {
    issues.push({ field: "organizationId", message: "Organization reassignment is not allowed." });
  }

  if (patch.slug && !validateSlug(patch.slug)) {
    issues.push({ field: "slug", message: "Slug must be lowercase kebab-case." });
  }

  if (patch.domain && patch.domain.includes("http")) {
    issues.push({ field: "domain", message: "Domain must not include protocol." });
  }

  if (patch.integrations) {
    Object.keys(patch.integrations).forEach((field) => {
      if (isLikelySecretField(field)) {
        issues.push({ field: `integrations.${field}`, message: "Raw secret fields are not allowed." });
      }
    });
  }

  if (patch.profiles) {
    Object.keys(patch.profiles).forEach((field) => {
      if (isLikelySecretField(field)) {
        issues.push({ field: `profiles.${field}`, message: "Raw secret fields are not allowed." });
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
