import type {
  NewProductInput,
  ProductCategory,
  ProductConfiguration,
  ProductManufacturer,
  ProductValidationIssue,
  ProductValidationResult,
  UpdateProductInput,
} from "./types";

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function hasSecretKeyword(input: string): boolean {
  const normalized = input.toLowerCase();
  return normalized.includes("password") || normalized.includes("secret") || normalized.includes("apikey");
}

function validateAuthorityProvenance(
  provenance: ProductConfiguration["authorityProvenance"],
  sourceEvidenceReference: string | null | undefined,
  issues: ProductValidationIssue[],
): void {
  if (!provenance) return;
  if (isBlank(provenance.authorityReference)) {
    issues.push({ field: "authorityProvenance.authorityReference", message: "Authority reference is required." });
  }
  if (isBlank(provenance.normalizationVersion)) {
    issues.push({ field: "authorityProvenance.normalizationVersion", message: "Normalization version is required." });
  }
  if (Number.isNaN(Date.parse(provenance.normalizedAt))) {
    issues.push({ field: "authorityProvenance.normalizedAt", message: "Normalization timestamp must be ISO-compatible." });
  }
  if (provenance.sourceType === "OWNER_APPROVED_CANONICAL_PRODUCT"
    && !/^wordpress-page:[1-9]\d*:https:\/\//.test(sourceEvidenceReference ?? "")) {
    issues.push({ field: "sourceEvidenceReference", message: "Owner-approved canonical products require exact WordPress page evidence." });
  }
}

export function validateCategoryHierarchy(categories: readonly ProductCategory[]): ProductValidationResult {
  const issues: ProductValidationIssue[] = [];
  const categoryIds = new Set(categories.map((category) => category.categoryId));

  categories.forEach((category) => {
    if (category.parentCategoryId && !categoryIds.has(category.parentCategoryId)) {
      issues.push({
        field: `categories.${category.categoryId}.parentCategoryId`,
        message: "Parent category does not exist.",
      });
    }
  });

  const byId = new Map(categories.map((category) => [category.categoryId, category]));

  categories.forEach((category) => {
    const visited = new Set<string>();
    let pointer: string | null = category.parentCategoryId;

    while (pointer) {
      if (pointer === category.categoryId || visited.has(pointer)) {
        issues.push({
          field: `categories.${category.categoryId}.parentCategoryId`,
          message: "Category cycle detected.",
        });
        break;
      }

      visited.add(pointer);
      pointer = byId.get(pointer)?.parentCategoryId ?? null;
    }
  });

  return { valid: issues.length === 0, issues };
}

export function validateNewProductInput(input: NewProductInput): ProductValidationResult {
  const issues: ProductValidationIssue[] = [];

  if (isBlank(input.organizationId)) {
    issues.push({ field: "organizationId", message: "Organization is required." });
  }
  if (isBlank(input.productName)) {
    issues.push({ field: "productName", message: "Product name is required." });
  }
  if (!validateSlug(input.slug)) {
    issues.push({ field: "slug", message: "Slug must be lowercase kebab-case." });
  }
  if (isBlank(input.sku)) {
    issues.push({ field: "sku", message: "SKU or approved identifier is required." });
  }
  if (input.categoryIds.length === 0) {
    issues.push({ field: "categoryIds", message: "At least one category is required." });
  }
  if (!input.primarySiteId) {
    issues.push({ field: "primarySiteId", message: "Primary site assignment is required." });
  }
  validateAuthorityProvenance(input.authorityProvenance, input.sourceEvidenceReference, issues);

  const payloadText = JSON.stringify(input);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "input", message: "Raw secret fields are not allowed." });
  }

  return { valid: issues.length === 0, issues };
}

export function validateUpdateProductInput(
  existing: ProductConfiguration,
  patch: UpdateProductInput,
): ProductValidationResult {
  const issues: ProductValidationIssue[] = [];

  if (Object.prototype.hasOwnProperty.call(patch, "productId")) {
    issues.push({ field: "productId", message: "Product ID is immutable." });
  }

  const patchRecord = patch as UpdateProductInput & { organizationId?: string };

  if (
    Object.prototype.hasOwnProperty.call(patchRecord, "organizationId") &&
    patchRecord.organizationId !== existing.organizationId
  ) {
    issues.push({ field: "organizationId", message: "Organization reassignment is not allowed." });
  }

  if (patch.slug && !validateSlug(patch.slug)) {
    issues.push({ field: "slug", message: "Slug must be lowercase kebab-case." });
  }

  if (patch.sku !== undefined && isBlank(patch.sku)) {
    issues.push({ field: "sku", message: "SKU cannot be blank." });
  }
  validateAuthorityProvenance(patch.authorityProvenance, patch.sourceEvidenceReference ?? existing.sourceEvidenceReference, issues);

  const payloadText = JSON.stringify(patch);
  if (hasSecretKeyword(payloadText)) {
    issues.push({ field: "patch", message: "Raw secret fields are not allowed." });
  }

  return { valid: issues.length === 0, issues };
}

export function validateManufacturerReference(
  manufacturerId: string | null,
  manufacturers: readonly ProductManufacturer[],
): ProductValidationResult {
  if (!manufacturerId) {
    return { valid: true, issues: [] };
  }

  const exists = manufacturers.some(
    (manufacturer) => manufacturer.manufacturerId === manufacturerId,
  );

  return exists
    ? { valid: true, issues: [] }
    : {
      valid: false,
      issues: [
        {
          field: "manufacturerId",
          message: "Manufacturer reference is invalid.",
        },
      ],
    };
}
