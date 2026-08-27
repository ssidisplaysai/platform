import type {
  ProductConfiguration,
  SiteConfiguration,
  SiteEnvironment,
} from "@/modules/foundation/types";

export type GlwPageType = "general_service" | "state_service" | "city_service";
export type GlwPublicationIntent = "draft" | "publish";
export type GlwLocalPlannedOperation = "CREATE_GENERAL" | "CREATE_STATE" | "CREATE_CITY";

export type GlwState = {
  code: string;
  name: string;
  slug: string;
};

export type GlwCity = {
  stateCode: string;
  name: string;
  slug: string;
  metro: string;
};

export const GLW_STATES: readonly GlwState[] = [
  { code: "TX", name: "Texas", slug: "texas" },
  { code: "CA", name: "California", slug: "california" },
  { code: "FL", name: "Florida", slug: "florida" },
  { code: "IL", name: "Illinois", slug: "illinois" },
  { code: "GA", name: "Georgia", slug: "georgia" },
  { code: "NC", name: "North Carolina", slug: "north-carolina" },
  { code: "NY", name: "New York", slug: "new-york" },
];

export const GLW_CITIES: readonly GlwCity[] = [
  { stateCode: "TX", name: "Austin", slug: "austin", metro: "Austin" },
  { stateCode: "TX", name: "Dallas", slug: "dallas", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Houston", slug: "houston", metro: "Houston" },
  { stateCode: "TX", name: "San Antonio", slug: "san-antonio", metro: "San Antonio" },
  { stateCode: "CA", name: "Los Angeles", slug: "los-angeles", metro: "Los Angeles" },
  { stateCode: "CA", name: "San Diego", slug: "san-diego", metro: "San Diego" },
  { stateCode: "CA", name: "San Francisco", slug: "san-francisco", metro: "San Francisco Bay Area" },
  { stateCode: "FL", name: "Miami", slug: "miami", metro: "Miami" },
  { stateCode: "FL", name: "Orlando", slug: "orlando", metro: "Orlando" },
  { stateCode: "IL", name: "Chicago", slug: "chicago", metro: "Chicago" },
  { stateCode: "GA", name: "Atlanta", slug: "atlanta", metro: "Atlanta" },
  { stateCode: "NC", name: "Charlotte", slug: "charlotte", metro: "Charlotte" },
  { stateCode: "NY", name: "New York", slug: "new-york", metro: "New York City" },
];

export type GlwGenerationSite = {
  siteId: string;
  organizationId: string;
  name: string;
  slug: string;
  environment: SiteEnvironment;
  enabled: boolean;
  profileCount: number;
};

export type GlwGenerationProduct = {
  siteId: string;
  productId: string;
  organizationId: string;
  name: string;
  slug: string;
  topic: string;
  assignedSiteIds: readonly string[];
};

export function adaptSiteForGeneration(
  site: Pick<SiteConfiguration, "siteId" | "organizationId" | "displayName" | "slug" | "environment" | "enabled">,
  profileCount = 0,
): GlwGenerationSite {
  return {
    siteId: site.siteId,
    organizationId: site.organizationId,
    name: site.displayName,
    slug: site.slug,
    environment: site.environment,
    enabled: site.enabled,
    profileCount,
  };
}

export function adaptProductForGeneration(
  product: Pick<ProductConfiguration, "productId" | "organizationId" | "displayName" | "productName" | "slug" | "assignedSiteIds" | "siteAssignments">,
  siteId: string,
): GlwGenerationProduct {
  const assignment = product.siteAssignments.find((entry) => entry.siteId === siteId);

  return {
    siteId,
    productId: product.productId,
    organizationId: product.organizationId,
    name: assignment?.siteSpecificDisplayName ?? product.displayName,
    slug: assignment?.siteSpecificSlug ?? product.slug,
    topic: assignment?.siteSpecificDisplayName ?? product.productName,
    assignedSiteIds: product.assignedSiteIds,
  };
}

export function getGlwState(stateCode: string): GlwState | null {
  return GLW_STATES.find((state) => state.code === stateCode) ?? null;
}

export function getGlwCity(stateCode: string, citySlug: string): GlwCity | null {
  return GLW_CITIES.find(
    (city) => city.stateCode === stateCode && city.slug === citySlug,
  ) ?? null;
}

export function getGlwCitiesForState(stateCode: string): readonly GlwCity[] {
  return GLW_CITIES.filter((city) => city.stateCode === stateCode);
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

export function createGlwCanonicalPath(input: {
  productSlug: string;
  stateCode?: string;
  citySlug?: string;
}): string {
  const segments = [normalizeSlug(input.productSlug)];
  const state = input.stateCode ? getGlwState(input.stateCode) : null;

  if (state) {
    segments.push(state.slug);
  }
  if (input.citySlug) {
    segments.push(normalizeSlug(input.citySlug));
  }

  return segments.join("/");
}

export type GlwGenerationRequestInput = {
  siteId: string;
  productId: string;
  pageType: GlwPageType;
  stateCode: string;
  citySlug: string;
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  publicationIntent: GlwPublicationIntent;
};

export type GlwGenerationRequest = GlwGenerationRequestInput & {
  organizationId: string;
  siteName: string;
  productTopic: string;
  stateName: string | null;
  cityName: string | null;
  canonicalPath: string;
  plannedOperation: GlwLocalPlannedOperation;
  externalExecutionAllowed: false;
};

export type GlwGenerationValidation = {
  valid: boolean;
  issues: readonly { field: keyof GlwGenerationRequestInput | "catalog"; message: string }[];
};

export type GlwLocalGenerationPreview = {
  validation: GlwGenerationValidation;
  request: GlwGenerationRequest | null;
};

export function createDefaultGlwGenerationInput(
  site: GlwGenerationSite,
  product: GlwGenerationProduct,
  pageType: GlwPageType = "city_service",
  stateCode = "TX",
  citySlug = "austin",
): GlwGenerationRequestInput {
  const state = getGlwState(stateCode);
  const city = pageType === "city_service" ? getGlwCity(stateCode, citySlug) : null;
  const location = city?.name ?? (pageType === "state_service" ? state?.name : null);
  const title = location ? `${product.topic} in ${location}` : product.topic;

  return {
    siteId: site.siteId,
    productId: product.productId,
    pageType,
    stateCode: pageType === "general_service" ? "" : stateCode,
    citySlug: pageType === "city_service" ? citySlug : "",
    slug: createGlwCanonicalPath({
      productSlug: product.slug,
      stateCode: pageType === "general_service" ? undefined : stateCode,
      citySlug: pageType === "city_service" ? citySlug : undefined,
    }),
    title,
    seoTitle: `${title} | ${site.name}`,
    metaDescription: `Explore ${title.toLowerCase()} from ${site.name}.`,
    publicationIntent: "draft",
  };
}

export function buildLocalGlwGenerationPreview(input: {
  form: GlwGenerationRequestInput;
  sites: readonly GlwGenerationSite[];
  products: readonly GlwGenerationProduct[];
}): GlwLocalGenerationPreview {
  const { form } = input;
  const issues: { field: keyof GlwGenerationRequestInput | "catalog"; message: string }[] = [];
  const site = input.sites.find((entry) => entry.siteId === form.siteId) ?? null;
  const product = input.products.find(
    (entry) => entry.productId === form.productId && entry.siteId === form.siteId,
  ) ?? null;
  const state = form.stateCode ? getGlwState(form.stateCode) : null;
  const city = form.citySlug && form.stateCode
    ? getGlwCity(form.stateCode, form.citySlug)
    : null;

  if (!site) issues.push({ field: "siteId", message: "Select a current site." });
  if (!product) issues.push({ field: "productId", message: "Select a current product or topic." });
  if (site && product && site.organizationId !== product.organizationId) {
    issues.push({ field: "catalog", message: "The selected product belongs to another organization." });
  }
  if (site && product && !product.assignedSiteIds.includes(site.siteId)) {
    issues.push({ field: "productId", message: "The selected product is not assigned to this site." });
  }
  if (form.pageType !== "general_service" && !state) {
    issues.push({ field: "stateCode", message: "Select a valid state." });
  }
  if (form.pageType === "city_service" && !city) {
    issues.push({ field: "citySlug", message: "Select a city that belongs to the selected state." });
  }
  if (form.pageType === "state_service" && form.citySlug) {
    issues.push({ field: "citySlug", message: "State pages cannot carry a city." });
  }
  if (!/^[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?$/.test(form.slug)) {
    issues.push({ field: "slug", message: "Use a lowercase canonical path." });
  }
  if (!form.title.trim()) issues.push({ field: "title", message: "Title is required." });
  if (!form.seoTitle.trim()) issues.push({ field: "seoTitle", message: "SEO title is required." });
  if (!form.metaDescription.trim() || form.metaDescription.length > 160) {
    issues.push({ field: "metaDescription", message: "Meta description is required and must be 160 characters or fewer." });
  }

  const validation = { valid: issues.length === 0, issues };
  if (!validation.valid || !site || !product) {
    return { validation, request: null };
  }

  return {
    validation,
    request: {
      ...form,
      organizationId: site.organizationId,
      siteName: site.name,
      productTopic: product.topic,
      stateName: state?.name ?? null,
      cityName: city?.name ?? null,
      canonicalPath: form.slug,
      plannedOperation: form.pageType === "city_service"
        ? "CREATE_CITY"
        : form.pageType === "state_service"
          ? "CREATE_STATE"
          : "CREATE_GENERAL",
      externalExecutionAllowed: false,
    },
  };
}