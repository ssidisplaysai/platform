import type {
  ProductConfiguration,
  SiteConfiguration,
  SiteEnvironment,
} from "@/modules/foundation/types";

import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";

export type GlwPageType = "general_service" | "state_service" | "city_service";
export type GlwPublicationIntent = "draft" | "publish";
export type GlwLocalPlannedOperation =
  | "CREATE_GENERAL"
  | "CREATE_STATE"
  | "CREATE_CITY"
  | "UPDATE_GENERAL"
  | "UPDATE_STATE"
  | "UPDATE_CITY";

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

export const GLW_STATES: readonly GlwState[] =
  GLW_CAMPAIGN_US_STATES;

export const GLW_CITIES: readonly GlwCity[] = [
  { stateCode: "TX", name: "Austin", slug: "austin", metro: "Austin" },
  { stateCode: "TX", name: "Dallas", slug: "dallas", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Houston", slug: "houston", metro: "Houston" },
  { stateCode: "TX", name: "San Antonio", slug: "san-antonio", metro: "San Antonio" },
  { stateCode: "TX", name: "Fort Worth", slug: "fort-worth", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "El Paso", slug: "el-paso", metro: "El Paso" },
  { stateCode: "TX", name: "Arlington", slug: "arlington", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Corpus Christi", slug: "corpus-christi", metro: "Corpus Christi" },
  { stateCode: "TX", name: "Plano", slug: "plano", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Lubbock", slug: "lubbock", metro: "Lubbock" },
  { stateCode: "TX", name: "Laredo", slug: "laredo", metro: "Laredo" },
  { stateCode: "TX", name: "Irving", slug: "irving", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Garland", slug: "garland", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "Frisco", slug: "frisco", metro: "Dallas-Fort Worth" },
  { stateCode: "TX", name: "McKinney", slug: "mckinney", metro: "Dallas-Fort Worth" },
  { stateCode: "CA", name: "Los Angeles", slug: "los-angeles", metro: "Los Angeles" },
  { stateCode: "CA", name: "San Diego", slug: "san-diego", metro: "San Diego" },
  { stateCode: "CA", name: "San Francisco", slug: "san-francisco", metro: "San Francisco Bay Area" },
  { stateCode: "CA", name: "San Jose", slug: "san-jose", metro: "San Francisco Bay Area" },
  { stateCode: "CA", name: "Sacramento", slug: "sacramento", metro: "Sacramento" },
  { stateCode: "CA", name: "Fresno", slug: "fresno", metro: "Fresno" },
  { stateCode: "CA", name: "Long Beach", slug: "long-beach", metro: "Los Angeles" },
  { stateCode: "CA", name: "Oakland", slug: "oakland", metro: "San Francisco Bay Area" },
  { stateCode: "CA", name: "Bakersfield", slug: "bakersfield", metro: "Bakersfield" },
  { stateCode: "CA", name: "Anaheim", slug: "anaheim", metro: "Los Angeles" },
  { stateCode: "CA", name: "Santa Ana", slug: "santa-ana", metro: "Los Angeles" },
  { stateCode: "CA", name: "Riverside", slug: "riverside", metro: "Inland Empire" },
  { stateCode: "CA", name: "Irvine", slug: "irvine", metro: "Los Angeles" },
  { stateCode: "CA", name: "Stockton", slug: "stockton", metro: "Stockton" },
  { stateCode: "CA", name: "Chula Vista", slug: "chula-vista", metro: "San Diego" },
  { stateCode: "FL", name: "Miami", slug: "miami", metro: "Miami" },
  { stateCode: "FL", name: "Orlando", slug: "orlando", metro: "Orlando" },
  { stateCode: "FL", name: "Jacksonville", slug: "jacksonville", metro: "Jacksonville" },
  { stateCode: "FL", name: "Tampa", slug: "tampa", metro: "Tampa Bay" },
  { stateCode: "FL", name: "St. Petersburg", slug: "st-petersburg", metro: "Tampa Bay" },
  { stateCode: "FL", name: "Fort Lauderdale", slug: "fort-lauderdale", metro: "Miami" },
  { stateCode: "FL", name: "Tallahassee", slug: "tallahassee", metro: "Tallahassee" },
  { stateCode: "FL", name: "Hialeah", slug: "hialeah", metro: "Miami" },
  { stateCode: "FL", name: "Cape Coral", slug: "cape-coral", metro: "Cape Coral-Fort Myers" },
  { stateCode: "FL", name: "Port St. Lucie", slug: "port-st-lucie", metro: "Port St. Lucie" },
  { stateCode: "IL", name: "Chicago", slug: "chicago", metro: "Chicago" },
  { stateCode: "IL", name: "Aurora", slug: "aurora", metro: "Chicago" },
  { stateCode: "IL", name: "Joliet", slug: "joliet", metro: "Chicago" },
  { stateCode: "IL", name: "Naperville", slug: "naperville", metro: "Chicago" },
  { stateCode: "IL", name: "Rockford", slug: "rockford", metro: "Rockford" },
  { stateCode: "IL", name: "Springfield", slug: "springfield", metro: "Springfield" },
  { stateCode: "IL", name: "Elgin", slug: "elgin", metro: "Chicago" },
  { stateCode: "IL", name: "Peoria", slug: "peoria", metro: "Peoria" },
  { stateCode: "GA", name: "Atlanta", slug: "atlanta", metro: "Atlanta" },
  { stateCode: "GA", name: "Augusta", slug: "augusta", metro: "Augusta" },
  { stateCode: "GA", name: "Columbus", slug: "columbus", metro: "Columbus" },
  { stateCode: "GA", name: "Macon", slug: "macon", metro: "Macon" },
  { stateCode: "GA", name: "Savannah", slug: "savannah", metro: "Savannah" },
  { stateCode: "GA", name: "Athens", slug: "athens", metro: "Athens" },
  { stateCode: "GA", name: "Sandy Springs", slug: "sandy-springs", metro: "Atlanta" },
  { stateCode: "GA", name: "Roswell", slug: "roswell", metro: "Atlanta" },
  { stateCode: "NC", name: "Charlotte", slug: "charlotte", metro: "Charlotte" },
  { stateCode: "NC", name: "Raleigh", slug: "raleigh", metro: "Research Triangle" },
  { stateCode: "NC", name: "Greensboro", slug: "greensboro", metro: "Piedmont Triad" },
  { stateCode: "NC", name: "Durham", slug: "durham", metro: "Research Triangle" },
  { stateCode: "NC", name: "Winston-Salem", slug: "winston-salem", metro: "Piedmont Triad" },
  { stateCode: "NC", name: "Fayetteville", slug: "fayetteville", metro: "Fayetteville" },
  { stateCode: "NC", name: "Cary", slug: "cary", metro: "Research Triangle" },
  { stateCode: "NC", name: "Wilmington", slug: "wilmington", metro: "Wilmington" },
  { stateCode: "NY", name: "New York", slug: "new-york", metro: "New York City" },
  { stateCode: "NY", name: "Buffalo", slug: "buffalo", metro: "Buffalo" },
  { stateCode: "NY", name: "Rochester", slug: "rochester", metro: "Rochester" },
  { stateCode: "NY", name: "Yonkers", slug: "yonkers", metro: "New York City" },
  { stateCode: "NY", name: "Syracuse", slug: "syracuse", metro: "Syracuse" },
  { stateCode: "NY", name: "Albany", slug: "albany", metro: "Capital District" },
  { stateCode: "NY", name: "New Rochelle", slug: "new-rochelle", metro: "New York City" },
  { stateCode: "NY", name: "Mount Vernon", slug: "mount-vernon", metro: "New York City" },
  { stateCode: "NY", name: "Schenectady", slug: "schenectady", metro: "Capital District" },
  { stateCode: "NY", name: "Utica", slug: "utica", metro: "Utica-Rome" },
  { stateCode: "NY", name: "White Plains", slug: "white-plains", metro: "New York City" },
];

export type GlwGeographyValidation = {
  valid: boolean;
  duplicateCityIdentityCount: number;
  cityWithoutValidStateCount: number;
  cityWithMultipleStateOwnerCount: number;
};

export function validateGlwGeographyAuthority(input: {
  states?: readonly GlwState[];
  cities?: readonly GlwCity[];
} = {}): GlwGeographyValidation {
  const states = input.states ?? GLW_STATES;
  const cities = input.cities ?? GLW_CITIES;
  const stateCodes = new Set(states.map((state) => state.code));
  const identities = cities.map((city) => `${city.stateCode}|${city.slug}`);
  const duplicateCityIdentityCount = identities.length - new Set(identities).size;
  const cityWithoutValidStateCount = cities.filter((city) => !stateCodes.has(city.stateCode)).length;
  const cityWithMultipleStateOwnerCount = new Set(identities).size === identities.length ? 0 : duplicateCityIdentityCount;
  return {
    valid: duplicateCityIdentityCount === 0 && cityWithoutValidStateCount === 0,
    duplicateCityIdentityCount,
    cityWithoutValidStateCount,
    cityWithMultipleStateOwnerCount,
  };
}

export function assertGlwGeographyAuthority(input: {
  states?: readonly GlwState[];
  cities?: readonly GlwCity[];
} = {}): void {
  const validation = validateGlwGeographyAuthority(input);
  if (!validation.valid) {
    throw new Error(
      `Invalid GLW geography authority: duplicate=${validation.duplicateCityIdentityCount}; orphaned=${validation.cityWithoutValidStateCount}`,
    );
  }
}

export type GlwGenerationSite = {
  siteId: string;
  organizationId: string;
  name: string;
  slug: string;
  domain: string | null;
  canonicalUrl: string | null;
  wordpressApiBaseUrl: string | null;
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
  site: Pick<SiteConfiguration,
    | "siteId"
    | "organizationId"
    | "displayName"
    | "slug"
    | "domain"
    | "canonicalUrl"
    | "integrations"
    | "environment"
    | "enabled"
  >,
  profileCount = 0,
): GlwGenerationSite {
  return {
    siteId: site.siteId,
    organizationId: site.organizationId,
    name: site.displayName,
    slug: site.slug,
    domain: site.domain,
    canonicalUrl: site.canonicalUrl,
    wordpressApiBaseUrl: site.integrations.wordpressApiBaseUrl,
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
  plannedOperation?: GlwLocalPlannedOperation;
  wordpressObjectId?: string | null;
  additionalInstructions?: string;
  imageDirection?: string;
  campaignId?: string;
};

export type GlwGenerationRequest = GlwGenerationRequestInput & {
  organizationId: string;
  siteName: string;
  siteDomain: string | null;
  siteCanonicalUrl: string | null;
  wordpressApiBaseUrl: string | null;
  productTopic: string;
  stateName: string | null;
  cityName: string | null;
  canonicalPath: string;
  plannedOperation: GlwLocalPlannedOperation;
  wordpressObjectId: string | null;
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
  const defaultOperation: GlwLocalPlannedOperation = form.pageType === "city_service"
    ? "CREATE_CITY"
    : form.pageType === "state_service"
      ? "CREATE_STATE"
      : "CREATE_GENERAL";
  const plannedOperation = form.plannedOperation ?? defaultOperation;
  const expectedOperationTarget = form.pageType === "city_service"
    ? "CITY"
    : form.pageType === "state_service"
      ? "STATE"
      : "GENERAL";
  const wordpressObjectId = form.wordpressObjectId?.trim() || null;

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
  if (!plannedOperation.endsWith(`_${expectedOperationTarget}`)) {
    issues.push({ field: "plannedOperation", message: "The operation must match the requested page type." });
  }
  if (plannedOperation.startsWith("UPDATE_") && !wordpressObjectId?.match(/^[1-9]\d*$/)) {
    issues.push({ field: "wordpressObjectId", message: "Updates require an exact persisted WordPress object ID." });
  }
  if (plannedOperation.startsWith("CREATE_") && wordpressObjectId) {
    issues.push({ field: "wordpressObjectId", message: "Create operations cannot carry WordPress update authority." });
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
      siteDomain: site.domain,
      siteCanonicalUrl: site.canonicalUrl,
      wordpressApiBaseUrl: site.wordpressApiBaseUrl,
      productTopic: product.topic,
      stateName: state?.name ?? null,
      cityName: city?.name ?? null,
      canonicalPath: form.slug,
      plannedOperation,
      wordpressObjectId,
      externalExecutionAllowed: false,
    },
  };
}
