import { createCanonicalContentHash } from "./canonical-content-hash";

export type PageType =
  | "PRODUCT"
  | "PRODUCT_STATE"
  | "PRODUCT_CITY"
  | "PRODUCT_VARIANT"
  | "PRODUCT_VARIANT_STATE"
  | "PRODUCT_VARIANT_CITY"
  | "ATTRIBUTE"
  | "ATTRIBUTE_STATE"
  | "ATTRIBUTE_CITY"
  | "APPLICATION"
  | "APPLICATION_STATE"
  | "APPLICATION_CITY";

export type PageDimensionType =
  | "SITE"
  | "PRODUCT_FAMILY"
  | "PRODUCT"
  | "VARIANT"
  | "ATTRIBUTE"
  | "ATTRIBUTE_VALUE"
  | "COUNTRY"
  | "STATE"
  | "CITY"
  | "APPLICATION"
  | "INDUSTRY"
  | "CUSTOM";

export type PageWorthiness = "PAGE_WORTHY" | "CONDITIONAL" | "SUPPORTING_ONLY" | "PROHIBITED";
export type CatalogPlanningAuthority = "CANONICAL_PERSISTED" | "CERTIFIED_RECONCILIATION_PLAN";
export type PageBlueprintStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type PageBlueprint = {
  pageBlueprintId: string;
  organizationId: string;
  siteId: string;
  name: string;
  key: string;
  pageType: PageType;
  status: PageBlueprintStatus;
  subjectScope: {
    allowedCatalogAuthorities: readonly CatalogPlanningAuthority[];
    allowedProductFamilyIds: readonly string[];
    variantPagesEnabled: boolean;
    attributePagesEnabled: boolean;
  };
  requiredDimensions: readonly PageDimensionType[];
  optionalDimensions: readonly PageDimensionType[];
  pathTemplate: string;
  titleTemplateReference: string;
  generationProfileReference: string;
  contentRequirements: readonly string[];
  qaProfileReference: string;
  publicationPolicy: {
    mode: "DRAFT_ONLY";
    automaticPublication: false;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PageDimension = {
  dimensionType: PageDimensionType;
  dimensionKey: string;
  stableValue: string;
  displayValue: string;
  normalizedValue: string | null;
  worthiness: PageWorthiness;
};

export type PageBlueprintValidation = {
  valid: boolean;
  missingDimensions: readonly PageDimensionType[];
  prohibitedDimensions: readonly string[];
  unsupportedDimensions: readonly PageDimensionType[];
};

const COMMERCIAL_KEYS = new Set([
  "price",
  "dealer-price",
  "distributor-price",
  "retail-price",
  "shipping",
  "shipping-cost",
  "tariff",
]);

const CONDITIONAL_ATTRIBUTE_KEYS = new Set([
  "pixel-pitch",
  "size",
  "size-option",
  "resolution",
  "touch-option",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

export function createPageBlueprintId(input: {
  organizationId: string;
  siteId: string;
  key: string;
}): string {
  return `page-blueprint-${createCanonicalContentHash({
    organizationId: input.organizationId,
    siteId: input.siteId,
    key: normalizeKey(input.key),
  }).slice(0, 24)}`;
}

export function classifyPageDimension(input: {
  dimensionType: PageDimensionType;
  dimensionKey: string;
}): PageWorthiness {
  const key = normalizeKey(input.dimensionKey);
  if (COMMERCIAL_KEYS.has(key)) return "PROHIBITED";
  if (["PRODUCT", "PRODUCT_FAMILY", "COUNTRY", "STATE", "CITY", "APPLICATION"].includes(input.dimensionType)) {
    return "PAGE_WORTHY";
  }
  if (input.dimensionType === "VARIANT") return "CONDITIONAL";
  if (input.dimensionType === "ATTRIBUTE" || input.dimensionType === "ATTRIBUTE_VALUE") {
    if (CONDITIONAL_ATTRIBUTE_KEYS.has(key)) return "CONDITIONAL";
    if (key === "brightness") return "SUPPORTING_ONLY";
    return "SUPPORTING_ONLY";
  }
  if (input.dimensionType === "SITE") return "SUPPORTING_ONLY";
  return "CONDITIONAL";
}

export function createPageDimension(input: Omit<PageDimension, "worthiness"> & {
  worthiness?: PageWorthiness;
}): PageDimension {
  const policyWorthiness = classifyPageDimension(input);
  if (policyWorthiness === "PROHIBITED") {
    throw new Error(`Prohibited page dimension: ${input.dimensionKey}`);
  }
  const worthiness = input.worthiness ?? policyWorthiness;
  if (!input.dimensionKey.trim() || !input.stableValue.trim()) {
    throw new Error("Page dimensions require a stable key and value.");
  }
  return { ...input, dimensionKey: normalizeKey(input.dimensionKey), stableValue: input.stableValue.trim(), worthiness };
}

export function validatePageBlueprintDimensions(
  blueprint: PageBlueprint,
  dimensions: readonly PageDimension[],
): PageBlueprintValidation {
  const supplied = new Set(dimensions.map((dimension) => dimension.dimensionType));
  const allowed = new Set([...blueprint.requiredDimensions, ...blueprint.optionalDimensions]);
  const missingDimensions = blueprint.requiredDimensions.filter((dimension) => !supplied.has(dimension));
  const prohibitedDimensions = dimensions
    .filter((dimension) => dimension.worthiness === "PROHIBITED")
    .map((dimension) => dimension.dimensionKey);
  const unsupportedDimensions = [...new Set(
    dimensions.filter((dimension) => !allowed.has(dimension.dimensionType)).map((dimension) => dimension.dimensionType),
  )];
  const conditionalAttributeMissingAuthorization = dimensions.some((dimension) =>
    (dimension.dimensionType === "ATTRIBUTE" || dimension.dimensionType === "ATTRIBUTE_VALUE")
    && dimension.worthiness === "CONDITIONAL"
    && !blueprint.subjectScope.attributePagesEnabled);
  if (conditionalAttributeMissingAuthorization) prohibitedDimensions.push("attribute-page-policy");
  const supportingAttributeUsedAsSubject = blueprint.pageType.startsWith("ATTRIBUTE")
    && dimensions.some((dimension) =>
      (dimension.dimensionType === "ATTRIBUTE" || dimension.dimensionType === "ATTRIBUTE_VALUE")
      && dimension.worthiness === "SUPPORTING_ONLY");
  if (supportingAttributeUsedAsSubject) prohibitedDimensions.push("supporting-only-attribute");
  return {
    valid: missingDimensions.length === 0 && prohibitedDimensions.length === 0,
    missingDimensions,
    prohibitedDimensions,
    unsupportedDimensions,
  };
}

const ORGANIZATION_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const CREATED_AT = "2026-08-27T00:00:00.000Z";

function glwBlueprint(input: {
  key: string;
  name: string;
  pageType: PageType;
  requiredDimensions: readonly PageDimensionType[];
  pathTemplate: string;
}): PageBlueprint {
  return {
    pageBlueprintId: createPageBlueprintId({ organizationId: ORGANIZATION_ID, siteId: SITE_ID, key: input.key }),
    organizationId: ORGANIZATION_ID,
    siteId: SITE_ID,
    name: input.name,
    key: input.key,
    pageType: input.pageType,
    status: "ACTIVE",
    subjectScope: {
      allowedCatalogAuthorities: ["CANONICAL_PERSISTED", "CERTIFIED_RECONCILIATION_PLAN"],
      allowedProductFamilyIds: [],
      variantPagesEnabled: false,
      attributePagesEnabled: false,
    },
    requiredDimensions: input.requiredDimensions,
    optionalDimensions: ["PRODUCT_FAMILY"],
    pathTemplate: input.pathTemplate,
    titleTemplateReference: `title-template:${input.key.toLowerCase()}:v1`,
    generationProfileReference: "generation-profile:master-seo-shared:v1",
    contentRequirements: ["title", "seo-title", "meta-description", "body", "featured-image"],
    qaProfileReference: "qa-profile:glw-draft-page:v1",
    publicationPolicy: { mode: "DRAFT_ONLY", automaticPublication: false },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    version: 1,
  };
}

export const GLW_PRODUCT_PAGE_BLUEPRINT = glwBlueprint({
  key: "GLW_PRODUCT_PAGE",
  name: "GLW Product Page",
  pageType: "PRODUCT",
  requiredDimensions: ["SITE", "PRODUCT"],
  pathTemplate: "{applicationProductSlug}",
});

export const GLW_PRODUCT_STATE_BLUEPRINT = glwBlueprint({
  key: "GLW_PRODUCT_STATE",
  name: "GLW Product State Page",
  pageType: "PRODUCT_STATE",
  requiredDimensions: ["SITE", "PRODUCT", "COUNTRY", "STATE"],
  pathTemplate: "{applicationProductSlug}/{stateSlug}",
});

export const GLW_PRODUCT_CITY_BLUEPRINT = glwBlueprint({
  key: "GLW_PRODUCT_CITY",
  name: "GLW Product City Page",
  pageType: "PRODUCT_CITY",
  requiredDimensions: ["SITE", "PRODUCT", "COUNTRY", "STATE", "CITY"],
  pathTemplate: "{applicationProductSlug}/{stateSlug}/{citySlug}",
});

export const INITIAL_GLW_PAGE_BLUEPRINTS: readonly PageBlueprint[] = [
  GLW_PRODUCT_PAGE_BLUEPRINT,
  GLW_PRODUCT_STATE_BLUEPRINT,
  GLW_PRODUCT_CITY_BLUEPRINT,
];