import { getGlwProduct } from "./product-registry";

export type GlwPagePlanAction =
  | "CREATE_STATE"
  | "CREATE_CITY"
  | "UPDATE_CITY"
  | "SKIP_EXISTING"
  | "BLOCKED_PARENT"
  | "BLOCKED_DUPLICATE";

export type GlwExistingPage = {
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug?: string;
  pageType: "state_service" | "city_service";
  canonicalPath: string;
  updatedAt?: string;
};

export type GlwPlannedPage = {
  action: GlwPagePlanAction;
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug?: string;
  canonicalPath: string;
  reason?: string;
};

export function createGlwCanonicalPath(siteId: string, productId: string, stateCode: string, citySlug?: string): string {
  const segments = [siteId, productId, stateCode.toLowerCase()];
  if (citySlug) {
    segments.push(citySlug.toLowerCase());
  }

  return segments.join("/");
}

function indexExistingPages(existingPages: GlwExistingPage[]): Map<string, GlwExistingPage[]> {
  return existingPages.reduce((index, page) => {
    const bucket = index.get(page.canonicalPath) ?? [];
    bucket.push(page);
    index.set(page.canonicalPath, bucket);
    return index;
  }, new Map<string, GlwExistingPage[]>());
}

export function planGlwPageMatrix(input: {
  siteId: string;
  productIds: string[];
  stateCodes: string[];
  cityByState: Record<string, { citySlug: string }[]>;
  existingPages?: GlwExistingPage[];
}): GlwPlannedPage[] {
  const existingIndex = indexExistingPages(input.existingPages ?? []);
  const plans: GlwPlannedPage[] = [];

  for (const productId of input.productIds) {
    const product = getGlwProduct(productId);

    if (!product) {
      continue;
    }

    for (const stateCode of input.stateCodes) {
      const statePath = createGlwCanonicalPath(input.siteId, productId, stateCode);
      const statePages = existingIndex.get(statePath) ?? [];
      const cities = input.cityByState[stateCode] ?? [];

      if (statePages.length > 1) {
        plans.push({
          action: "BLOCKED_DUPLICATE",
          siteId: input.siteId,
          productId,
          stateCode,
          canonicalPath: statePath,
          reason: `Multiple state pages already exist for ${product.name} in ${stateCode}.`,
        });
        continue;
      }

      if (statePages.length === 0) {
        plans.push({
          action: "CREATE_STATE",
          siteId: input.siteId,
          productId,
          stateCode,
          canonicalPath: statePath,
        });
      } else {
        plans.push({
          action: "SKIP_EXISTING",
          siteId: input.siteId,
          productId,
          stateCode,
          canonicalPath: statePath,
          reason: `State page already exists for ${product.name} in ${stateCode}.`,
        });
      }

      for (const city of cities) {
        const cityPath = createGlwCanonicalPath(input.siteId, productId, stateCode, city.citySlug);
        const cityPages = existingIndex.get(cityPath) ?? [];

        if (statePages.length === 0) {
          plans.push({
            action: "BLOCKED_PARENT",
            siteId: input.siteId,
            productId,
            stateCode,
            citySlug: city.citySlug,
            canonicalPath: cityPath,
            reason: `State parent is missing for ${stateCode}.`,
          });
          continue;
        }

        if (cityPages.length > 1) {
          plans.push({
            action: "BLOCKED_DUPLICATE",
            siteId: input.siteId,
            productId,
            stateCode,
            citySlug: city.citySlug,
            canonicalPath: cityPath,
            reason: `Multiple city pages already exist for ${city.citySlug}.`,
          });
          continue;
        }

        if (cityPages.length === 0) {
          plans.push({
            action: "CREATE_CITY",
            siteId: input.siteId,
            productId,
            stateCode,
            citySlug: city.citySlug,
            canonicalPath: cityPath,
          });
          continue;
        }

        plans.push({
          action: "UPDATE_CITY",
          siteId: input.siteId,
          productId,
          stateCode,
          citySlug: city.citySlug,
          canonicalPath: cityPath,
          reason: `City page exists for ${city.citySlug} and can be refreshed.`,
        });
      }
    }
  }

  return plans;
}