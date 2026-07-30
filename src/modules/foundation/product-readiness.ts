import { getSiteById } from "./site-repository";
import type {
  PermissionAction,
  ProductConfiguration,
  ProductReadinessCondition,
  ProductReadinessResult,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function lifecyclePermits(product: ProductConfiguration): boolean {
  return product.lifecycleState === "active" || product.lifecycleState === "configuring";
}

function hasRequiredSpecs(product: ProductConfiguration): boolean {
  return product.specifications.length > 0;
}

export function evaluateProductReadiness(input: {
  product: ProductConfiguration;
  requiredPermission: PermissionAction;
  permissions: Set<PermissionAction>;
}): ProductReadinessResult {
  const primarySite = input.product.primarySiteId
    ? getSiteById(input.product.primarySiteId)
    : null;

  const assignment = input.product.primarySiteId
    ? input.product.siteAssignments.find(
      (siteAssignment) => siteAssignment.siteId === input.product.primarySiteId,
    )
    : null;

  const conditions: ProductReadinessCondition[] = [
    {
      key: "product_enabled",
      passed: input.product.enabled,
      details: input.product.enabled ? "Product is enabled." : "Product is disabled.",
    },
    {
      key: "lifecycle_permits_operation",
      passed: lifecyclePermits(input.product),
      details: `Lifecycle state is ${input.product.lifecycleState}.`,
    },
    {
      key: "name_present",
      passed: Boolean(input.product.productName.trim().length > 0),
      details: input.product.productName ? "Product name is configured." : "Product name is missing.",
    },
    {
      key: "slug_valid",
      passed: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.product.slug),
      details: `Slug is ${input.product.slug}.`,
    },
    {
      key: "sku_present",
      passed: Boolean(input.product.sku.trim().length > 0),
      details: input.product.sku ? "SKU is configured." : "SKU is missing.",
    },
    {
      key: "product_type_present",
      passed: Boolean(input.product.productType),
      details: input.product.productType
        ? `Product type is ${input.product.productType}.`
        : "Product type is missing.",
    },
    {
      key: "category_assigned",
      passed: input.product.categoryIds.length > 0,
      details:
        input.product.categoryIds.length > 0
          ? `${input.product.categoryIds.length} categories assigned.`
          : "No categories assigned.",
    },
    {
      key: "primary_site_assigned",
      passed: Boolean(input.product.primarySiteId),
      details: input.product.primarySiteId
        ? `Primary site is ${input.product.primarySiteId}.`
        : "Primary site is missing.",
    },
    {
      key: "site_assignment_enabled",
      passed: Boolean(assignment?.enabledForSite),
      details: assignment?.enabledForSite
        ? "Primary site assignment is enabled."
        : "Primary site assignment is missing or disabled.",
    },
    {
      key: "required_description_present",
      passed: Boolean(input.product.shortDescription && input.product.fullDescription),
      details:
        input.product.shortDescription && input.product.fullDescription
          ? "Short and full descriptions are present."
          : "One or more required descriptions are missing.",
    },
    {
      key: "required_specifications_present",
      passed: hasRequiredSpecs(input.product),
      details: hasRequiredSpecs(input.product)
        ? `${input.product.specifications.length} specifications configured.`
        : "No specifications configured.",
    },
    {
      key: "primary_image_present",
      passed: Boolean(input.product.media.primaryImageReference),
      details: input.product.media.primaryImageReference
        ? "Primary image reference is configured."
        : "Primary image reference is missing.",
    },
    {
      key: "manufacturer_present_or_exception",
      passed: Boolean(input.product.manufacturerId),
      details: input.product.manufacturerId
        ? `Manufacturer reference ${input.product.manufacturerId} configured.`
        : "Manufacturer reference missing.",
    },
    {
      key: "site_active",
      passed: Boolean(primarySite?.enabled),
      details: primarySite?.enabled
        ? `Primary site ${primarySite.siteId} is enabled.`
        : "Primary site is unavailable or disabled.",
    },
    {
      key: "site_publishability_compatible",
      passed: assignment?.publicationStatus === "ready" || assignment?.publicationStatus === "published",
      details:
        assignment?.publicationStatus === "ready" || assignment?.publicationStatus === "published"
          ? `Site publication status is ${assignment?.publicationStatus}.`
          : `Site publication status is ${assignment?.publicationStatus ?? "unknown"}.`,
    },
    {
      key: "visibility_compatible",
      passed: input.product.visibility !== "hidden",
      details:
        input.product.visibility !== "hidden"
          ? `Visibility is ${input.product.visibility}.`
          : "Visibility is hidden.",
    },
    {
      key: "required_profile_references_present",
      passed: Boolean(
        input.product.seoProfileReference &&
          input.product.promptProfileReference &&
          assignment?.imageProfileReference,
      ),
      details:
        input.product.seoProfileReference &&
        input.product.promptProfileReference &&
        assignment?.imageProfileReference
          ? "Required profile references are configured."
          : "One or more required profile references are missing.",
    },
    {
      key: "user_has_permission",
      passed: input.permissions.has(input.requiredPermission),
      details: input.permissions.has(input.requiredPermission)
        ? `Permission ${input.requiredPermission} granted.`
        : `Permission ${input.requiredPermission} missing.`,
    },
  ];

  const blockingReasons = conditions
    .filter((condition) => !condition.passed)
    .map((condition) => condition.details);

  const warnings: string[] = [];
  if (input.product.catalogStatus === "review_required") {
    warnings.push("Catalog status requires review before publication decisions.");
  }

  const ready = blockingReasons.length === 0;

  return {
    ready,
    status: ready ? "ready" : warnings.length > 0 ? "warning" : "blocked",
    blockingReasons,
    warnings,
    checkedConditions: conditions,
    checkedAt: nowIso(),
  };
}
